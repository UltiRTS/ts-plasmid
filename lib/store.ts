import {createHash, randomInt} from 'crypto';
import { parse } from 'path';
import {createClient, RedisClientType, } from 'redis';
import { Adv_Overview, Chat_Overview, Game_Overview, State, User2Dump } from './interfaces';
import { ChatRoom } from './states/chat';
import { GameRoom } from './states/room';
import { User } from './states/user';
import { Adventure } from './states/rougue/adventure';
import { EventEmitter } from 'stream';
import { sleep } from './util';

const PREFIX_USER = 'USER_';
const PREFIX_GAME = 'GAME_';
const PREFIX_CHAT = 'CHAT_';
const PREFIX_ADV = 'ADVENTURE_';

const SUFFIX_LOCK = '_LOCK';

const LOGIN = 'LOGIN';

const ACQUIRE_MAX_AWAIT = 5000;
const LOCK_EXPIRE_TIME = 20; // 20s

const OVERVIEW = 'OVERVIEW';
const OVERVIEW_SYNC_INTERVAL = 2000; // 2000ms

export class RedisStore {
    client: RedisClientType
    sub: RedisClientType
    connected: boolean
    emitter: EventEmitter

    constructor() {
        this.client = createClient();
        this.sub = this.client.duplicate();
        this.connected = false;
        this.emitter = new EventEmitter();


        (async () => {
            await this.client.connect();
            await this.sub.connect();
            await this.client.configSet({
                'notify-keyspace-events': 'KEA'
            })
            await this.sub.configSet({
                'notify-keyspace-events': 'KEA'
            })

            this.connected = true;
            this.emitter.emit('initialized')
            // console.log('redis client connected')
        })()
    }

    async destroy() {
        await this.client.quit();
    }

    async setAdventure(advName: number, adv: Adventure) {
        const name = RedisStore.ADV_RESOURCE(String(advName));
        await this.client.set(name, adv.serialize());

        await this.pushAdvOverview(String(advName));
    }

    async getAdventure(advName: number) {
        const name = RedisStore.ADV_RESOURCE(String(advName))

        const advStr = await this.client.get(name);
        if(advStr == null) return null
        else return Adventure.from(advStr);
    }

    async delAdventure(advId: number) {
        const advName = String(advId);
        const name = RedisStore.ADV_RESOURCE(advName);
        await this.client.del(name);
        await this.removeAdvOverview(advName);
    }

    async setChat(chatName: string, chat: ChatRoom) {
        const name = RedisStore.CHAT_RESOURCE(chatName);
        await this.client.set(name, chat.serialize());

        await this.pushChatOverview(chatName);
    }

    async getChat(chatName: string) {
        const name = RedisStore.CHAT_RESOURCE(chatName);

        const chatStr = await this.client.get(name);
        if(chatStr == null) return null
        else return ChatRoom.from(chatStr);
    }

    async delChat(chatName: string) {
        const name = RedisStore.CHAT_RESOURCE(chatName);
        await this.client.del(name);
        await this.removeChatOverview(chatName);
    }

    async setGame(gameName: string, game: GameRoom) {
        const name = RedisStore.GAME_RESOURCE(gameName);
        await this.client.set(name, game.serialize());

        // since it will always acquire game lock before acquire game overview lock
        // so there will no circular wait exists
        await this.pushGameOverview({
            title: game.title,
            hoster: game.hoster,
            mapId: game.mapId
        })
    }

    async getGame(gameName: string) {
        const name = RedisStore.GAME_RESOURCE(gameName);

        const gameStr = await this.client.get(name);
        if(gameStr == null) return null;
        else return GameRoom.from(gameStr);
    }

    async delGame(gameName: string) {
        const name = RedisStore.GAME_RESOURCE(gameName);
        await this.client.del(name);
        await this.removeGameOverview(gameName);
    }


    async setUser(username: string, user: User) {
        const name = RedisStore.USER_RESOURCE(username);

        await this.client.set(name, user.serialize());
    }

    async getUser(username: string) {
        const name = RedisStore.USER_RESOURCE(username);

        const userStr = await this.client.get(name);
        if(userStr == null) return null;
        else return User.from(userStr);
    }

    async delUser(username: string) {
        const name = RedisStore.USER_RESOURCE(username);
        await this.client.del(name);
    }

