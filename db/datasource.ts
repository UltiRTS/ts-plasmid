import { DataSource } from "typeorm"
import { Confirmation } from "./models/confirmation"
import { User } from "./models/user"

export const AppDataSource = new DataSource({
    type: 'sqlite',
    database: './app.db',
    entities: [
        User,
        Confirmation
    ],
    synchronize: true
})