import { Confirmation } from "../../db/models/confirmation";
import { Confirmation2Dump, ConfirmationContentAddFriend, ConfirmationContentAdvRecruit, Wrapped_Message } from "../interfaces";
import { Adventure } from "../states/rougue/adventure";
import { RedisStore } from "../store";
import { Notify, WrappedState, userLevel } from "../util";
import { advRepo, confirmRepo, store, userRepo } from "./shared";
import { businessLogger as logger } from "lib/logger";

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
            logger.error({ error: e}, 'acquire lock falied in add friend');
        }
    }



    return [WrappedState('ADDFRIEND', seq, await store.dumpState(caller), caller),  
        WrappedState('ADDFRIEND', -1, await store.dumpState(friendName), friendName)];
}

export async function recruitPpl4Adventure(params: {
    friendName?: string
}, seq: number, caller: string) {
    const friendName = params.friendName;
    if(friendName == null) {
        return [Notify('ADV_RECRUIT', seq, 'insufficient parameters', caller)];
    }

    const user = await store.getUser(caller); 
    if(user == null || user.adventure == null) {
        return [Notify('ADV_RECRUIT', seq, 'user/adventure may not exists', caller)];
    } 

    const adventure = await store.getAdventure(user.adventure);
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

    const advId = adventure?.id;

    const ADV_LOCK = RedisStore.LOCK_RESOURCE(String(advId), 'adv');
    const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');
    const locks = [ADV_LOCK, USER_LOCK];

    try {
        await store.acquireLocks(locks);
    } catch {
        return [Notify('ADV_RECRUIT', seq, 'adventure, user lock acquired fail', caller)];
    }


    // adventure.recruit(friendName, {
    //     level: userLevel(friend.exp),
    //     cost: true,
    // });

    await store.setAdventure(advId, adventure);

    const teamInfo: {
        username: string
        level: number
    }[] = []

    for(const member of adventure.members()) {
        const m = await store.getUser(member);
        if(m) {
            teamInfo.push({
                username: member,
                level: userLevel(m.exp)
            })
        } else {
            teamInfo.push({
                username: member,
                level: -1
            })
        }
    }

    const confirmContent = {
        type: 'adv_recruit',
        recruiter: caller,
        advId,
        firstTime: false,
        floorOn: adventure.floorOn(caller),
        team: teamInfo
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

    await store.releaseLocks(locks);

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
                        refund: true
                    });
                    await store.setAdventure(advId, adventure);
                }
            }

            await store.releaseLocks(locks);
            break;
        }
    }, 15 * 60 * 1000);

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
                    logger.info(userInCache.confirmations2dump);

                    await store.setUser(userInCache.username, userInCache);
                    await store.releaseLock(USER_LOCK);
                } catch(e) {
                    logger.error('acquire user lock failed in claim');
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
                            logger.error('acquire user lock failed in claim');
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
                            logger.error('acquire friend lock failed in claim');
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
                    friends: true,
                    adventures: true
                }
            })
            const adventure = await advRepo.findOne({
                where: {
                    id: confirmationContent.advId
                },
                relations: {
                    members: true
                }
            });


            if(user == null || adventure == null) {
                await store.releaseLocks(locks);
                return [Notify('CLAIMCONFIRM', seq, 'no such account/adventure', caller)];
            }

            user.adventures = [...user.adventures, adventure];
            userRepo.save(user);

            adventure.members = [...adventure.members, user];
            advRepo.save(adventure);

            let stateAdv = await store.getAdventure(adventure.id);
            if(stateAdv == null) {
                stateAdv = Adventure.from(adventure.config);
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
                    stateAdv.teamHp -= 5
                    stateAdv.recruit(caller);
                    stateAdv.join(caller);
                } else {
                    stateAdv.recruit(caller);
                    stateAdv.join(caller, {
                        level: userLevel(user.exp),
                        cost: true,
                        fund: false
                    });
                }

                await store.setAdventure(advId, stateAdv);
            }

            await store.releaseLocks(locks);
            res.push(WrappedState('CLAIMCONFIRM', seq, await store.dumpState(caller), caller));
            break;
        }
    }

    return res;
}
