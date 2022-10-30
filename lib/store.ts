import {createHash} from 'crypto';
import { parse } from 'path';
import {createClient, RedisClientType, } from 'redis';
import { GameRoom } from './states/room';
import { User } from './states/user';
import { sleep } from './util';

const PREFIX_USER = 'USER_';
const PREFIX_GAME = 'GAME_';
const LOGIN = 'LOGIN';
const LOCK = 'LOCK';
const ACQUIRE_MAX_AWAIT = 5000;
const LOCK_EXPIRE_TIME = 20; // 20s

export class RedisStore {
    client: RedisClientType
    sub: RedisClientType
    connected: boolean

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
    }

    async setGame(gameName: string, game: GameRoom) {
        const name = PREFIX_GAME + gameName;
        console.log(game);
        console.log(game.serialize());
        await this.client.set(name, game.serialize());
    }

    async getGame(gameName: string) {
        const name = PREFIX_GAME + gameName;

        const gameStr = await this.client.get(name);
        if(gameStr == null) return null;
        else return GameRoom.from(gameStr);
    }

    async setUser(username: string, user: User) {
        const name = PREFIX_USER + username;

        await this.client.set(name, user.serialize());
    }

    async getUser(username: string) {
        const name = PREFIX_USER + username;

        const userStr = await this.client.get(name);
        if(userStr == null) return null;
        else return User.from(userStr);
    }

    async dumpState(username: string) {
        const name = this.USER_RESOURCE(username);
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
                console.log('key', resource, 'acquired');
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
                            console.log('key', resource, 'acquired');
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
            console.log('key', resource, 'released')
            resolve(true);
        })
    }

    USER_RESOURCE(username: string) {
        return PREFIX_USER +  username;
    }

    GAME_RESOURCE(title: string) {
        return PREFIX_GAME + title;
    }
}