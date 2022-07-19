import { DataSource } from "typeorm"
import { Confirmation } from "./models/confirmation"
import { User } from "./models/user"
import { Chat, ChatRoom } from "./models/chat"
import * as config from '../config'

export const AppDataSource = new DataSource({
    type: config.dbType,
    database: config.dbconf.database,
    host: config.dbconf.host,
    password: config.dbconf.password,
    port: config.dbconf.port,
    username: config.dbconf.user,
    entities: [
        User,
        Confirmation,
        Chat,
        ChatRoom
    ],
    synchronize: true
})