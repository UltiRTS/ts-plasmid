import {User} from "./states/user";
import {Mutex} from 'async-mutex';

export class State {
    users: { [username: string]: {
        mutex: Mutex,
        entity: User,
        release: () => void
    }};

    usersMutex: Mutex;

    constructor() {
        this.users = {};

        this.usersMutex = new Mutex();
    }

    async lockUser(username: string) {
        if(!this.users[username]) return true;

        this.users[username].release 
            = await this.users[username].mutex.acquire();
    }

    releaseUser(username: string) {
        if(!this.users[username]) return;

        this.users[username].release();
    }

    assignUser(username: string, user: User) {
        this.users[username] = {
            mutex: new Mutex(),
            entity: user,
            release: () => {}
        }
    }

    async addUser(user: User) {
        const release = await this.usersMutex.acquire()
        this.users[user.username] = {
            mutex: new Mutex(),
            entity: user,
            release: () => {}
        }

        release();
    }

    // may be problematic 
    async removeUser(username: string) {
        const release = await this.usersMutex.acquire()
        delete this.users[username];

        release();
    }

    dump() {

    }
}