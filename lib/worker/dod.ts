import { Game } from "../../db/models/game";
import { Receipt } from "../interfaces";
import { GameRoom } from "../states/room";
import { RedisStore } from "../store";
import { LockedNotify, Notify } from "../util";
import { store } from "./shared";

export async function joinGameHandler(params: {
    gameName?: string,
    password?: string,
    mapId?: number,
    [key:string]: any

}, seq: number, caller: string) {
    const gameName = params.gameName;
    const password = params.password;
    const mapId = params.mapId;

    if(gameName == null || password == null || mapId == null) {
        return {
           receiptOf: 'JOINGAME',
           seq,
           status: false,
           message: 'insufficient parameters'
        } as Receipt;
    }

    const GAME_LOCK = RedisStore.LOCK_RESOURCE(gameName, 'game');
    const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');


    try {
        await store.acquireLock(GAME_LOCK);
    } catch {
        console.log('game lock required failed');
        return LockedNotify('JOINGAME', seq);
    }

    try {
        await store.acquireLock(USER_LOCK);
    } catch {
        console.log('user lock required failed');
        return LockedNotify('JOINGAME', seq);
    }


    let gameRoom = await store.getGame(gameName)
    const user = await store.getUser(caller);

    if(user == null) {
        return Notify('JOINGAME', seq, 'user not found');
    }

    if(gameRoom == null) {
        gameRoom = new GameRoom(gameName, caller, mapId)
        gameRoom.password = password;
        user.game = gameName;

        gameRoom.setPlayer(caller, 'A', false);

        await store.setGame(gameName, gameRoom);
        await store.setUser(caller, user);

        await store.releaseLock(GAME_LOCK);
        await store.releaseLock(USER_LOCK);

        return await store.dumpState(caller);
    }

    user.game = gameName;
    gameRoom.setPlayer(caller, 'A', false);
    await store.setGame(gameName, gameRoom);
    await store.setUser(caller, user);

    await store.releaseLock(GAME_LOCK);
    await store.releaseLock(USER_LOCK);

    return await store.dumpState(caller);
}

export async function setTeam(params: {
    gameName?: string
    player?: string
    team?: string
    [key:string]: any
}, seq: number, caller: string) {
   return { } as Receipt;
}

export async function setMap(params: {
    gameName?: string
    mapId?: number
    [key:string]: any
}, seq: number, caller: string) {
   return { } as Receipt;
}

export async function startGame(params: {
}, seq: number, caller: string) {
   return { } as Receipt;
}

export async function setSpec(params: {
    gameName?: string
    player?: string
    [key:string]: any
}, seq: number, caller: string) {
   return { } as Receipt;
}

export async function leaveGame(params: {
}, seq: number, caller: string) {
   return { } as Receipt;

}

export async function hasMap(params: {
    mapId?: number
    [key:string]: any
}, seq: number, caller: string) {
   return { } as Receipt;
}

export async function midJoin(params: {
}, seq: number, caller: string) {
   return { } as Receipt;
}

export async function killEngine(params: {
}, seq: number, caller: string) {
   return { } as Receipt;
}

export async function setMod(params: {
    mod?: string
}, seq: number, caller: string) {
   return { } as Receipt;
}

export async function setAI(params: {
    gameName?: string
    AI?: string
    type?: string
    [key:string]: any
}, seq: number, caller: string) {

   return { } as Receipt;
}

export async function delAI(params: {
    gameName?: string
    AI?: string
    type?: string
    [key:string]: any
}, seq:number, caller: string) {
   return { } as Receipt;
}