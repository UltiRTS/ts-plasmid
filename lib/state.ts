import {User} from "./states/user";
import {ChatRoom} from './states/chat';
import { GameRoom } from './states/room';
import {Mutex, withTimeout, MutexInterface} from 'async-mutex';
import { time } from "console";

export interface StateDumped {
    user: User
    chats: string[]
    games: {
        title: string,
        hoster: string,
        mapId: number,
    }[]
}

export class State {
    users: { [username: string]: {
        mutex: Mutex,
        entity: User,
        release: () => void
    }};

    chats: { [roomName: string]: {
        // mutex: Mutex,
        mutex: MutexInterface,
        entity: ChatRoom,
        release: () => void
    }}

    rooms: { [roomName: string]: {
        mutex: Mutex,
        entity: GameRoom,
        release: () => void
    }}


    constructor() {
        this.users = {};
        this.chats = {};
        this.rooms = {};
    }

    async addChat(chat: ChatRoom) {
        this.chats[chat.roomName] = {
            mutex: withTimeout(new Mutex(),100, new Error('timeout')),
            entity: chat,
            release: () => {}
        }
    }

    async lockChat(roomName: string) {
        if(!this.chats[roomName]) return true;

        try {
            this.chats[roomName].release 
                = await this.chats[roomName].mutex.acquire();
        } catch(e) {
            console.log(e);
        }
    }

    releaseChat(roomName: string) {
        if(!this.chats[roomName]) return;

        this.chats[roomName].release();
    }

    async assignChat(roomName: string, chat: ChatRoom) {
        this.chats[roomName].entity = chat;
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

    addGame(game: GameRoom) {
        this.rooms[game.title] = {
            mutex: new Mutex(),
            entity: game,
            release: () => {}
        }
    }

    assignGame(roomName: string, game: GameRoom) {
        this.rooms[roomName].entity = game;
    }

    async lockGame(roomName: string) {
        if(!this.rooms[roomName]) return true;

        this.rooms[roomName].release 
            = await this.rooms[roomName].mutex.acquire();
    } 

    releaseGame(roomName: string) {
        if(!this.rooms[roomName]) return;

        this.rooms[roomName].release();
    }

    getGame(roomName: string) {
        if(!this.rooms[roomName]) return null;

        return this.rooms[roomName].entity;
    }

    async garbageCollect(user: User) {
        if(this.users[user.username]) {
            const release = await this.users[user.username].mutex.acquire()
            const u = this.users[user.username];
            const game = u.entity.game
            const chatRooms = u.entity.chatRooms;

            if(game) {
                const release = await this.rooms[game?.title].mutex.acquire();
                this.rooms[game?.title].entity.removePlayer(user.username);
                // console.log(`gc ${user.username} in game: ${game?.title}`);

                if(this.rooms[game?.title].entity.empty()) 
                    delete this.rooms[game?.title];

                release()
            }
            for(const roomName in chatRooms) {
                if(this.chats[roomName]) {
                    const release = await this.chats[roomName].mutex.acquire();
                    this.chats[roomName].entity.leave(user);
                    // console.log(`gc ${user.username} in room: ${roomName}`);

                    if(this.chats[roomName].entity.empty()) 
                        delete this.chats[roomName];

                    release()
                }
            }

            release()
            delete this.users[user.username];
        }
    }

    dump(username: string) {
        if(!this.users[username]) return null;

        const res: StateDumped = {
            user: this.users[username].entity,
            chats: Object.values(this.chats).map(chat => chat.entity.roomName),
            games: Object.values(this.rooms).map(room => {
                return {
                    title: room.entity.title,
                    hoster: room.entity.hoster,
                    mapId: room.entity.mapId,
                }
            })
        };

        return res
    }
}