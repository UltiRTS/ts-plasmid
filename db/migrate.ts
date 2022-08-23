import "reflect-metadata"
import {AppDataSource} from './datasource';

import { Confirmation } from "./models/confirmation"
import { User } from "./models/user"


const main = async () => {
    await AppDataSource.initialize();

    const user = new User();
    const password = 'test';
    const {salt, hash} = User.saltNhash(password)

    user.username = 'test';
    user.hash = hash;
    user.salt = salt;
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

    await AppDataSource.destroy();
}

main()