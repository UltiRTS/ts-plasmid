import { User } from "../../db/models/user"
import { User as StateUser } from "../states/user";
import { RedisStore } from "../store";
import { Notify, WrappedState, WrappedCMD} from "../util";

import { store } from "./shared";
import { userRepo } from "./shared";

export async function loginHandler(params: {
    username?: string,
    password?: string,
    [key:string]: any
}, seq: number, caller: string) {
    const username = params.username;
    const password = params.password;

    if(username == null || password == null) {
        return [Notify('LOGIN', seq, 'missing username or password', caller)];
    }

    const RESOURCE_OCCUPIED = RedisStore.LOCK_RESOURCE(username, 'user');
    try {
        await store.acquireLock(RESOURCE_OCCUPIED);
    } catch {
        return [Notify('LOGIN', seq, 'acquire user lock failed', caller)];
    }


    const user = await userRepo.findOne({
        where: {
            username
        },
        relations: {
            friends: true,
            confirmations: true,
            marks: {
                target: true,
                user: true
            }
        },
    });

    if(user == null) {
        const user = new User();
        user.username = username;
        user.confirmations = [];
        user.friends = [];
        user.chats = [];

        const creds = User.saltNhash(password);
        user.salt = creds.salt;
        user.hash = creds.hash;

        await userRepo.save(user);

        const userState = new StateUser(user);
        await store.setUser(username, userState);
        console.log('getting inside auth: ', await store.getUser(username));

        await store.releaseLock(RESOURCE_OCCUPIED);
        return [WrappedState('LOGIN', seq, await store.dumpState(username), caller)];
    }

    user.confirmations = user.confirmations.filter(c => {
        return c.claimed === false
    })

    if(!user.verify(password)) {
        await store.releaseLock(RESOURCE_OCCUPIED);
        return [Notify('LOGIN', seq, 'wrong password of username', caller)];
    } else {
        const userState = new StateUser(user);
        userState.confirmations2dump = []
        for(const conf of user.confirmations) {
            if(!conf.claimed) {
                userState.confirmations2dump.push({
                    id: conf.id,
                    text: conf.text,
                    type: conf.type,
                    payload: conf.payload,
                    claimed: conf.claimed
                })
            }
        }
        await store.setUser(username, userState);

        await store.releaseLock(RESOURCE_OCCUPIED);
        return [WrappedState('LOGIN', seq, await store.dumpState(username), caller)];
    }
}
