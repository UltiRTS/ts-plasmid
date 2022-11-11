import { Game } from "../../db/models/game";
import { CMD, CMD_Autohost_Start_Game, Receipt, Wrapped_Message } from "../interfaces";
import { GameRoom } from "../states/room";
import { RedisStore } from "../store";
import { Notify, WrappedCMD, WrappedState } from "../util";
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
        return [Notify('JOINGAME', seq, 'insufficient parameters', caller)];
    }

    const GAME_LOCK = RedisStore.LOCK_RESOURCE(gameName, 'game');
    const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');


    try {
        await store.acquireLock(GAME_LOCK);
    } catch {
        console.log('game lock required failed');
        return [Notify('JOINGAME', seq, 'game lock acquired fail', caller)];
    }

    try {
        await store.acquireLock(USER_LOCK);
    } catch {
        console.log('user lock required failed');
        await store.releaseLock(GAME_LOCK);
        return [Notify('JOINGAME', seq, 'user lock acquired fail', caller)];
    }


    let gameRoom = await store.getGame(gameName)
    const user = await store.getUser(caller);
    console.log(caller);
    console.log(user);

    if(user == null) {
        await store.releaseLock(USER_LOCK);
        await store.releaseLock(GAME_LOCK);
        return [Notify('JOINGAME', seq, 'user not found', caller)];
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

        return [WrappedState('JOINGAME', seq, await store.dumpState(caller), caller)]
    }

    user.game = gameName;
    gameRoom.setPlayer(caller, 'A', false);
    await store.setGame(gameName, gameRoom);
    await store.setUser(caller, user);

    await store.releaseLock(GAME_LOCK);
    await store.releaseLock(USER_LOCK);

    const res: Wrapped_Message[] = [];

    for(const player in gameRoom.players) {
        if(caller !== player)
            res.push(WrappedState('JOINGAME', -1, await store.dumpState(player), player));
    }

    res.push(WrappedState('JOINGAME', seq, await store.dumpState(caller), caller));

    return res;
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
    const gameName = params.gameName;
    const mapId = params.mapId;

    if(gameName == null || mapId == null) {
        return [Notify('SETMAP', seq, 'insufficient parameters', caller)];
    }

    const GAME_LOCK = RedisStore.LOCK_RESOURCE(gameName, 'game');
    try {
        await store.acquireLock(GAME_LOCK);
    } catch(e) {
        return [Notify('SETMAP', seq, 'acquire game lock failed', caller)];
    }

    const game = await store.getGame(gameName);
    if(game == null) {
        await store.releaseLock(GAME_LOCK);
        return [Notify('SETMAP', seq, 'no such game', caller)];
    }

    const poll = 'SETMAP_' + mapId;

    if(game.hoster === caller) {
        game.clearPoll(poll);
        game.setMapId(mapId);

        console.log('map set');
    } else {
        game.addPoll(caller, poll);
        if(game.getPollCount(poll) > game.getPlayerCount() / 2) {
            game.setMapId(mapId);
            console.log('poll added then map set');
        }
        console.log('poll added');
    }

    await store.setGame(gameName, game);
    await store.releaseLock(GAME_LOCK);

    const res: Wrapped_Message[] = [];

    for(const player in game.players) {
        if(caller !== player)
            res.push(WrappedState('JOINGAME', -1, await store.dumpState(player), player));
    }

    res.push(WrappedState('JOINGAME', seq, await store.dumpState(caller), caller));

    await store.releaseLock(GAME_LOCK);
    return res;
}

