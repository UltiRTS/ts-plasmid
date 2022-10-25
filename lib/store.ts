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
// 200 ms
const ACQUIRE_INTERVAL = 200;
const MAX_ACQUIRE = 3;

export class RedisStore {
    client: RedisClientType
    connected: boolean

    constructor() {
        this.client = createClient();
        this.connected = false;

        (async () => {
            await this.client.connect();
            this.connected = true;
            console.log('redis client connected')
        })()
    }

    setGame(gameName: string, game: GameRoom) {
        const name = PREFIX_GAME + gameName;
        this.client.set(name, game.serialize());
    }

    async getGame(gameName: string) {
        const name = PREFIX_GAME + gameName;

        const gameStr = await this.client.get(name);
        if(gameStr == null) return null;
        else return GameRoom.from(gameStr);
    }

    setUser(username: string, user: User) {
        const name = PREFIX_USER + username;

        this.client.set(name, user.serialize());
    }

    async getUser(username: string) {
        const name = PREFIX_USER + username;

        const userStr = await this.client.get(name);
        if(userStr == null) return null;
        else return User.from(userStr);
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
        const lockName = LOCK + resource;

        let locked = true;
        let retry = 0;

        while(locked) {
            if(retry < MAX_ACQUIRE) retry++;
            else return true;

            locked = await this.client.setNX(lockName, '1');
            if(locked) await sleep(ACQUIRE_INTERVAL);
        }

        return false;
    }

    async releaseLock(resource: string) {
        const lockName = LOCK + resource;
        this.client.del(lockName);
    }

    USER_RESOURCE(username: string) {
        return PREFIX_USER +  username;
    }

    GAME_RESOURCE(title: string) {
        return PREFIX_GAME + title;
    }
}