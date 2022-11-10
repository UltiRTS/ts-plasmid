import { store } from "./shared";
import { Notify, WrappedState } from "../util";
import { RedisStore } from "../store";

export async function gameStartedHandler(params: {
    gameName?: string
    autohost?: string
    port?: number
}) {
    const gameName = params.gameName;
    const autohost = params.autohost;
    const port = params.port;

    if(gameName == null || autohost == null || port == null) {
        return []
    }

    const GAME_LOCK = RedisStore.LOCK_RESOURCE(gameName, 'game');
    
    try {
        await store.acquireLock(GAME_LOCK);
    } catch(e) {
        console.log('internal: trying to acquire lock failed');
        return []
    }

    const game = await store.getGame(gameName);
    if(game == null) {
        await store.releaseLock(GAME_LOCK);
        return []
    }

    game.autohostPort = port;
    game.responsibleAutohost = autohost;
    game.isStarted = true;

    await store.setGame(gameName, game);
    await store.releaseLock(GAME_LOCK);


    const players = Object.keys(game.players);

    const res = [];
    for(const player of players) {
        res.push(WrappedState('GAMESTARTED', -1, await store.dumpState(player), player));
    }

    return res;
}

export async function gameEndedHandler(params: {
    gameName?: string
}) {
    const gameName = params.gameName;
    if(gameName == null) {
        return []
    }

    const GAME_LOCK = RedisStore.LOCK_RESOURCE(gameName, 'game');
    try {
        await store.acquireLock(GAME_LOCK);
    } catch(e) {
        console.log('interal: trying to acquire lock failed');
        return []
    }

    const game = await store.getGame(gameName);
    if(game == null) {
        await store.releaseLock(GAME_LOCK);
        return []
    }

    game.isStarted = false;

    await store.setGame(gameName, game);
    await store.releaseLock(GAME_LOCK);

    const players = Object.keys(game.players);

    const res = [];
    for(const player of players) {
        res.push(WrappedState('GAMEENDED', -1, await store.dumpState(player), player));
    }

    return res;
}