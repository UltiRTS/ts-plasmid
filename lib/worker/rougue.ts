import { Adventure } from "../states/rougue/adventure";
import {Adventure as DBAdventure} from '../../db/models/adventure';
import { Notify, WrappedCMD, WrappedState } from "../util";
import { RedisStore } from "../store";
import { store } from "./shared";
import { randomInt } from "crypto";
import { CMD_Adventure_recruit, Wrapped_Message } from "../interfaces";

import { advRepo } from "./shared";

export async function joinAdventureHandler(params: {
    advId?: number
    [key: string]: any
}, seq: number, caller: string) {
    const advId = params.advId;

    if(advId == null) {
        return [Notify('ADV_JOIN', seq, 'insufficient parameters', caller)];
    }

    const ADV_LOCK = RedisStore.LOCK_RESOURCE(String(advId), 'adv');
    const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');

    const locks = [ADV_LOCK, USER_LOCK];


    try {
        await store.acquireLocks(locks);
    } catch {
        return [Notify('ADV_JOIN', seq, 'adventure, user lock acquired fail', caller)];
    }

    const user = await store.getUser(caller);

    if(user == null) {
        await store.releaseLocks(locks);
        return [Notify('ADV_JOIN', seq, 'user not found', caller)];
    }

    const adventure = await store.getAdventure(advId);

    if(adventure == null) {
        await store.releaseLocks(locks);
        return [Notify('ADV_JOIN', seq, 'no such adventure', caller)];
    }

    adventure.join(caller);
    user.adventure = adventure.id;

    await store.setAdventure(advId, adventure);
    await store.setUser(caller, user);

    await store.releaseLocks(locks);

    const res: Wrapped_Message[] = [];
    
    const members = adventure.members();
    for(const member of members) {
        if(member !== caller) {
            res.push(WrappedState('ADV_JOIN', -1, await store.dumpState(member), member));
        } 
    }

    res.push(WrappedState('ADV_JOIN', seq, await store.dumpState(caller), caller));

    return res;
}

export async function moveToHandler(params: {
    advId?: number
    floorIn?: number
    nodeTo?: number
    [key: string]: any
}, seq: number, caller: string) {
    const advId = params.advId;
    let nodeTo = params.nodeTo;
    let floorIn = params.floorIn;

    if(advId == null || nodeTo == null || floorIn == null) {
        return [Notify('ADV_MOVETO', seq, 'insufficient parameters', caller)];
    }

    nodeTo = parseInt(String(nodeTo));
    floorIn = parseInt(String(floorIn));

    const ADV_LOCK = RedisStore.LOCK_RESOURCE(String(advId), 'adv');

    try {
        await store.acquireLock(ADV_LOCK);
    } catch {
        return [Notify('ADV_MOVETO', seq, 'adventure lock acquired fail', caller)];
    }

    let adventure = await store.getAdventure(advId);
    if(adventure == null) {
        await store.releaseLock(ADV_LOCK);
        return [Notify('ADV_MOVETO', seq, 'adventure not exists', caller)];
    }

    const moveRes = adventure.moveTo(caller, floorIn, nodeTo);
    if(moveRes.status === false) {
        await store.releaseLock(ADV_LOCK);
        return [Notify('ADV_MOVETO', seq, moveRes.reason, caller)];
    }

    await store.releaseLock(ADV_LOCK);

    let res: Wrapped_Message[] = [];
    for(const member of adventure.members()) {
        if(member === caller) continue;
        res.push(WrappedState('ADV_MOVETO', -1, await store.dumpState(member), member));
    }

    res.push(WrappedState('ADV_MOVETO', seq, await store.dumpState(caller), caller))

    return res;
}

