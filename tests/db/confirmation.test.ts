import { AppDataSource } from "../../db/datasource";
import { Confirmation } from "../../db/models/confirmation";
import { User } from "../../db/models/user";

const main = async() => {
    await AppDataSource.initialize();

    // await addFriendConfirmation();
    await queryConfiramtion();
    await AppDataSource.destroy();
}

const addFriendConfirmation = async() => {
    const userRepo = AppDataSource.getRepository(User);

    const user = await userRepo.findOne({
        where: {
            username: 'test'
        },
        relations: {
            confirmations: true
        }
    });

    if(!user) {
        console.log('user not exists');
        return;
    }

    const confirmation = new Confirmation();
    confirmation.text = 'test';
    confirmation.type = 'test';
    confirmation.payload = 'test';
    confirmation.claimed = false;
    confirmation.user = user;

    user.confirmations = [...user.confirmations, confirmation];

    await userRepo.save(user);
}

const queryConfiramtion = async() => {
    const userRepo = AppDataSource.getRepository(User);

    const user = await userRepo.findOne({
        where: {
            username: 'test'
        },
        relations: {
            confirmations: true
        }
    });

    if(!user) {
        console.log('user not exists');
        return;
    }

    console.log(user);
}

main();