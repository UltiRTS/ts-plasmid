/** @format */

import { User as DBUser, Mark as DBMark } from 'db/models/user';
import { Confirmation } from 'db/models/confirmation';
import { Confirmation2Dump, Mark2dump } from 'lib/interfaces';
import { businessLogger as logger } from 'lib/logger'

import { GameRoom } from './room';
import { ChatRoom } from './chat';

export class User extends DBUser {
  chatRooms: string[] = [];
  game: string | null = null;
  adventure: number | null = null;
  marks2dump: Mark2dump[] = [];
  confirmations2dump: Confirmation2Dump[] = [];
  friends2dump: string[] = [];

  constructor(user?: DBUser) {
    super();
    this.confirmations = [];
    this.friends = [];
    if (user) {
      this.id = user.id;
      this.username = user.username;
      this.accessLevel = user.accessLevel;
      this.exp = user.exp;
      // this.sanity = user.sanity;
      this.blocked = user.blocked;
      this.inventory = user.inventory;
      // clear sensitive fields
      this.hash = '';
      this.salt = '';
      for (const confirmation of user.confirmations) {
        this.confirmations2dump.push(confirmation as Confirmation2Dump);
      }
      for (const friend of user.friends) {
        this.friends2dump.push(friend.username);
      }
      for (const mark of user.marks) {
        this.marks2dump.push({
          id: mark.id,
          name: mark.target.username,
          mark: mark.mark,
        });
      }
      let openAdvs = user.adventures
        .filter((adv) => adv.closed === false)
        .sort((a, b) => {
          return a.createAt > b.createAt ? -1 : 1;
        });
      if (openAdvs.length > 0) {
        this.adventure = openAdvs[0].id;
      }
    } else {
      this.id = 0;
      this.username = '';
      this.accessLevel = 0;
      this.exp = 0;
      // this.sanity = 0;
      this.blocked = false;
      // clear sensitive fields
      this.hash = '';
      this.salt = '';
      this.confirmations = [];
      this.adventures = [];
      this.marks = [];
      this.inventory = [];
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
    } catch (e) {
      return null;
    }
  }

  getState() {
    return {
      id: this.id,
      username: this.username,
      accessLevel: this.accessLevel,
      exp: this.exp,
      blocked: this.blocked,
      confiramations: this.confirmations,
      inventory: this.inventory,
    };
  }

  joinChat(chatName: string) {
    if (this.chatRooms.includes(chatName)) return;
    this.chatRooms.push(chatName);
  }

  leaveChat(chatName: string) {
    if (!this.chatRooms.includes(chatName)) return;

    this.chatRooms.splice(this.chatRooms.indexOf(chatName), 1);
  }

  leaveGame() {
    this.game = null;
  }

  claimConfirmation(id: number) {
    for (let i = 0; i < this.confirmations.length; i++) {
      if (this.confirmations[i].id === id) {
        this.confirmations[i].claimed = true;
        console.log(this.confirmations[i]);
      }
    }
  }

  level() {
    return Math.floor(Math.sqrt(this.exp * 20));
  }
}
