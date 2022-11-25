import { Adventure } from "./rougue/adventure";
import { Notify, WrappedState } from "../util";
import { RedisStore } from "../store";
import { store } from "./shared";
import { randomInt } from "crypto";
import { Wrapped_Message } from "../interfaces";

export async function joinAdventureHandler(params: {
    advName?: string
    [key: string]: any
}, seq: number, caller: string) {
    const advName = params.advName;

    if(advName == null) {
        return [Notify('JOINADV', seq, 'insufficient parameters', caller)];
    }

    const ADV_LOCK = RedisStore.LOCK_RESOURCE(advName, 'adv');
    const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');

    try {
        await store.acquireLock(ADV_LOCK);
    } catch {
        console.log('adventure lock requried failed');
        return [Notify('JOINADV', seq, 'adventure lock acquired fail', caller)];
    }

    try {
        await store.acquireLock(USER_LOCK);
    } catch {
        console.log('user lock required failed');
        await store.releaseLock(ADV_LOCK);
        return [Notify('JOINADV', seq, 'user lock acquired fail', caller)];
    }

    let adventure = await store.getAdventure(advName);
    const user = await store.getUser(caller);

    if(user == null) {
        await store.releaseLock(USER_LOCK);
        await store.releaseLock(ADV_LOCK);
        return [Notify('JOINADV', seq, 'user not found', caller)];
    }

    if(adventure == null) {
        adventure = new Adventure(advName, randomInt(3, 5));
    }
    adventure.join(caller);
    user.adventure = adventure.name;

    await store.setAdventure(advName, adventure);
    await store.setUser(caller, user);

    await store.releaseLock(USER_LOCK);
    await store.releaseLock(ADV_LOCK);

    const res: Wrapped_Message[] = [];
    
    const members = adventure.members();
    for(const member of members) {
        if(member !== caller) {
            res.push(WrappedState('JOINADV', -1, await store.dumpState(member), member));
        } 
    }

    res.push(WrappedState('JOINADV', seq, await store.dumpState(caller), caller));

    return res;
}