
import {User as DBUser} from '../../db/models/user';
import { GameRoom } from './room';
import { ChatRoom } from './chat';


export class User extends DBUser {
    chatRooms: {[key: string]: ChatRoom} = {} 
    game: GameRoom | null = null;

    constructor(user: DBUser) {
        super();
        this.id = user.id;
        this.username = user.username;
        this.accessLevel = user.accessLevel;
        this.exp = user.exp;
        this.sanity = user.sanity;
        this.blocked = user.blocked;
        // clear sensitive fields
        this.hash = "";
        this.salt = "";
        this.confirmations = user.confirmations;
        this.friends = user.friends;
    }

    serialize() {
        return JSON.stringify(this);
    }

    static from(str: string) {
        return JSON.parse(str) as User;
    }

    getState() {
        return {
            id: this.id,
            username: this.username,
            accessLevel: this.accessLevel,
            exp: this.exp,
            sanity: this.sanity,
            blocked: this.blocked,
            confiramations: this.confirmations
        }
    }

    assignChat(chat: ChatRoom) {
        console.log("chat in user:", chat)
        this.chatRooms[chat.roomName] = chat;
    }

    leaveChat(chat: ChatRoom) {
        delete this.chatRooms[chat.roomName];
    }

    assignGame(game: GameRoom) {
        this.game = game;
    }

    leaveGame() {
        this.game = null;
    }

    claimConfirmation(id: number) {
        for(let i=0; i<this.confirmations.length; i++) {
            if(this.confirmations[i].id === id) {
                this.confirmations[i].claimed = true;
                console.log(this.confirmations[i]);
            }
        }
    }
}