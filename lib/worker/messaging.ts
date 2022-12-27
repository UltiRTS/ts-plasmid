import { Confirmation } from "../../db/models/confirmation";
import { Confirmation2Dump, ConfirmationContentAddFriend, ConfirmationContentAdvRecruit, Wrapped_Message } from "../interfaces";
import { RedisStore } from "../store";
import { Notify, WrappedState } from "../util";
import { confirmRepo, store, userRepo } from "./shared";

export async function addFriendHandler(params: {
    friendName?: string
}, seq: number, caller: string) {
    const friendName = params.friendName;
    if(friendName == null) { 
        return [Notify('ADDFRIEND', seq, 'insufficient parameters', caller)]
    } 

    const friend = await userRepo.findOne({
        where: {
            username: friendName
        },
        relations: {
            confirmations: true
        }
    })

    const user = await userRepo.findOne({
        where: {
            username: caller
        }
    })

    if(friend == null || user == null) {
        return [Notify('ADDFRIEND', seq, 'no such user', caller)]
    }

    const confirmContent = {
        type: 'friend',
        targetVal: caller
    } as ConfirmationContentAddFriend

    let confirmation = new Confirmation()
    confirmation.payload = JSON.stringify(confirmContent);
    confirmation.claimed = false;
    confirmation.text = `${caller} has requested to be your friend`
    confirmation.type = 'friend'
    confirmation.user = friend;

    friend.confirmations = [...friend.confirmations, confirmation];

    await userRepo.save(friend);
    await confirmRepo.save(confirmation);

    const friendIncache = await store.getUser(friendName);
    if(friendIncache !== null) {
        const FRIEND_LOCK = RedisStore.LOCK_RESOURCE(friendName, 'user');
        try {
            await store.acquireLock(FRIEND_LOCK);
            friendIncache.confirmations2dump = [...friendIncache.confirmations2dump, {
                id: confirmation.id,
                text: confirmation.text,
                type: confirmation.type,
                payload: confirmation.payload,
                claimed: confirmation.claimed,
            } as Confirmation2Dump]
            await store.setUser(friendName, friendIncache);
            await store.releaseLock(FRIEND_LOCK);
        } catch(e) {
            console.log(e);
            console.log('acquire lock falied in add friend');
        }
    }



    return [WrappedState('ADDFRIEND', seq, await store.dumpState(caller), caller),  
        WrappedState('ADDFRIEND', -1, await store.dumpState(friendName), friendName)];
}

export async function recruitPpl4Adventure(params: {
    friendName?: string
    advId?: number
    firstTime?: boolean
}, seq: number, caller: string) {
    const friendName = params.friendName;
    const advId = params.advId;
    let firstTime = params.firstTime;

    if(friendName == null || advId == null) {
        return [Notify('ADV_RECRUIT', seq, 'insufficient parameters', caller)];
    }

    if(firstTime == null) firstTime = true;

    const ADV_LOCK = RedisStore.LOCK_RESOURCE(String(advId), 'adv');
    const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');
    const locks = [ADV_LOCK, USER_LOCK];

    try {
        await store.acquireLocks(locks);
    } catch {
        return [Notify('ADV_RECRUIT', seq, 'adventure, user lock acquired fail', caller)];
    }

    const friend = await userRepo.findOne({
        where: {
            username: friendName
        },
        relations: {
            confirmations: true
        }
    })

    const adventure = await store.getAdventure(advId);

    if(friend == null || adventure == null) {
        return [Notify('ADV_RECRUIT', seq, 'adventure, user may not exist', caller)];
    }

    adventure.recruit(friendName);

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

    return [WrappedState('ADV_RECRUIT', seq, await store.dumpState(caller), caller),  
        WrappedState('ADV_RECRUIT', -1, await store.dumpState(friendName), friendName)];
}

