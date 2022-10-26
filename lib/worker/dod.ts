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

    const RESOURCE_OCCUPIED = store.GAME_RESOURCE(gameName);
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

        return {
           receiptOf: 'JOINGAME',
           seq,
           status: true,
           message: 'game room created'
        } as Receipt;
    }

    gameRoom.setPlayer(caller, 'A', false);
    await store.setGame(gameName, gameRoom);

    await store.releaseLock(RESOURCE_OCCUPIED);

    return {
        receiptOf: 'JOINGAME',
        seq,
        status: true,
        message: `user ${caller} joined`
    } as Receipt;
}