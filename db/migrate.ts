import "reflect-metadata"
import { DataSource, UsingJoinColumnIsNotAllowedError } from "typeorm"
import { Confirmation } from "./models/confirmation"
import { User } from "./models/user"

const AppDataSource = new DataSource({
    type: 'sqlite',
    database: './app.db',
    entities: [
        User,
        Confirmation
    ],
    synchronize: true
})


const main = async () => {
    await AppDataSource.initialize();

    const user = new User();
    user.username = 'test';
    user.password = 'test';
    user.accessLevel = 0;
    user.exp = 0;
    user.sanity = 0;
    user.blocked = false;

    const confirmation = new Confirmation();
    confirmation.text = 'test';
    confirmation.type = 'test';
    confirmation.payload = 'test';
    confirmation.claimed = false;
    confirmation.user = user;

    await AppDataSource.manager.save(user);
    await AppDataSource.manager.save(confirmation);
}

main()