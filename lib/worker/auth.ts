import { Repository } from "typeorm"
import { User } from "../../db/models/user"
import { User as StateUser } from "../states/user";
import { RedisStore } from "../store";
import { Receipt } from "../interfaces";

import { AppDataSource } from "../../db/datasource";


let dbInitialized = false;

AppDataSource.initialize().then(() => {
    dbInitialized = true;
}).catch(e=> {
    console.log(e)
})

const store = new RedisStore();
const userRepo = AppDataSource.getRepository(User);

export async function loginHandler(params: {
    username?: string,
    password?: string,
    [key:string]: any
}, seq: number) {
    const username = params.username;
    const password = params.password;

    if(username == null || password == null) {
        return {
            receiptOf: 'LOGIN',
            seq: seq,
            status: false,
            message: 'missing username or password',
            payload: {}
        } as Receipt;
    }

    const RESOURCE_OCCUPIED = store.USER_RESOURCE(username);
    const locked = await store.acquireLock(RESOURCE_OCCUPIED);

    if(locked) return LockedNotify('LOGIN', seq);

    const user = await userRepo.findOne({
        where: {
            username
        }
    });

    if(user == null) {
        const user = new User();
        user.username = username;

        const creds = User.saltNhash(password);
        user.salt = creds.salt;
        user.hash = creds.hash;

        await userRepo.save(user);

        const userState = new StateUser(user);
        store.setUser(username, userState);

        await store.releaseLock(RESOURCE_OCCUPIED);
        return {
            receiptOf: 'LOGIN',
            seq: seq,
            status: true,
            message: 'registered successfully',
            payload: {
                username
            }
        } as Receipt;
    }

    if(!user.verify(password)) {
        await store.releaseLock(RESOURCE_OCCUPIED);
        return {
            receiptOf: 'LOGIN',
            seq: seq,
            status: false,
            message: 'wrong password or username'
        } as Receipt;
    } else {
        const userState = new StateUser(user);
        store.setUser(username, userState);

        await store.releaseLock(RESOURCE_OCCUPIED);
        return {
            receiptOf: 'LOGIN',
            seq: seq,
            status: true,
            message: 'login successfully',
            payload: {
                username
            }
        } as Receipt;
    }
}

export function LockedNotify(receiptOf: string, seq: number) {
    return {
        receiptOf: 'LOGIN',
        seq: seq,
        status: false,
        message: 'LOCK ACQUIRED FAILED'
    } as Receipt;
}