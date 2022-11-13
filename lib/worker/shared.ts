import { AppDataSource } from "../../db/datasource";
import { User } from "../../db/models/user"
import { ChatRoom } from "../../db/models/chat";
import { RedisStore } from "../store";
import { Confirmation } from "../../db/models/confirmation";


let dbInitialized = false;

AppDataSource.initialize().then(() => {
    dbInitialized = true;
}).catch(e=> {
    console.log(e)
})

export const store = new RedisStore();
export const userRepo = AppDataSource.getRepository(User);
export const chatRepo = AppDataSource.getRepository(ChatRoom);
export const confirmRepo = AppDataSource.getRepository(Confirmation);