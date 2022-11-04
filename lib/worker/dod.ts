import { Game } from "../../db/models/game";
import { Receipt } from "../interfaces";
import { GameRoom } from "../states/room";
import { RedisStore } from "../store";
import { LockedNotify } from "../util";

const store = new RedisStore();

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

    const RESOURCE_OCCUPIED = RedisStore.GAME_RESOURCE(gameName);

    try {
        await store.acquireLock(RESOURCE_OCCUPIED);
    } catch {
        return LockedNotify('JOINGAME', seq);
    }


    let gameRoom = await store.getGame(gameName)

    if(gameRoom == null) {
        gameRoom = new GameRoom(gameName, caller, mapId)
        gameRoom.password = password;

        await store.setGame(gameName, gameRoom);

        await store.releaseLock(RESOURCE_OCCUPIED);

        return await store.dumpState(caller);
    }

    gameRoom.setPlayer(caller, 'A', false);
    await store.setGame(gameName, gameRoom);

    await store.releaseLock(RESOURCE_OCCUPIED);

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