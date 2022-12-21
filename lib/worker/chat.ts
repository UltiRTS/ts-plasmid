import { Receipt } from "../interfaces";
import { ChatRoom } from "../states/chat";
import { Chat, ChatRoom as DBChatRoom } from "../../db/models/chat";
import { RedisStore } from "../store";
import { Notify, WrappedState } from "../util";
import { store, chatRepo, userRepo } from "./shared";


export async function joinChatRoomHandler(params: {
    chatName?: string
    password?: string
}, seq: number, caller: string) {
    const room = params.chatName;
    let password = params.password;

    if(room == null) {
        return [Notify('JOINCHAT', seq, 'room has no name', caller)];
    }

    if(password == null) password = '';

    let chatRoom = await store.getChat(room);
    let newRoom = false;

    if(chatRoom == null) {
        let dbChatRoom = new DBChatRoom();
        dbChatRoom.roomName = room;
        dbChatRoom.chats = [];
        dbChatRoom.password = password;
        dbChatRoom = await chatRepo.save(dbChatRoom);

        console.log('constructing chat');
        chatRoom = new ChatRoom(dbChatRoom);  
        newRoom = true;
    } else {
        if(password !== chatRoom.password) {
            return [Notify('JOINCHAT', seq, 'wrong password', caller)];
        }
    }

    const user = await store.getUser(caller);
    if(user == null) {
        return [Notify('JOINCHAT', seq, 'no such user', caller)];
    }


    const CHAT_LOCK = RedisStore.LOCK_RESOURCE(room, 'chat');
    const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');

    try {
        await store.acquireLock(CHAT_LOCK);
    } catch(e) {
        return [Notify('JOINCHAT', seq, 'acquire chat lock failed', caller)];
    }

    try {
        await store.acquireLock(USER_LOCK);
    } catch(e) {
        await store.releaseLock(CHAT_LOCK);
        return [Notify('JOINCHAT', seq, 'acquire user lock failed', caller)];
    }

    chatRoom.join(caller);
    await store.setChat(room, chatRoom);

    user.joinChat(room);
    await store.setUser(caller, user);

    await store.releaseLock(CHAT_LOCK);
    await store.releaseLock(USER_LOCK);

    const res = [];
    for(const member of chatRoom.members) {
        if(member === caller) continue;

        res.push(WrappedState('JOINCHAT', -1, await store.dumpState(member), member));
    }

    res.push(WrappedState('JOINCHAT', seq, await store.dumpState(caller), caller, newRoom?['client', 'all']:['client']));

    return res;
}

export async function leaveChatRoomHandler(params: {
    chatName?: string
}, seq: number, caller: string) {
    const room = params.chatName;

    if(room == null) {
        return [Notify('LEAVECHAT', seq, 'room has no name', caller)];
    }

    let chatRoom = await store.getChat(room);

    if(chatRoom == null) {
        return [Notify('LEAVECHAT', seq, 'no such room', caller)];
    }

    const user = await store.getUser(caller);
    if(user == null) {
        return [Notify('LEAVECHAT', seq, 'no such user', caller)];
    }

    const CHAT_LOCK = RedisStore.LOCK_RESOURCE(room, 'chat');
    const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');

    try {
        await store.acquireLock(CHAT_LOCK);
    } catch(e) {
        return [Notify('LEAVECHAT', seq, 'acquire chat lock failed', caller)];
    }

    try {
        await store.acquireLock(USER_LOCK);
    } catch(e) {
        await store.releaseLock(CHAT_LOCK);
        return [Notify('LEAVECHAT', seq, 'acquire user lock failed', caller)];
    }

    chatRoom.leave(caller);
    user.leaveChat(room);

    await store.setUser(caller, user);
    console.log('leave chat: ', chatRoom);

    if(!chatRoom.empty()) {
        await store.setChat(room, chatRoom);
    } else {
        await store.delChat(room);
    }

    await store.releaseLock(CHAT_LOCK);
    await store.releaseLock(USER_LOCK);

    const res = [];
    for(const member of chatRoom.members) {
        if(member === caller) continue;

        res.push(WrappedState('LEAVECHAT', -1, await store.dumpState(member), member));
    }

    res.push(WrappedState('LEAVECHAT', seq, await store.dumpState(caller), caller, chatRoom.empty()?['client', 'all']:['client']));

    return res;
}

export async function sayChatHandler(params: {
    chatName?: string
    message?: string
}, seq: number, caller: string) {
    const room = params.chatName;
    const message = params.message;

    if(room == null || message == null) {
        return [Notify('SAYCHAT', seq, 'insufficient parameter', caller)];
    }

    let chatRoom = await store.getChat(room);

    if(chatRoom == null) {
        return [Notify('SAYCHAT', seq, 'no such room', caller)];
    }

    if(!chatRoom.members.includes(caller)) {
        return [Notify('SAYCHAT', seq, 'not a member of the chat', caller)];
    }

    const user = await userRepo.findOne({
        where: {
            username: caller
        }
    })

    console.log('id of chat:', chatRoom.id);
    const dbChatRoom = await chatRepo.findOne({
        where: {
            id: chatRoom.id 
        },
        relations: {
            chats: true
        }
    })

    if(user == null) {
        return [Notify('SAYCHAT', seq, 'no such user', caller)];
    }
    if(dbChatRoom == null) {
        return [Notify('SAYCHAT', seq, 'chat room not in db', caller)];
    }

    const CHAT_LOCK = RedisStore.LOCK_RESOURCE(room, 'chat');

    try {
        await store.acquireLock(CHAT_LOCK);
    } catch(e) {
        return [Notify('SAYCHAT', seq, 'acquire chat lock failed', caller)];
    }


    const chat = new Chat(); 
    chat.author = user;
    chat.message = message;
    chat.room = dbChatRoom;
    chat.createAt = new Date();

    dbChatRoom.chats = [ ...dbChatRoom.chats, chat ];

    chatRepo.save(dbChatRoom);
    chatRoom.say(chat);
    await store.setChat(room, chatRoom);
    console.log('saychat: ', chatRoom);

    const res = [];
    for(const member of chatRoom.members) {
        if(member === caller) continue;

        res.push(WrappedState('SAYCHAT', -1, await store.dumpState(member), member));
    }

    res.push(WrappedState('SAYCHAT', seq, await store.dumpState(caller), caller));

    chatRoom.clearChat();

    await store.setChat(room, chatRoom);
    await store.releaseLock(CHAT_LOCK);


    return res;
}