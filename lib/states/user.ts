
import {User as DBUser} from '../../db/models/user';
import { GameRoom } from './room';
import { ChatRoom } from './chat';
import { Confirmation } from '../../db/models/confirmation';
import { Confirmation2Dump } from '../interfaces';



export class User extends DBUser  {
    chatRooms: string[] = []
    game: string | null = null
    adventure: string | null = null

    confirmations2dump: Confirmation2Dump[] = []
    friends2dump: string[] = []

    constructor(user?: DBUser) {
        super();
        this.confirmations = [];
        this.friends = [];
        if(user) {
            this.id = user.id;
            this.username = user.username;
            this.accessLevel = user.accessLevel;
            this.exp = user.exp;
            this.sanity = user.sanity;
            this.blocked = user.blocked;
            // clear sensitive fields
            this.hash = "";
            this.salt = "";
            for(const confirmation of user.confirmations) {
                this.confirmations2dump.push(confirmation as Confirmation2Dump)
            }
            for(const friend of user.friends) {
                this.friends2dump.push(friend.username);
            }
        } else {
            this.id = 0;
            this.username = '';
            this.accessLevel = 0;
            this.exp = 0;
            this.sanity = 0;
            this.blocked = false;
            // clear sensitive fields
            this.hash = "";
            this.salt = "";
            this.confirmations = [];
        }
    }

    // update(user: DBUser) {
    //     this.confirmations = user.confirmations;
    //     this.chats = user.chats;
    //     this.friends = user.friends;
    // }

    serialize() {
        return JSON.stringify(this);
    }

    static from(str: string) {
        try {
            // const dbUser = Object.assign(new DBUser(), JSON.parse(str)) as User;
            return Object.assign(new User(), JSON.parse(str)) as User;
        } catch(e) {
            return null;
        }
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

    joinChat(chatName: string) {
        if(this.chatRooms.includes(chatName)) return;
        this.chatRooms.push(chatName);
    }

    leaveChat(chatName: string) {
        if(!this.chatRooms.includes(chatName)) return;

        this.chatRooms.splice(this.chatRooms.indexOf(chatName), 1);
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