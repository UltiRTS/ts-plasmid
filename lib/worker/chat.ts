import { Receipt } from "../interfaces";
import { ChatRoom } from "../states/chat";
import { RedisStore } from "../store";

const store = new RedisStore();

export async function joinChatRoomHandler(params: {
    room: string
    password: string
}, seq: number, caller: string) {
    return {} as Receipt;
}

export async function leaveChatRoomHandler(params: {
    room: string
}, seq: number, caller: string) {

    return {} as Receipt;
}

export async function sayChat(params: {
    room: string
    message: string
}, seq: number, caller: string) {
    return {} as Receipt;
}