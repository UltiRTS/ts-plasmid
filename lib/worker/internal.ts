import { confirmRepo, store, userRepo } from "./shared";
import { Notify, WrappedState, userLevel } from "../util";
import { RedisStore } from "../store";
import { Confirmation } from "../../db/models/confirmation";
import {Confirmation2Dump, ConfirmationContentAdvRecruit} from '../interfaces';

export async function gameStartedHandler(params: {
    gameName?: string
    autohost?: string
    port?: number
    id?: number
}) {
    const gameName = params.gameName;
    const autohost = params.autohost;
    const port = params.port;
    const id = params.id;

    if(gameName == null || autohost == null || port == null || id == null) {
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
    game.id = id;

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

export async function midJoinedHandler(parmas: {
    title?: string
    player?: string
}) {
    const player = parmas.player;
    if(player == null) return [];

    return [WrappedState('MIDJOINED', -1, await store.dumpState(player), player)]
}

export async function interalRecruitPpl4Adventure(params: {
    advId?: number
    friendName?: string
    firstTime?: boolean
    caller?: string
    [key: string]: any
}) {
    const friendName = params.friendName;
    const advId = params.advId;

    let seq = -1;
    let caller = params.caller;
    if(caller == null) caller = 'internal';

    let firstTime = params.firstTime;
    if(firstTime == null) {
        firstTime = true;
    }

    if(friendName == null || advId == null) {
        return [Notify('ADV_RECRUIT', seq, 'insufficient parameters', caller)];
    }

    const adventure = await store.getAdventure(advId);
    const friend = await userRepo.findOne({
        where: {
            username: friendName
        },
        relations: {
            confirmations: true
        }
    })

    if(friend == null || adventure == null) {
        return [Notify('ADV_RECRUIT', seq, 'adventure, user may not exist', caller)];
    }

    const ADV_LOCK = RedisStore.LOCK_RESOURCE(String(advId), 'adv');
    const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');
    const locks = [ADV_LOCK, USER_LOCK];

    try {
        await store.acquireLocks(locks);
    } catch {
        return [Notify('ADV_RECRUIT', seq, 'adventure, user lock acquired fail', caller)];
    }

    adventure.recruit(friendName, {
        level: userLevel(friend.exp),
        cost: true,
    });

    const confirmContent = {
        type: 'adv_recruit',
        recruiter: caller,
        advId,
        firstTime
    } as ConfirmationContentAdvRecruit

    let confirmation = new Confirmation()
    confirmation.payload = JSON.stringify(confirmContent);
    confirmation.claimed = false;
    confirmation.text = `${caller} has requested to recruit you to ${advId}`
    confirmation.type = 'adv_recruit'
    confirmation.user = friend;

    friend.confirmations = [...friend.confirmations, confirmation];

    await userRepo.save(friend);
    await confirmRepo.save(confirmation);

    await store.releaseLocks(locks);

    const friendIncache = await store.getUser(friendName);
    if(friendIncache !== null) {
        friendIncache.confirmations2dump = [...friendIncache.confirmations2dump, {
            id: confirmation.id,
            text: confirmation.text,
            type: confirmation.type,
            payload: confirmation.payload,
            claimed: confirmation.claimed,
        } as Confirmation2Dump]
        await store.setUser(friendName, friendIncache);
    }

    // invalidate recruit message after 15min
    setTimeout(async () => {
        let retry = 3;
        while(retry > 0) {
            try {
                await store.acquireLocks(locks);
            } catch(e) {
                retry--;
                continue;
            }
            const adventure =  await store.getAdventure(advId);
            if(adventure) {
                if(!adventure.members().includes(friendName)) {
                    adventure.derecruit(friendName, {
                        level: userLevel(friend.exp),
                        refund: firstTime?true:false
                    });
                    await store.setAdventure(advId, adventure);
                }
            }

            await store.releaseLocks(locks);
            break;
        }
    }, 15 * 60 * 1000);

    return [WrappedState('ADV_RECRUIT', -1, await store.dumpState(friendName), friendName)];
}