import {User} from "./states/user";
import {Mutex} from 'async-mutex';

export class State {
    users: { [username: string]: {
        mutex: Mutex,
        entity: User,
        release: () => void
    }};

    constructor() {
        this.users = {};
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

    dump() {

    }
}