    async getGameOverview() {
        const name = RedisStore.OVERVIEW_RESOURCE('game');
        let gameOverviewStr = await this.client.get(name);
        let gameOverview: Game_Overview;
        if(gameOverviewStr == null) {
            gameOverview = {}
        } else {
            gameOverview = JSON.parse(gameOverviewStr);
        }

        return gameOverview;
    }

    async setGameOverview(overview: Game_Overview) {
        const name = RedisStore.OVERVIEW_RESOURCE('game');
        await this.client.set(name, JSON.stringify(overview));
    }

    async pushGameOverview(game: {
        title: string
        hoster: string
        mapId: number
    }) {
        const GAME_OVERVIEW_LOCK = RedisStore.LOCK_RESOURCE('game', 'overview');
        let lockAcquired = false;
        while(!lockAcquired) {
            try {
                await this.acquireLock(GAME_OVERVIEW_LOCK);
                lockAcquired = true;
            } catch {}
        }

        const gameOverview = await this.getGameOverview();
        if(!(game.title in gameOverview)) {
            gameOverview[game.title] = {
                hoster: game.hoster,
                mapId: game.mapId,
            }
        }

        await this.setGameOverview(gameOverview);
        await this.releaseLock(GAME_OVERVIEW_LOCK);
    }

    async removeGameOverview(game: string) {
        const GAME_OVERVIEW_LOCK = RedisStore.LOCK_RESOURCE('game', 'overview');
        let lockAcquired = false;
        while(!lockAcquired) {
            try {
                await this.acquireLock(GAME_OVERVIEW_LOCK);
                lockAcquired = true;
            } catch {}
        }

        const gameOverview = await this.getGameOverview();
        delete gameOverview[game];

        await this.setGameOverview(gameOverview);
        await this.releaseLock(GAME_OVERVIEW_LOCK);
    }

    async getChatOverview() {
        const name = RedisStore.OVERVIEW_RESOURCE('chat');
        let chatOverviewStr = await this.client.get(name);
        let chatOverview: Chat_Overview; 
        if(chatOverviewStr == null) {
            chatOverview = {};
        } else {
            chatOverview = JSON.parse(chatOverviewStr);
        }

        return chatOverview;
    }

    async setChatOverview(overview: Chat_Overview) {
        const name = RedisStore.OVERVIEW_RESOURCE('chat');
        await this.client.set(name, JSON.stringify(overview));
    }

    async pushChatOverview(chat: string) {
        const CHAT_OVERVIEW_LOCK = RedisStore.LOCK_RESOURCE('chat', 'overview');
        let lockAcquired = false;
        while(!lockAcquired) {
            try {
                await this.acquireLock(CHAT_OVERVIEW_LOCK);
                lockAcquired = true;
            } catch {}
        }
        
        const chatOverview = await this.getChatOverview();

        if(!(chat in chatOverview)) {
            chatOverview[chat] = '';
        }

        await this.setChatOverview(chatOverview);
        await this.releaseLock(CHAT_OVERVIEW_LOCK);
    }

    async removeChatOverview(chat: string) {
        const CHAT_OVERVIEW_LOCK = RedisStore.LOCK_RESOURCE('chat', 'overview');
        let lockAcquired = false;
        while(!lockAcquired) {
            try {
                await this.acquireLock(CHAT_OVERVIEW_LOCK);
                lockAcquired = true;
            } catch {}
        }
        
        const chatOverview = await this.getChatOverview();
        delete chatOverview[chat];

        await this.setChatOverview(chatOverview);
        await this.releaseLock(CHAT_OVERVIEW_LOCK);
    }

    async getAdvOverview() {
        const name = RedisStore.OVERVIEW_RESOURCE('adv');
        let advOverviewStr = await this.client.get(name);
        let advOverview: Adv_Overview; 
        if(advOverviewStr == null) {
            advOverview = {};
        } else {
            advOverview = JSON.parse(advOverviewStr);
        }

        return advOverview;
    }

    async setAdvOverview(overview: Adv_Overview) {
        const name = RedisStore.OVERVIEW_RESOURCE('adv');
        await this.client.set(name, JSON.stringify(overview));
    }

