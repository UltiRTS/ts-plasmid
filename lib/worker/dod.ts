import { Game } from "../../db/models/game";
import { CMD, CMD_Autohost_Start_Game, Receipt } from "../interfaces";
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
            resp: Notify('JOINGAME', seq, 'insufficient parameters'),
            type: 'network'
        }
    }

    const GAME_LOCK = RedisStore.LOCK_RESOURCE(gameName, 'game');
    const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');


    try {
        await store.acquireLock(GAME_LOCK);
    } catch {
        console.log('game lock required failed');
        return {
            resp:LockedNotify('JOINGAME', seq),
            type: 'network'
        }
    }

    try {
        await store.acquireLock(USER_LOCK);
    } catch {
        console.log('user lock required failed');
        return {
            resp:LockedNotify('JOINGAME', seq),
            type: 'network'
        }
    }


    let gameRoom = await store.getGame(gameName)
    const user = await store.getUser(caller);

    if(user == null) {
        return {
            resp: Notify('JOINGAME', seq, 'user not found'),
            type: 'network'
        }
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

        return {
            resp: await store.dumpState(caller),
            type: 'network'
        }
    }

    user.game = gameName;
    gameRoom.setPlayer(caller, 'A', false);
    await store.setGame(gameName, gameRoom);
    await store.setUser(caller, user);

    await store.releaseLock(GAME_LOCK);
    await store.releaseLock(USER_LOCK);

    return {
        resp: await store.dumpState(caller),
        type: 'network'
    }
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
    const player = await store.getUser(caller);
    if(player == null) {
        return {
            resp: Notify('STARTGAME', seq, 'player doesn\'t exist'),
            type: 'network'
        }
    }

    const gameName = player.game;
    if(gameName == null) {
        return {
            resp: Notify('STARTGAME', seq, 'joined no game'),
            type: 'network'
        }
    }


    const game = await store.getGame(gameName);
    if(game == null) {
        return {
            resp: Notify('STARTGAME', seq, 'game not found'),
            type: 'network'
        }
    }
    const GAME_LOCK = RedisStore.LOCK_RESOURCE(gameName, 'game');
    try {
        await store.acquireLock(GAME_LOCK);
    } catch(e) {
        return {
            resp: LockedNotify('STARTGAME', seq),
            type: 'network'
        }
    }

    if(game.isStarted) {
        return {
           resp: Notify('STARTGAME', seq, 'game already started'),
           type: 'network'
        }
    }

    if(game.hoster === player.username) {
        game.clearPoll();
        const cmd: CMD_Autohost_Start_Game = {
            to: 'autohost',
            payload: {
                gameConf: game.configureToStart()
            }
        }
        return {
            resp: cmd,
            type: 'cmd'
        }
    } else {
        game.addPoll(caller, 'STARTGAME');
        if(game.getPollCount('STARTGAME') > game.getPlayerCount() / 2) {
            const cmd: CMD_Autohost_Start_Game = {
                to: 'autohost',
                payload: {
                    gameConf: game.configureToStart()
                }
            }
            return {
                resp: cmd,
                type: 'cmd'
            }
        } else {
            return {
                resp: await store.dumpState(caller),
                type: 'network'
            }
        }
    }
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