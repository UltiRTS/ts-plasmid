import { AppDataSource } from "../../db/datasource";
import { User } from "../../db/models/user"
import { ChatRoom } from "../../db/models/chat";
import { RedisStore } from "../store";


let dbInitialized = false;

AppDataSource.initialize().then(() => {
    dbInitialized = true;
}).catch(e=> {
    console.log(e)
})

export const store = new RedisStore();
export const userRepo = AppDataSource.getRepository(User);
export const chatRepo = AppDataSource.getRepository(ChatRoom);