    async pushAdvOverview(adv: string) {
        const ADV_OVERVIEW_LOCK = RedisStore.LOCK_RESOURCE('adv', 'overview');
        let lockAcquired = false;
        while(!lockAcquired) {
            try {
                await this.acquireLock(ADV_OVERVIEW_LOCK);
                lockAcquired = true;
            } catch {}
        }
        
        const advOverview = await this.getAdvOverview();

        if(!(adv in advOverview)) {
            advOverview[adv] = '';
        }

        await this.setAdvOverview(advOverview);
        await this.releaseLock(ADV_OVERVIEW_LOCK);
    }

    async removeAdvOverview(adv: string) {
        const ADV_OVERVIEW_LOCK = RedisStore.LOCK_RESOURCE('adv', 'overview');
        let lockAcquired = false;
        while(!lockAcquired) {
            try {
                await this.acquireLock(ADV_OVERVIEW_LOCK);
                lockAcquired = true;
            } catch {}
        }
        
        const advOverview = await this.getAdvOverview();
        delete advOverview[adv];

        await this.setAdvOverview(advOverview)
        await this.releaseLock(ADV_OVERVIEW_LOCK);
    }

    // those two methods will be only used in main thread
    async setOnline(players: string[]) {
        const UESR_ONLINE_OVERVIEW = RedisStore.OVERVIEW_RESOURCE('user-online');
        await this.client.set(UESR_ONLINE_OVERVIEW, JSON.stringify(players));
    }

    async getOnline() {
        const UESR_ONLINE_OVERVIEW = RedisStore.OVERVIEW_RESOURCE('user-online');

        const onlines = await this.client.get(UESR_ONLINE_OVERVIEW);
        if(onlines == null) {
            return []
        }
        return Object.assign([], JSON.parse(onlines)) as string[];
    }

    async dumpState(username: string) {
        const user = await this.getUser(username);
        const gameName = user?.game;
        const advName = user?.adventure
        let game: GameRoom | null = null
        let adventure: Adventure | null = null
        if(gameName) game = await this.getGame(gameName);
        if(advName) adventure = await this.getAdventure(advName);

        const onlines = await this.getOnline();

        let user2dump: User2Dump | null = null;
        if(user) {
            const chatRooms: {
                [key: string]: ChatRoom
            } = {};
            for(const chatName of user.chatRooms) {
                const chatRoom = await this.getChat(chatName);
                if(chatRoom) 
                    chatRooms[chatName] = chatRoom;
            }
            user2dump = {
                id: user.id,
                username: user.username,
                exp: user.exp,
                sanity: user.sanity,
                blocked: user.blocked,
                hash: '',
                salt: '',
                confirmations: user.confirmations2dump,
                friends: user.friends2dump,
                chatRooms,
                game,
                chats: [],
                accessLevel: user.accessLevel,
                winCount: user.winCount,
                loseCount: user.loseCount,
                adventure,
                marks2dump: user.marks2dump,
                onlines: onlines.filter(p => user.friends2dump.includes(p))
            }
        }

        const chats = Object.keys(await this.getChatOverview());
        const games: {
            title: string
            hoster: string
            mapId: number
        }[] = []

        const gameOverview = await this.getGameOverview();
        for(const g in gameOverview) {
            const game = gameOverview[g];
            games.push({
                title: g,
                hoster: game.hoster,
                mapId: game.mapId
            })
        }

        const state: State = {
            user: user2dump,
            chats,
            games
        }

        return state;
    }

    async setLoginStatus(username: string, status: boolean) {
        const tableStr = await this.client.get(LOGIN);
        const table: {[key:string]: boolean} = tableStr==null?{}:JSON.parse(tableStr);

        table[username] = status;

        this.client.set(LOGIN, JSON.stringify(table));
    }

    async getLoginStatus(username: string) {
        const tableStr = await this.client.get(LOGIN);
        const table: {[key:string]: boolean} = tableStr==null?{}:JSON.parse(tableStr);

        return table[username]==null?false:table[username];
    }

    async acquireLock(resource: string) {
        let retry = 3;
        while(retry>0) {
            try {
                await this._acquireLock(resource);
                return true;
            } catch(e) {
                // deply requiring
                sleep(randomInt(50, 200));
            }

            retry--;
        }

        throw new Error(`acquire ${resource} lock failed`);
    }

