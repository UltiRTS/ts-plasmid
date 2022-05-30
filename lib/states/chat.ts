import {ChatRoom as DBChatRoom, Chat } from '../../db/models/chat';
import { User } from './user';

export class ChatRoom extends DBChatRoom {
    lastMessage: Chat
    members: string[]

    constructor(chatRoom: DBChatRoom) {
        super()
        this.id = chatRoom.id
        this.chats = [];
        this.roomName = chatRoom.roomName;
        this.password = chatRoom.password;

        this.lastMessage = new Chat();
        this.members = []
    }
    

    say(chat: Chat) {
        this.lastMessage = chat;
    }

    join(user: User) {
        if(this.members.includes(user.username)) return;

        this.members.push(user.username);
    }
}