import { Game } from "../../db/models/game";
import { CMD, CMD_Autohost_Kill_Engine, CMD_Autohost_Midjoin, CMD_Autohost_Start_Game, Receipt, Wrapped_Message } from "../interfaces";
import { GameRoom } from "../states/room";
import { RedisStore } from "../store";
import { Notify, WrappedCMD, WrappedState, sleep } from "../util";
import { store } from "./shared";
import { threadId } from "worker_threads";
import { businessLogger as logger } from "@/lib/logger";

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

    const res: Wrapped_Message[] = [];
    const locks = [GAME_LOCK, USER_LOCK];

    try {
        await store.acquireLocks(locks);
        // await store.acquireLock(USER_LOCK);
        // try {
        //     await store.acquireLock(GAME_LOCK);
        // } catch(e) {
        //     await store.releaseLock(USER_LOCK);
        //     return [Notify('JOINGAME', seq, 'joingame lock acquired fail', caller)];
        // }
        // logger.info(`thread-${threadId} join game locks acquired`)
    } catch(e) {
        return [Notify('JOINGAME', seq, 'joingame lock acquired fail', caller)];
    }

    // logger.info(`thread-${threadId} join game locks released`)

    let gameRoom = await store.getGame(gameName)
    const user = await store.getUser(caller);

    if(user == null) {
        await store.releaseLocks(locks);
        return [Notify('JOINGAME', seq, 'user not found', caller)];
    }

    if(gameRoom == null) {
        gameRoom = new GameRoom(gameName, caller, mapId)
        gameRoom.password = password;
    }

    user.game = gameName;
    gameRoom.setPlayer(caller, 'A');
    await store.setGame(gameName, gameRoom);
    await store.setUser(caller, user);

    await store.releaseLocks(locks);

    for(const player in gameRoom.players) {
        if(caller !== player)
            res.push(WrappedState('JOINGAME', -1, await store.dumpState(player), player));
    }
    res.push(WrappedState('JOINGAME', seq, await store.dumpState(caller), caller, ['client', 'all']));

    return res;
}

