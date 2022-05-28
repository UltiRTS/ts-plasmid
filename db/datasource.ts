import { DataSource } from "typeorm"
import { Confirmation } from "./models/confirmation"
import { User } from "./models/user"
import { Chat, ChatRoom } from "./models/chat"

export const AppDataSource = new DataSource({
    type: 'sqlite',
    database: './app.db',
    entities: [
        User,
        Confirmation,
        Chat,
        ChatRoom
    ],
    synchronize: true
})