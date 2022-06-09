import {ChatRoom as DBChatRoom, Chat } from '../../db/models/chat';
import { User } from './user';

export class ChatRoom extends DBChatRoom {
    lastMessage: {author: string, content: string, time: Date};
    members: string[]

    constructor(chatRoom?: DBChatRoom);
    constructor(chatRoom: DBChatRoom) {
        super()
        this.id = chatRoom.id
        this.chats = [];
        this.roomName = chatRoom.roomName;
        this.password = chatRoom.password;

        this.lastMessage = {author: '', content: '', time: new Date()};
        this.members = []
    }

    empty() {
        return this.members.length === 0
    }
    

    say(chat: Chat) {
        this.lastMessage = {
            author: chat.author.username,
            content: chat.message,
            time: chat.createAt
        }
    }

    join(user: User) {
        if(this.members.includes(user.username)) return;

        this.members.push(user.username);
    }
    leave(user: User) {
        if(!this.members.includes(user.username)) return;

        this.members.splice(this.members.indexOf(user.username), 1);
    }
}