    async _acquireLock(resource: string) {
        const sub = this.sub;
        const client_redis = this.client;
        return new Promise(async (resolve, reject) => {
            const success = await client_redis.set(resource, '1', {
                EX: LOCK_EXPIRE_TIME,
                NX: true
            });
            if(success) {
                // console.log('key', resource, 'acquired');
                resolve(true);
            } else {
                const timeout = setTimeout(async () => {
                    await sub.unsubscribe('__keyevent@0__:del')
                    reject(new Error('key required failed'))
                }, ACQUIRE_MAX_AWAIT)


                const subCallback = async (key: string) => {
                    if(key === resource) {
                        const success = await client_redis.set(resource, '1', {
                            EX: LOCK_EXPIRE_TIME,
                            NX: true
                        });
                        if(success) {
                            // console.log('key', resource, 'acquired');
                            await sub.unsubscribe('__keyevent@0__:del')
                            clearTimeout(timeout);
                            resolve(true);
                        } else {
                            await sub.unsubscribe('__keyevent@0__:del')
                            await sub.subscribe('__keyevent@0__:del', subCallback);
                        }
                    }
                }

                await sub.subscribe('__keyevent@0__:del', subCallback);
            }
        })
    }

    async releaseLock(resource: string) {
        const client_redis = this.client;
        await client_redis.del(resource);
        // console.log('key', resource, 'released')
        return true;
    }

    async acquireLocks(resources: string[]) {
        const sub = this.sub;
        const client_redis = this.client;
        return new Promise(async (resolve, reject) => {
            const m2set: string[] = [];
            for(const resource of resources) {
                m2set.push(resource);
                m2set.push('1');
            }
            const success = await client_redis.mSetNX(m2set);
            if(success) {
                // console.log('key', resource, 'acquired');
                for(const resource of resources) {
                    await client_redis.expire(resource, 5);
                }
                resolve(true);
            } else {
                const timeout = setTimeout(async () => {
                    await sub.unsubscribe('__keyevent@0__:del')
                    reject(new Error('key required failed'))
                }, ACQUIRE_MAX_AWAIT)

                const subCallback = async (key: string) => {
                    let acquirable = true;
                    if(key in resources) {
                        for(const resource of resources) {
                            const v = await client_redis.get(resource);
                            acquirable &&= v === null;
                        }
                    }
                    if(acquirable) {
                        const success = await client_redis.mSetNX(m2set);
                        if(success) {
                            // console.log('key', resource, 'acquired');
                            for(const resource of resources) {
                                await client_redis.expire(resource, 5);
                            }
                            clearTimeout(timeout);
                            resolve(true);
                        } else {
                            await sub.unsubscribe('__keyevent@0__:del')
                            await sub.subscribe('__keyevent@0__:del', subCallback);
                        }
                    }
                }

                await sub.subscribe('__keyevent@0__:del', subCallback);
            }
        })
    }

    async releaseLocks(resources: string[]) {
        const client_redis = this.client;
        const res = await client_redis.del(resources);
        // console.log('key', resource, 'released')
        return true;
    }

    static USER_RESOURCE(username: string) {
        return PREFIX_USER +  username;
    }

    static GAME_RESOURCE(title: string) {
        return PREFIX_GAME + title;
    }

    static CHAT_RESOURCE(title: string) {
        return PREFIX_CHAT + title;
    }

    static ADV_RESOURCE(title: string) {
        return PREFIX_ADV + title;
    }

    static OVERVIEW_RESOURCE(title: string) {
        return OVERVIEW + title;
    }

    static LOCK_RESOURCE(name: string, type: string) {
        let lockname = '';
        type = type.toLowerCase();

        switch(type) {
            case 'user': {
                lockname = RedisStore.USER_RESOURCE(name) + SUFFIX_LOCK;
                break;
            }
            case 'game': {
                lockname = RedisStore.GAME_RESOURCE(name) + SUFFIX_LOCK;
                break;
            }
            case 'chat': {
                lockname = RedisStore.CHAT_RESOURCE(name) + SUFFIX_LOCK;
                break;
            }
            case 'overview': {
                lockname = RedisStore.OVERVIEW_RESOURCE(name) + SUFFIX_LOCK;
                break;
            }
            case 'adv': {
                lockname = RedisStore.ADV_RESOURCE(name) + SUFFIX_LOCK;
                break;
            }
            default: {
                lockname = lockname + SUFFIX_LOCK;
                break;
            }
        }

        return lockname;
    }
}