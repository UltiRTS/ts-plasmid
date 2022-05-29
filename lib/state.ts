import {User} from "./states/user";
import {ChatRoom} from './states/chat';
import {Mutex} from 'async-mutex';

export interface StateDumped {
    user: User
    chats: ChatRoom[]
}

export class State {
    users: { [username: string]: {
        mutex: Mutex,
        entity: User,
        release: () => void
    }};

    chats: { [roomName: string]: {
        mutex: Mutex,
        entity: ChatRoom,
        release: () => void
    }}

    constructor() {
        this.users = {};
        this.chats = {};
    }

    async addChat(chat: ChatRoom) {
        this.chats[chat.roomName] = {
            mutex: new Mutex(),
            entity: chat,
            release: () => {}
        }
    }

    async lockChat(roomName: string) {
        if(!this.chats[roomName]) return true;

        this.chats[roomName].release 
            = await this.chats[roomName].mutex.acquire();
    }

    releaseChat(roomName: string) {
        if(!this.chats[roomName]) return;

        this.chats[roomName].release();
    }

    async assignChat(roomName: string, chat: ChatRoom) {
        const release = await this.chats[roomName].mutex.acquire();
        this.chats[roomName].entity = chat;
        release();
    }

    async removeChat(roomName: string) {
        delete this.chats[roomName];
    }

    getChat(roomName: string) {
        if(!this.chats[roomName]) return null;

        return this.chats[roomName].entity;
    }

    getUser(username: string) {
        if(!this.users[username]) return null;

        return this.users[username].entity;
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

    async assignUser(username: string, user: User) {
        const release = await this.users[username].mutex.acquire();
        this.users[username].entity = user;
        release();
    }

    addUser(user: User) {
        this.users[user.username] = {
            mutex: new Mutex(),
            entity: user,
            release: () => {}
        }
    }

    // may be problematic 
    removeUser(username: string) {
        delete this.users[username];
    }

    dump(username: string) {
        if(!this.users[username]) return null;

        const res: StateDumped = {
            user: this.users[username].entity,
            chats: Object.values(this.chats).map(chat => chat.entity)
        };

        return res
    }
}