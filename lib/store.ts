import {createHash} from 'crypto';
import { parse } from 'path';
import {createClient, RedisClientType, } from 'redis';
import { ChatRoom } from './states/chat';
import { GameRoom } from './states/room';
import { User } from './states/user';
import { sleep } from './util';

const PREFIX_USER = 'USER_';
const PREFIX_GAME = 'GAME_';
const PREFIX_CHAT = 'CHAT_';

const LOGIN = 'LOGIN';

const ACQUIRE_MAX_AWAIT = 5000;
const LOCK_EXPIRE_TIME = 20; // 20s

const OVERVIEW = 'OVERVIEW';
const OVERVIEW_SYNC_INTERVAL = 2000; // 2000ms

export class RedisStore {
    client: RedisClientType
    sub: RedisClientType
    connected: boolean

    // brief stats
    games: {
        [gameName: string]: {
            hoster: string
            mapId: number
        }
    } = {}

    chats: string[] = []

    

    constructor() {
        this.client = createClient();
        this.sub = this.client.duplicate();
        this.connected = false;

        (async () => {
            await this.client.connect();
            await this.sub.connect();
            this.connected = true;
            console.log('redis client connected')
        })()

        setInterval(async () => {
            const overview_chats = RedisStore.OVERVIEW_RESOURCE('chats');
            const overview_games = RedisStore.OVERVIEW_RESOURCE('games');

            try {
                const acquired = await this.acquireLock(OVERVIEW);
                if(!acquired) {
                    return;
                }
            } catch(e) {
                return;
            }

            const remote_chats_str = await this.client.get(overview_chats);
            const remote_games_str = await this.client.get(overview_games);

            let remote_chats: string[] = remote_chats_str==null?[]:JSON.parse(remote_chats_str);
            let remote_games: {[gameName: string]: {
                hoster: string, 
                mapId: number
            }} = remote_games_str==null?{}:JSON.parse(remote_games_str);

            const local_games = this.games;
            const local_chats = this.chats;

            for(let i=0; i<local_chats.length; i++) {
                if(!remote_chats.includes(local_chats[i])) remote_chats.push(local_chats[i]);
            }

            for(const gameName in local_games) {
                if(!(gameName in remote_games)) {
                    remote_games[gameName] = local_games[gameName];
                }
            }

            this.chats = remote_chats;
            this.games = remote_games;

            await this.releaseLock(OVERVIEW);
        }, OVERVIEW_SYNC_INTERVAL)
    }

    async setChat(chatName: string, chat: ChatRoom) {
        const name = RedisStore.CHAT_RESOURCE(chatName);
        if(!this.chats.includes(chatName)) this.chats.push(chatName);
        await this.client.set(name, chat.serialize());
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
    }

    async setGame(gameName: string, game: GameRoom) {
        const name = RedisStore.GAME_RESOURCE(gameName);
        if(!(gameName in this.games)) {
            this.games[gameName] = {
                hoster: game.hoster,
                mapId: game.mapId
            };
        }
        await this.client.set(name, game.serialize());
    }

    async getGame(gameName: string) {
        const name = RedisStore.GAME_RESOURCE(gameName);

        const gameStr = await this.client.get(name);
        if(gameStr == null) return null;
        else return GameRoom.from(gameStr);
    }

    async delGame(gameName: string) {
        const name = RedisStore.GAME_RESOURCE(gameName);
        delete this.games[gameName];
        await this.client.del(name);
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

    async dumpState(username: string) {
        const name = RedisStore.USER_RESOURCE(username);
        const userStr = await this.client.get(name);
        if(userStr === null) return null;

        const user = User.from(userStr);
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

                await sub.subscribe('__keyevent@0__:del', async (key) => {
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
                        }
                    }
                });
            }
        })
    }

    async releaseLock(resource: string) {
        const client_redis = this.client;
        return new Promise(async (resolve, reject) => {
            await client_redis.del(resource);
            // console.log('key', resource, 'released')
            resolve(true);
        })
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

    static OVERVIEW_RESOURCE(title: string) {
        return OVERVIEW + title;
    }
}
/** 
{
    "action": "SETAI",
    "seq": 511561,
    "state": {
        "user": {
            "chatRooms": {
                "global": {
                    "id": 631,
                    "chats": [],
                    "roomName": "global",
                    "password": "",
                    "lastMessage": {
                        "author": "",
                        "content": "",
                        "time": "2022-11-01T21:43:38.204Z"
                    },
                    "members": [
                        "chan"
                    ]
                }
            },
            "game": {
                "roomNotes": "",
                "title": "test",
                "hoster": "chan",
                "mapId": 788,
                "ais": {
                    "GPT_0": {
                        "team": "B"
                    }
                },
                "chickens": {},
                "players": {
                    "chan": {
                        "isSpec": false,
                        "team": "A",
                        "hasmap": true
                    }
                },
                "polls": {},
                "id": 20,
                "engineToken": "mcBbws37jM",
                "password": "",
                "isStarted": false,
                "responsibleAutohost": "54.255.255.95",
                "autohostPort": 0,
                "aiHosters": [
                    "chan"
                ],
                "mod": "mod.sdd"
            },
            "id": 2,
            "username": "chan",
            "accessLevel": 100,
            "exp": 0,
            "sanity": 0,
            "blocked": false,
            "hash": "",
            "salt": "",
            "confirmations": [
                {
                    "id": 93,
                    "text": "chan has requested to be your friend",
                    "type": "friend",
                    "payload": "{\"type\":\"friend\",\"targetVal\":\"chan\"}",
                    "claimed": false
                },
            ],
            "friends": [
                {
                    "id": 1,
                    "username": "test",
                    "hash": "",
                    "salt": "",
                    "accessLevel": 0,
                    "exp": 0,
                    "sanity": 0,
                    "blocked": false,
                    "winCount": 266,
                    "loseCount": 3
                }
            ]
        },
        "chats": [
            "global"
        ],
        "games": [
            {
                "title": "test",
                "hoster": "chan",
                "mapId": 788
            }
        ]
    }
}
*/