export async function startGame(params: {
}, seq: number, caller: string) {
    const player = await store.getUser(caller);
    if(player == null) {
        return [Notify('STARTGAME', seq, 'player doesn\'t exist', caller)]
    }

    const gameName = player.game;
    if(gameName == null) {
        return [Notify('STARTGAME', seq, 'joined no game', caller)]
    }


    const game = await store.getGame(gameName);
    if(game == null) {
        return [Notify('STARTGAME', seq, 'game not found', caller)]
    }
    const GAME_LOCK = RedisStore.LOCK_RESOURCE(gameName, 'game');
    try {
        await store.acquireLock(GAME_LOCK);
    } catch(e) {
        return [Notify('STARTGAME', seq, 'game lock acquired failed', caller)]
    }

    if(game.isStarted) {
        await store.releaseLock(GAME_LOCK);
        return [Notify('STARTGAME', seq, 'game already started', caller)]
    }

    if(game.hoster === player.username) {
        if(!game.ready()) {
            const res = [];
            for(const player in game.players) {
                if(caller !== player)
                    res.push(Notify('STARTGAME', -1, 'someone doesn\'t have map', player));
            }
            res.push(Notify('STARTGAME', seq, 'someone doesn\'t have map', caller));

            await store.releaseLock(GAME_LOCK);
            return res;
        }

        game.clearPoll('STARTGAME');
        const cmd: CMD_Autohost_Start_Game = {
            to: 'autohost',
            action: 'STARTGAME',
            payload: {
                gameConf: game.configureToStart()
            }
        }

        const res: Wrapped_Message[] = [];
        for(const player in game.players) {
            if(caller !== player)
                res.push(WrappedState('JOINGAME', -1, await store.dumpState(player), player));
        }
        res.push(
            WrappedCMD('STARTGAME', seq, cmd, 'network', caller, {
                state: await store.dumpState(caller)
            })
        );

        await store.releaseLock(GAME_LOCK);
        return res;

    } else {
        game.addPoll(caller, 'STARTGAME');
        if(game.getPollCount('STARTGAME') > game.getPlayerCount() / 2) {
            if(!game.ready()) {
                const res = [];
                for(const player in game.players) {
                    if(caller !== player)
                        res.push(Notify('STARTGAME', -1, 'someone doesn\'t have map', player));
                }
                res.push(Notify('STARTGAME', seq, 'someone doesn\'t have map', caller));

                await store.releaseLock(GAME_LOCK);
                return res;
            }

            const cmd: CMD_Autohost_Start_Game = {
                to: 'autohost',
                action: 'STARTGAME',
                payload: {
                    gameConf: game.configureToStart()
                }
            }

            const res: Wrapped_Message[] = [];
            for(const player in game.players) {
                if(caller !== player)
                    res.push(WrappedState('JOINGAME', -1, await store.dumpState(player), player));
            }
            res.push(
                WrappedCMD('STARTGAME', seq, cmd, 'network', caller, {
                    state: await store.dumpState(caller)
                })
            );

            await store.releaseLock(GAME_LOCK);
            return res;
        } else {

            const res: Wrapped_Message[] = [];
            for(const player in game.players) {
                if(caller !== player)
                    res.push(WrappedState('JOINGAME', -1, await store.dumpState(player), player));
            }
            res.push(
                WrappedState('STARTGAME', seq, await store.dumpState(caller), caller)
            )
            await store.releaseLock(GAME_LOCK);
            return res;
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
    if(caller == null) {
        return [Notify('LEAVEGAME', seq, 'caller is empty', caller)]
    }

    const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');

    try {
        await store.acquireLock(USER_LOCK);
    } catch(e) {
        return [Notify('LEAVEGAME', seq, 'acquire user lock failed', caller)]
    }

    const user = await store.getUser(caller);
    if(user == null) {
        await store.releaseLock(USER_LOCK);
        return [Notify('LEAVEGAME', seq, 'no such user', caller)];
    }

    if(user.game == null) {
        await store.releaseLock(USER_LOCK);
        return [Notify('LEAVEGAME', seq, 'joined no game', caller)];
    }

    const GAME_LOCK = RedisStore.LOCK_RESOURCE(user.game, 'game');
    try {
        await store.acquireLock(GAME_LOCK);
    } catch(e) {
        await store.releaseLock(USER_LOCK);
        return [Notify('LEAVEGAME', seq, 'acquire game lock failed', caller)]
    }

    const game = await store.getGame(user.game);
    if(game == null) {
        await store.releaseLock(USER_LOCK);
        await store.releaseLock(GAME_LOCK);
        return [Notify('LEAVEGAME', seq, 'no such game', caller)];
    }

    game.removePlayer(caller);
    if(game.empty()) {
        await store.delGame(user.game);
    } else {
        await store.setGame(user.game, game);
    }

    user.game = null;
    await store.setUser(caller, user);

    await store.releaseLock(USER_LOCK);
    await store.releaseLock(GAME_LOCK);

    const res = [];

    for(const player in game.players) {
        if(player === 'caller') continue;

        res.push(WrappedState('LEAVEGAME', seq, await store.dumpState(player), player));
    }

    res.push(WrappedState('LEAVEGAME', seq, await store.dumpState(caller), caller));

    return res;
}

export async function hasMap(params: {
    mapId?: number
    [key:string]: any
}, seq: number, caller: string) {
    const mapId = params.mapId;
    if(mapId == null) {
        return [Notify('LEAVEGAME', seq, 'empty map id', caller)]
    }

    if(caller == null) {
        return [Notify('LEAVEGAME', seq, 'caller is empty', caller)]
    }

    const user = await store.getUser(caller);
    if(user == null) {
        return [Notify('LEAVEGAME', seq, 'no such user', caller)];
    }

    if(user.game == null) {
        return [Notify('LEAVEGAME', seq, 'joined no game', caller)];
    }

    const GAME_LOCK = RedisStore.LOCK_RESOURCE(user.game, 'game');
    try {
        await store.acquireLock(GAME_LOCK);
    } catch(e) {
        return [Notify('LEAVEGAME', seq, 'acquire game lock failed', caller)]
    }

    const game = await store.getGame(user.game);
    if(game == null) {
        await store.releaseLock(GAME_LOCK);
        return [Notify('LEAVEGAME', seq, 'no such game', caller)];
    }

    if(game.mapId == mapId) {
        game.hasMap(caller);
    } else {
        return [Notify('LEAVEGAME', seq, 'map id not correct', caller)];
    }

    await store.setGame(user.game, game);
    await store.releaseLock(GAME_LOCK);

    const res = [];
    for(const player in game.players) {
        res.push(WrappedState('HASMAP', -1, await store.dumpState(player), player));
    }

    return res;
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