export async function setTeam(params: {
    gameName?: string
    player?: string
    team?: string
    [key:string]: any
}, seq: number, caller: string) {
    const gameName = params.gameName;
    const player = params.player;
    const team = params.team;

    if(gameName == null || player == null || team == null) {
        return [Notify('SETTEAM', seq, 'insufficient parameter', caller)];
    }

    const GAME_LOCK = RedisStore.LOCK_RESOURCE(gameName, 'game');

    try {
        await store.acquireLock(GAME_LOCK);
    } catch(e) {
        return [Notify('SETTEAM', seq, 'acquire game lock failed', caller)];
    }

    const game = await store.getGame(gameName);
    if(game == null) {
        await store.releaseLock(GAME_LOCK);
        return [Notify('SETTEAM', seq, 'no such game', caller)];
    }

    const poll = 'SETTEAM_' + player + team;
    if(game.hoster === caller) {
        game.clearPoll(poll);
        game.setPlayer(player, team);
    } else {
        game.addPoll(caller, poll);
        if(game.getPollCount(poll) > game.getPlayerCount()/2) {
            game.clearPoll(poll);
            game.setPlayer(player, team);
        }
    }

    await store.setGame(gameName, game);
    await store.releaseLock(GAME_LOCK);

    const res = [];
    for(const player in game.players) {
        if(player === caller) continue;
        res.push(WrappedState('SETTEAM', -1, await store.dumpState(player), player));
    }

    res.push(WrappedState('SETTEAM', seq, await store.dumpState(caller), caller));

    return res;
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

        logger.info('map set');
    } else {
        game.addPoll(caller, poll);
        if(game.getPollCount(poll) > game.getPlayerCount() / 2) {
            game.clearPoll(poll);
            game.setMapId(mapId);
        }
        logger.info('poll added');
    }

    await store.setGame(gameName, game);
    await store.releaseLock(GAME_LOCK);

    const res: Wrapped_Message[] = [];

    for(const player in game.players) {
        if(caller !== player)
            res.push(WrappedState('SETMAP', -1, await store.dumpState(player), player));
    }

    res.push(WrappedState('SETMAP', seq, await store.dumpState(caller), caller));

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
        logger.error(`acquire game lock faild ${e}`)
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
                res.push(WrappedState('STARTGAME', -1, await store.dumpState(player), player));
        }
        res.push(
            WrappedCMD('STARTGAME', seq, cmd, 'client', caller, {
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
                    res.push(WrappedState('STARTGAME', -1, await store.dumpState(player), player));
            }
            res.push(
                WrappedCMD('STARTGAME', seq, cmd, 'client', caller, {
                    state: await store.dumpState(caller)
                })
            );

            await store.releaseLock(GAME_LOCK);
            return res;
        } else {

            const res: Wrapped_Message[] = [];
            for(const player in game.players) {
                if(caller !== player)
                    res.push(WrappedState('STARTGAME', -1, await store.dumpState(player), player));
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
    const gameName = params.gameName;
    const player = params.player;

    if(gameName == null || player == null) {
        return [Notify('SETSPEC', seq, 'insufficient parameter', caller)];
    }

    const GAME_LOCK = RedisStore.LOCK_RESOURCE(gameName, 'game');

    try {
        await store.acquireLock(GAME_LOCK);
    } catch(e) {
        return [Notify('SETSPEC', seq, 'acquire game lock failed', caller)];
    }

    const game = await store.getGame(gameName);
    if(game == null) {
        await store.releaseLock(GAME_LOCK);
        return [Notify('SETSPEC', seq, 'no such game', caller)];
    }

    const poll = 'SETSPEC_' + player;
    if(game.hoster === caller) {
        game.clearPoll(poll);
        game.setSpec(player);
    } else {
        game.addPoll(caller, poll);
        if(game.getPollCount(poll) > game.getPlayerCount()/2) {
            game.clearPoll(poll);
            game.setSpec(player);
        }
    }

    await store.setGame(gameName, game);
    await store.releaseLock(GAME_LOCK);

    const res = [];
    for(const player in game.players) {
        if(player === caller) continue;
        res.push(WrappedState('SETSPEC', -1, await store.dumpState(player), player));
    }

    res.push(WrappedState('SETSPEC', seq, await store.dumpState(caller), caller));

    return res;
}

export async function leaveGame(params: {
}, seq: number, caller: string) {
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

    const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');
    const GAME_LOCK = RedisStore.LOCK_RESOURCE(user.game, 'game');

    const locks = [GAME_LOCK, USER_LOCK];

    try {
        await store.acquireLocks(locks);
    } catch(e) {
        return [Notify('LEAVEGAME', seq, 'acquire leavegame lock failed', caller)]
    }

    const game = await store.getGame(user.game);
    if(game == null) {
        await store.releaseLocks(locks);
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

    await store.releaseLocks(locks);

    const res = [];

    for(const player in game.players) {
        if(player === caller) continue;

        res.push(WrappedState('LEAVEGAME', -1, await store.dumpState(player), player));
    }

    if(!game.empty()) res.push(WrappedState('LEAVEGAME', seq, await store.dumpState(caller), caller));
    else res.push(WrappedState('LEAVEGAME', seq, await store.dumpState(caller), caller, ['client', 'all']));

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
        await store.releaseLock(GAME_LOCK);
        return [Notify('LEAVEGAME', seq, 'map id not correct', caller)];
    }

    await store.setGame(user.game, game);
    await store.releaseLock(GAME_LOCK);

    const res = [];
    for(const player in game.players) {
        if(player == caller) continue;
        res.push(WrappedState('HASMAP', -1, await store.dumpState(player), player));
    }

    res.push(WrappedState('HASMAP', seq, await store.dumpState(caller), caller));

    return res;
}

export async function midJoin(params: {
    [key:string]: any
}, seq: number, caller: string) {

    if(caller == null) {
        return [Notify('MIDJOIN', seq, 'caller not exists', caller)];
    }

    const user = await store.getUser(caller);
    if(user == null) {
        return [Notify('MIDJOIN', seq, 'user not exists', caller)];
    }

    if(user.game == null) {
        return [Notify('MIDJOIN', seq, 'joined no game', caller)];
    }

    const gameName = user.game;

    const game = await store.getGame(gameName);
    if(game == null) {
        return [Notify('MIDJOIN', seq, 'no such game', caller)];
    }

    if(!game.isStarted) {
        return [Notify('MIDJOIN', seq, 'game not started', caller)];
    }

    const cmd: CMD_Autohost_Midjoin = {
        to: 'autohost',
        action: 'MIDJOIN',
        payload: {
            playerName: caller,
            isSpec: game.players[caller].isSpec,
            token: game.engineToken,
            team: game.players[caller].team,
            id: game.id,
            title: game.title
        }
    }

    const res = [WrappedCMD('MIDJOIN', seq, cmd, 'client', caller, {
        state: await store.dumpState(caller)
    })];

    return res;
}

export async function killEngine(params: {
}, seq: number, caller: string) {
    if(caller == null) {
        return [Notify('KILLENGINE', seq, 'caller not exists', caller)];
    }

    const user = await store.getUser(caller);
    if(user == null) {
        return [Notify('KILLENGINE', seq, 'user not exists', caller)];
    }

    if(user.game == null) {
        return [Notify('KILLENGINE', seq, 'joined no game', caller)];
    }

    const gameName = user.game;

    const game = await store.getGame(gameName);
    if(game == null) {
        return [Notify('KILLENGINE', seq, 'no such game', caller)];
    }

    if(!game.isStarted) {
        return [Notify('KILLENGINE', seq, 'game not started', caller)];
    }

    if(game.hoster !== caller) {
        return [Notify('KILLENGINE', seq, 'low privilege', caller)];
    }

    const cmd: CMD_Autohost_Kill_Engine = {
        to: 'autohost',
        action: 'KILLENGINE',
        payload: {
            title: game.title,
            id: game.id
        }
    }

    const res = [WrappedCMD('MIDJOIN', seq, cmd, 'client', caller, {
        state: await store.dumpState(caller)
    })];

    return res;
}

export async function setMod(params: {
    mod?: string
    [key: string]: any
}, seq: number, caller: string) {
    const mod = params.mod;

    if(mod == null) {
        return [Notify('SETMOD', seq, 'insufficient parameter', caller)];
    }

    if(caller == null) {
        return [Notify('SETMOD', seq, 'caller not exists', caller)];
    }

    const user = await store.getUser(caller);
    if(user == null) {
        return [Notify('SETMOD', seq, 'user not exists', caller)];
    }

    if(user.game == null) {
        return [Notify('SETMOD', seq, 'joined no game', caller)];
    }

    const gameName = user.game;

    const GAME_LOCK = RedisStore.LOCK_RESOURCE(gameName, 'game');

    try {
        await store.acquireLock(GAME_LOCK);
    } catch(e) {
        return [Notify('SETMOD', seq, 'acquire game lock failed', caller)];
    }

    const game = await store.getGame(gameName);
    if(game == null) {
        await store.releaseLock(GAME_LOCK);
        return [Notify('SETMOD', seq, 'no such game', caller)];
    }

    const poll = 'SETMOD_' + mod;
    if(game.hoster === caller) {
        game.clearPoll(poll);
        game.setMod(mod);
    } else {
        game.addPoll(caller, poll);
        if(game.getPollCount(poll) > game.getPlayerCount()/2) {
            game.clearPoll(poll);
            game.setMod(mod);
        }
    }

    await store.setGame(gameName, game);
    await store.releaseLock(GAME_LOCK);

    const res = [];
    for(const player in game.players) {
        if(player === caller) continue;
        res.push(WrappedState('SETMOD', -1, await store.dumpState(player), player));
    }

    res.push(WrappedState('SETMOD', seq, await store.dumpState(caller), caller));

    return res;
}

export async function setAI(params: {
    gameName?: string
    AI?: string
    type?: string
    team?: string
    [key:string]: any
}, seq: number, caller: string) {
    const gameName = params.gameName;
    const AI = params.AI;
    const type = params.type;
    const team = params.team;

    if(gameName == null || AI == null || type == null || team == null) {
        return [Notify('SETAI', seq, 'insufficient parameter', caller)];
    }

    const GAME_LOCK = RedisStore.LOCK_RESOURCE(gameName, 'game');

    try {
        await store.acquireLock(GAME_LOCK);
    } catch(e) {
        return [Notify('SETAI', seq, 'acquire game lock failed', caller)];
    }

    const game = await store.getGame(gameName);
    if(game == null) {
        await store.releaseLock(GAME_LOCK);
        return [Notify('SETAI', seq, 'no such game', caller)];
    }

    const poll = 'SETAI_' + AI;
    if(game.hoster === caller) {
        game.clearPoll(poll);
        if(type.toLowerCase() === 'ai') {
            game.setAI(AI, team);
        } else if(type.toLowerCase() === 'chicken') {
            game.setChicken(AI, team);
        }
    } else {
        game.addPoll(caller, poll);
        if(game.getPollCount(poll) > game.getPlayerCount()/2) {
            game.clearPoll(poll);
            if(type.toLowerCase() === 'ai') {
                game.setAI(AI, team);
            } else if(type.toLowerCase() === 'chicken') {
                game.setChicken(AI, team);
            }
        }
    }

    await store.setGame(gameName, game);
    await store.releaseLock(GAME_LOCK);

    const res = [];
    for(const player in game.players) {
        if(player === caller) continue;
        res.push(WrappedState('SETAI', -1, await store.dumpState(player), player));
    }

    res.push(WrappedState('SETAI', seq, await store.dumpState(caller), caller));

    return res;
}

export async function delAI(params: {
    gameName?: string
    AI?: string
    type?: string
    [key:string]: any
}, seq:number, caller: string) {
    const gameName = params.gameName;
    const AI = params.AI;
    const type = params.type;

    if(gameName == null || AI == null || type == null) {
        return [Notify('DELAI', seq, 'insufficient parameter', caller)];
    }

    const GAME_LOCK = RedisStore.LOCK_RESOURCE(gameName, 'game');

    try {
        await store.acquireLock(GAME_LOCK);
    } catch(e) {
        return [Notify('DELAI', seq, 'acquire game lock failed', caller)];
    }

    const game = await store.getGame(gameName);
    if(game == null) {
        await store.releaseLock(GAME_LOCK);
        return [Notify('DELAI', seq, 'no such game', caller)];
    }

    const poll = 'DELAI_' + AI;
    if(game.hoster === caller) {
        game.clearPoll(poll);
        if(type.toLowerCase() === 'ai') {
            game.removeAI(AI);
        } else if(type.toLowerCase() === 'chicken') {
            game.removeChicken(AI);
        }
    } else {
        game.addPoll(caller, poll);
        if(game.getPollCount(poll) > game.getPlayerCount()/2) {
            game.clearPoll(poll);
            if(type.toLowerCase() === 'ai') {
                game.removeAI(AI);
            } else if(type.toLowerCase() === 'chicken') {
                game.removeChicken(AI);
            }
        }
    }

    await store.setGame(gameName, game);
    await store.releaseLock(GAME_LOCK);

    const res = [];
    for(const player in game.players) {
        if(player === caller) continue;
        res.push(WrappedState('DELAI', -1, await store.dumpState(player), player));
    }

    res.push(WrappedState('DELAI', seq, await store.dumpState(caller), caller));

    return res;
}