export async function confirmHandler(params: {
    type?: string
    confirmationId?: number
    agree?: boolean
}, seq: number, caller: string) {
    const type = params.type;
    const confirmationId = params.confirmationId;

    if(type == null || confirmationId == null) {
        return [Notify('CLAIMCONFIRM', seq, 'insufficient parameters', caller)];
    }

    const res: Wrapped_Message[] = [];

    switch(type) {
        case 'friend': {
            let agree = params.agree;
            if(agree == null) agree = false;
            // console.log(agree);
            // console.log(agree === true);
            // console.log(agree === false);

            const confirmation = await confirmRepo.findOne({
                where: {
                    id: confirmationId
                }
            })

            if(confirmation == null) {
                return [Notify('CLAIMCONFIRM', seq, 'no such confirmation', caller)];
            }

            if(confirmation.claimed) {
                return [WrappedState('CLAIMCONFIRM', seq, await store.dumpState(caller), caller)]
            }

            confirmation.claimed = true;
            confirmRepo.save(confirmation);

            // START update in cache claimed
            const user = await userRepo.findOne({
                where: {
                    username: caller
                },
                relations: {
                    friends: true
                }
            })
            if(user == null) {
                return [Notify('CLAIMCONFIRM', seq, 'no such account', caller)];
            }

            const userInCache = await store.getUser(user.username);
            if(userInCache) {
                const USER_LOCK = RedisStore.LOCK_RESOURCE(userInCache.username, 'user');
                try {
                    await store.acquireLock(USER_LOCK);
                    userInCache.confirmations2dump = [...userInCache.confirmations2dump]

                    userInCache.confirmations2dump = userInCache.confirmations2dump.filter(c => {
                        return c.id !== confirmation.id && c.claimed === false
                    })
                    console.log(userInCache.confirmations2dump);

                    await store.setUser(userInCache.username, userInCache);
                    await store.releaseLock(USER_LOCK);
                } catch(e) {
                    console.log('acquire user lock failed in claim');
                }
            }
            // END in cache claimed

            if(agree) {
                const payload: {
                    targetVal: string
                } = JSON.parse(confirmation.payload);

                const friend = await userRepo.findOne({
                    where: {
                        username: payload.targetVal
                    },
                    relations: {
                        friends: true
                    }
                })

                if(friend == null) {
                    return [Notify('CLAIMCONFIRM', seq, 'your friend maybe deleted their account', caller)];
                }

                const user = await userRepo.findOne({
                    where: {
                        username: caller
                    },
                    relations: {
                        friends: true
                    }
                })
                if(user == null) {
                    return [Notify('CLAIMCONFIRM', seq, 'no such account', caller)];
                }

                const userInCache = await store.getUser(user.username);
                const friendInCache = await store.getUser(friend.username);

                let isUserFriend = false;
                let isFriendFriend = false;

                for(const u of user.friends) {
                    if(u.username === friend.username) {
                        isUserFriend = true;
                        break;
                    }
                }

                for(const u of friend.friends) {
                    if(u.username == user.username) {
                        isFriendFriend = true;
                        break;
                    }
                }

                if(!isUserFriend) {
                    user.friends = [...user.friends, friend];
                    userRepo.save(user);
                    if(userInCache) {
                        const USER_LOCK = RedisStore.LOCK_RESOURCE(userInCache.username, 'user');
                        try {
                            await store.acquireLock(USER_LOCK);
                            userInCache.friends2dump.push(friend.username);
                            await store.setUser(userInCache.username, userInCache);
                            await store.releaseLock(USER_LOCK);
                        } catch(e) {
                            console.log('acquire user lock failed in claim');
                        }
                    }
                }

                if(!isFriendFriend) {
                    if(friend.username !== user.username) {
                        friend.friends = [...friend.friends, user];
                        userRepo.save(friend);
                    }
                    if(friendInCache) {
                        const USER_LOCK = RedisStore.LOCK_RESOURCE(friendInCache.username, 'user');
                        try {
                            await store.acquireLock(USER_LOCK);
                            friendInCache.friends2dump.push(user.username);
                            await store.setUser(friendInCache.username, friendInCache);
                            await store.releaseLock(USER_LOCK);
                        } catch(e) {
                            console.log('acquire friend lock failed in claim');
                        }
                    }
                }


                res.push(WrappedState('CLAIMCONFIRM', seq, await store.dumpState(user.username), user.username));
            }
            break;
        }
        case 'adv_recruit': {
            let agree = params.agree;
            if(agree == null) agree = false;

            const confirmation = await confirmRepo.findOne({
                where: {
                    id: confirmationId
                }
            })

            if(confirmation == null) {
                return [Notify('CLAIMCONFIRM', seq, 'no such confirmation', caller)];
            }

            if(confirmation.claimed) {
                return [WrappedState('CLAIMCONFIRM', seq, await store.dumpState(caller), caller)]
            }

            confirmation.claimed = true;
            confirmRepo.save(confirmation);

            const confirmationContent: ConfirmationContentAdvRecruit = JSON.parse(confirmation.payload);
            const advId = confirmationContent.advId;

            const ADV_LOCK = RedisStore.LOCK_RESOURCE(String(advId), 'adv');
            const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');
            const locks = [ADV_LOCK, USER_LOCK];

            try {
                await store.acquireLocks(locks);
            } catch {
                return [Notify('MOVETO', seq, 'adventure, user lock acquired fail', caller)];
            }

            // START update in cache claimed
            const user = await userRepo.findOne({
                where: {
                    username: caller
                },
                relations: {
                    friends: true
                }
            })
            const adventure = await store.getAdventure(advId);
            if(user == null || adventure == null) {
                await store.releaseLocks(locks);
                return [Notify('CLAIMCONFIRM', seq, 'no such account/adventure', caller)];
            }

            const userInCache = await store.getUser(user.username);
            if(userInCache) {
                userInCache.confirmations2dump = [...userInCache.confirmations2dump]

                userInCache.confirmations2dump = userInCache.confirmations2dump.filter(c => {
                    return c.id !== confirmation.id && c.claimed === false
                })

                userInCache.adventure = advId;

                await store.setUser(userInCache.username, userInCache);
            }

            if(agree) {
                if(!confirmationContent.firstTime) {
                    // logic about resume game
                    adventure.teamHp -= 5
                }

                adventure.join(caller);
                await store.setAdventure(advId, adventure);
            }

            await store.releaseLocks(locks);
            res.push(WrappedState('CLAIMCONFIRM', seq, await store.dumpState(caller), caller));
            break;
        }
    }

    return res;
}
