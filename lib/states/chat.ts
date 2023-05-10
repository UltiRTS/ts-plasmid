import type { Chat } from 'db/models/chat';
import { ChatRoom as DBChatRoom } from 'db/models/chat';
import { businessLogger as logger } from 'lib/logger';

export class ChatRoom extends DBChatRoom {
  lastMessage: { author: string; content: string; time: Date };
  members: string[];

  constructor(chatRoom?: DBChatRoom) {
    super();
    if (chatRoom) {
      this.id = chatRoom.id;
      this.chats = [];
      this.roomName = chatRoom.roomName;
      this.password = chatRoom.password;

      this.lastMessage = { author: '', content: '', time: new Date() };
      this.members = [];
    }
    else {
      this.id = 0;
      this.chats = [];
      this.roomName = '';
      this.password = '';

      this.lastMessage = { author: '', content: '', time: new Date() };
      this.members = [];
    }
  }

  empty() {
    return this.members.length === 0;
  }

  clearChat() {
    this.lastMessage = { author: '', content: '', time: new Date() };
  }

  say(chat: Chat) {
    this.lastMessage = {
      author: chat.author.username,
      content: chat.message,
      time: chat.createAt,
    };
  }

  join(username: string) {
    if (this.members.includes(username))
      return;

    this.members.push(username);
  }

  leave(username: string) {
    if (!this.members.includes(username))
      return;

    this.members.splice(this.members.indexOf(username), 1);
  }

  serialize() {
    return JSON.stringify(this);
  }

  static from(str: string) {
    try {
      return Object.assign(new ChatRoom(), JSON.parse(str)) as ChatRoom;
    }
    catch (e) {
      logger.error(e);
      return null;
    }
  }
}
