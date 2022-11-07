import { RedisStore } from "../store";
import { AppDataSource } from "../../db/datasource";
import { User } from "../../db/models/user"

export const store = new RedisStore();
export const userRepo = AppDataSource.getRepository(User);

let dbInitialized = false;

AppDataSource.initialize().then(() => {
    dbInitialized = true;
}).catch(e=> {
    console.log(e)
})