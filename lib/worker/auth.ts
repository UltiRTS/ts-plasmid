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
            status: true,
            message: 'registered successfully'
        } as Receipt;
    }

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

        return {
            receiptOf: 'LOGIN',
            seq: seq,
            status: true,
            message: 'registered successfully'
        } as Receipt;
    }

    if(!user.verify(password)) {
        return {
            receiptOf: 'LOGIN',
            seq: seq,
            status: false,
            message: 'wrong password or username'
        } as Receipt;
    } else {
        const userState = new StateUser(user);
        store.setUser(username, userState);

        return {
            receiptOf: 'LOGIN',
            seq: seq,
            status: true,
            message: 'login successfully'
        } as Receipt;
    }
}