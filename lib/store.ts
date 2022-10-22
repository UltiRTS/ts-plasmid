import {createHash} from 'crypto';
import {createClient, RedisClientType, } from 'redis';
import { GameRoom } from './states/room';
import { User } from './states/user';

const PREFIX_USER = 'USER_';
const PREFIX_GAME = 'GAME_';

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
}