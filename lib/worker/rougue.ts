import { Adventure } from "../states/rougue/adventure";
import { Notify, WrappedState } from "../util";
import { RedisStore } from "../store";
import { store } from "./shared";
import { randomInt } from "crypto";
import { Wrapped_Message } from "../interfaces";
import { PlainObjectToNewEntityTransformer } from "typeorm/query-builder/transformer/PlainObjectToNewEntityTransformer";

export async function joinAdventureHandler(params: {
    advName?: string
    [key: string]: any
}, seq: number, caller: string) {
    const advName = params.advName;

    if(advName == null) {
        return [Notify('ADV_JOIN', seq, 'insufficient parameters', caller)];
    }

    const ADV_LOCK = RedisStore.LOCK_RESOURCE(advName, 'adv');
    const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');

    const locks = [ADV_LOCK, USER_LOCK];


    try {
        await store.acquireLocks(locks);
    } catch {
        return [Notify('ADV_JOIN', seq, 'adventure, user lock acquired fail', caller)];
    }

    let adventure = await store.getAdventure(advName);
    const user = await store.getUser(caller);

    if(user == null) {
        await store.releaseLocks(locks);
        return [Notify('ADV_JOIN', seq, 'user not found', caller)];
    }

    if(adventure == null) {
        await store.releaseLocks(locks);
        return [Notify('ADV_JOIN', seq, 'no such adventure', caller)];
    }

    adventure.join(caller);
    user.adventure = adventure.name;

    await store.setAdventure(advName, adventure);
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
    advName?: string
    floorIn?: number
    nodeTo?: number
    [key: string]: any
}, seq: number, caller: string) {
    const advName = params.advName;
    let nodeTo = params.nodeTo;
    let floorIn = params.floorIn;

    if(advName == null || nodeTo == null || floorIn == null) {
        return [Notify('ADV_MOVETO', seq, 'insufficient parameters', caller)];
    }

    nodeTo = parseInt(String(nodeTo));
    floorIn = parseInt(String(floorIn));

    const ADV_LOCK = RedisStore.LOCK_RESOURCE(advName, 'adv');

    try {
        await store.acquireLock(ADV_LOCK);
    } catch {
        return [Notify('ADV_MOVETO', seq, 'adventure lock acquired fail', caller)];
    }

    let adventure = await store.getAdventure(advName);
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
    advName?: string
    [key: string]: any
}, seq: number, caller: string) {
    const advName = params.advName;
    if(advName == null) {
        return [Notify('ADV_PRESTART', seq, 'no sufficient paramester', caller)];
    }

    const ADV_LOCK = RedisStore.LOCK_RESOURCE(advName, 'adv');
    const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');
    const locks = [ADV_LOCK, USER_LOCK];

    try {
        await store.acquireLocks(locks);
    } catch {
        return [Notify('ADV_PRESTART', seq, 'adventure/user lock acquired fail', caller)];
    }

    const user = await store.getAdventure(caller);
    const adventure = await store.getAdventure(advName);

    if(user == null) {
        return [Notify('ADV_PRESTART', seq, 'adventure/user lock acquired fail', caller)];
    }


}

export async function ready2startHandler(params: {
    advName?: string
    [key: string]: any
}, seq: number, caller: string) {

}

export async function startGameHandler(params: {
    advName?: string
    [key: string]: any
}, seq: number, caller: string) {

}