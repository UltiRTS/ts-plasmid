import { Confirmation } from "../../db/models/confirmation";
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
    }

    let confirmation = new Confirmation()
    confirmation.payload = JSON.stringify(confirmContent);
    confirmation.claimed = false;
    confirmation.text = `${caller} has requested to be your friend`
    confirmation.type = 'friend'
    confirmation.user = friend;

    friend.confirmations = [...friend.confirmations, confirmation];

    userRepo.save(friend);
    confirmRepo.save(confirmation);

    return [WrappedState('ADDFRIEND', seq, await store.dumpState(caller), caller)];
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

            confirmation.claimed = true;
            confirmRepo.save(confirmation);

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
                }
                if(!isFriendFriend) {
                    friend.friends = [...friend.friends, user];
                }

                userRepo.save(user);
                userRepo.save(friend);

            }
            break;
        }
    }
    return [WrappedState('CLAIMCONFIRM', seq, await store.dumpState(caller), caller)];
}