export async function preStartAdventureHandler(params: {
    advId?: number
    [key: string]: any
}, seq: number, caller: string) {
    let advId = params.advId;
    if(advId == null) {
        return [Notify('ADV_PRESTART', seq, 'no sufficient paramester', caller)];
    }

    const ADV_LOCK = RedisStore.LOCK_RESOURCE(String(advId), 'adv');
    const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');
    const locks = [ADV_LOCK, USER_LOCK];

    try {
        await store.acquireLocks(locks);
    } catch {
        return [Notify('ADV_PRESTART', seq, 'adventure/user lock acquired fail', caller)];
    }

    const user = await store.getUser(caller);
    let adventure = await advRepo.findOne({
        where: {
            id: advId
        }
    })

    if(user == null) {
        await store.releaseLocks(locks);
        return [Notify('ADV_PRESTART', seq, 'adventure/user lock acquired fail', caller)];
    }

    let stateAdventure = null;
    let recruitAgain = false;
    if(adventure == null) {
        adventure = new DBAdventure();
        adventure.config = '';
        adventure = await advRepo.save(adventure);

        advId = adventure.id;

        stateAdventure = new Adventure(adventure.id, randomInt(3, 5));
        stateAdventure.recruit(caller);
        stateAdventure.join(caller);
    } else {
        stateAdventure = await store.getAdventure(advId);
        if(stateAdventure == null) {
            stateAdventure = Adventure.from(adventure.config);
            recruitAgain = true;
        }     
    }

    if(!stateAdventure.members().includes(caller)) {
        await store.releaseLocks(locks);
        return [Notify('ADV_PRESTART', seq, 'user not belongs to adventure', caller)];
    }

    user.adventure = advId;

    await store.setUser(caller, user);
    await store.setAdventure(advId, stateAdventure);
    await store.releaseLocks(locks);

    let res: Wrapped_Message[] = [];
    if(recruitAgain) {
        for(const recruitee of stateAdventure.members()) {
            const CMD: CMD_Adventure_recruit = {
                to: 'client',
                action: 'ADV_RECRUIT',
                payload: {
                    advId,
                    friendName: recruitee,
                    firstTime: false
                }
            }
            res.push(WrappedCMD('ADV_PRESTART', -1, CMD, 'cmd', caller, {}))
        }
    }

    res.push(WrappedState('ADV_PRESTART', seq, await store.dumpState(caller), caller))

    return res;
}

export async function ready2startHandler(params: {
    advId?: number
    [key: string]: any
}, seq: number, caller: string) {

}

export async function startGameHandler(params: {
    advId?: number
    [key: string]: any
}, seq: number, caller: string) {

}

export async function leaveAdventureHandler(params: {
    advId?: number
    [key: string]: any
}, seq: number, caller: string) {
    const advId = params.advId;
    if(advId == null) {
        return [Notify('ADV_LEAVE', seq, 'no such adventure', caller)];
    }

    const ADV_LOCK = RedisStore.LOCK_RESOURCE(String(advId), 'adv');
    const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');
    const locks = [ADV_LOCK, USER_LOCK];

    try {
        await store.acquireLocks(locks);
    } catch {
        return [Notify('ADV_PRESTART', seq, 'adventure/user lock acquired fail', caller)];
    }

    const adventure = await store.getAdventure(advId);
    const user = await store.getUser(caller);

    if(adventure == null || user == null) {
        await store.releaseLocks(locks);
        return [Notify('ADV_LEAVE', seq, 'adventure/user not exists', caller)];
    }

    adventure.derecruit(caller);
    user.adventure = null;

    await store.setUser(caller, user);
    if(adventure.empty()) {
        await store.delAdventure(advId);
        let dbAdventure = await advRepo.findOne({
            where: {
                id: adventure.id
            }
        })
        if(dbAdventure != null) {
            dbAdventure.config = adventure.serialize();
            await advRepo.save(dbAdventure);
        }
    } else {
        await store.setAdventure(advId, adventure);
    }

    await store.releaseLocks(locks);

    let res: Wrapped_Message[] = [];
    for(const member in adventure.members()) {
        if(member !== caller)
            res.push(WrappedState('ADV_LEAVE', -1, await store.dumpState(member), member));
    }

    res.push(WrappedState('ADV_LEAVE', -1, await store.dumpState(caller), caller));
    return res;
}