import {User} from "./states/user";
import {ChatRoom} from './states/chat';
import { GameRoom } from './states/room';
import {Mutex, withTimeout, MutexInterface} from 'async-mutex';

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
        // mutex: Mutex,
        mutex: Mutex,
        entity: User,
        release: () => void
    }};

    chats: { [roomName: string]: {
        // mutex: Mutex,
        mutex: Mutex,
        entity: ChatRoom,
        release: () => void
    }}

    rooms: { [roomName: string]: {
        // mutex: Mutex,
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
            mutex: new Mutex(),
            entity: chat,
            release: () => {}
        }
    }

    async lockChat(roomName: string) {
        if(!this.chats[roomName]) return true;

        this.chats[roomName].release 
            = await this.chats[roomName].mutex.acquire();

        setTimeout(() => {
            this.releaseChat(roomName);
        }, 1000);
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

        setTimeout(() => {
            this.releaseUser(username);
        }, 1000);
    }

    releaseUser(username: string) {
        if(!this.users[username]) return;

        this.users[username].release();
    }

    async assignUser(username: string, user: User) {
        this.lockUser(username);
        this.users[username].entity = user;
        this.releaseUser(username);
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
        for(const username in this.rooms[roomName].entity.players) {
            const user = this.getUser(username);
            if(!user) continue;

            this.lockUser(username);
            user.game = game;
            this.releaseUser(username);
        }
    }

    async lockGame(roomName: string) {
        if(!this.rooms[roomName]) return true;

        this.rooms[roomName].release 
            = await this.rooms[roomName].mutex.acquire();

        setTimeout(() => {
            this.releaseGame(roomName);
        }, 1000);
    } 

    releaseGame(roomName: string) {
        if(!this.rooms[roomName]) {
            console.log(`releaseGame: ${roomName} not found`);
            return;
        }

        this.rooms[roomName].release();
    }

    getGame(roomName: string) {
        if(!this.rooms[roomName]) return null;

        return this.rooms[roomName].entity;
    }

    removeGame(roomName: string) {
        const players = this.rooms[roomName].entity.players;
        for(const username in players) {
            const user = this.getUser(username);
            if(!user) continue;

            this.lockUser(username);
            user.game = null;
            this.releaseUser(username);
        }

        delete this.rooms[roomName];
    }

    async garbageCollect(user: User) {
        console.log(`garbageCollect: ${user.username}`);
        if(this.users[user.username]) {
            console.log('acquiring lock');
            // const release = await this.users[user.username].mutex.acquire()
            this.lockUser(user.username);
            console.log('lock acquired');
            const u = this.users[user.username];
            const game = u.entity.game
            const chatRooms = u.entity.chatRooms;

            console.log(game)

            if(game) {
                this.lockGame(game.title);
                this.rooms[game.title].entity.removePlayer(user.username);
                console.log(`gc ${user.username} in game: ${game.title}`);

                if(this.rooms[game.title].entity.empty()) 
                    delete this.rooms[game.title];

                this.releaseGame(game.title);
            }
            for(const roomName in chatRooms) {
                if(this.chats[roomName]) {
                    this.lockChat(roomName);
                    this.chats[roomName].entity.leave(user);
                    // console.log(`gc ${user.username} in room: ${roomName}`);

                    if(this.chats[roomName].entity.empty()) 
                        delete this.chats[roomName];

                    this.releaseChat(roomName);
                }
            }

            this.releaseUser(user.username);

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