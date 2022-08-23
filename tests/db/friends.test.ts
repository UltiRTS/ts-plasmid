import { User } from "../../db/models/user";
import { AppDataSource } from "../../db/datasource";


const main = async () => {
    await AppDataSource.initialize();
    await query();
    await AppDataSource.destroy();
}

const query = async() => {
    const userRepo = await AppDataSource.getRepository(User);
    const bob = await userRepo.findOne({
        where: {
            username: 'bob'
        },
        relations: {
            friends: true
        }
    });

    const alice = await userRepo.findOne({
        where: {
            username: 'alice'
        },
        relations: {
            friends: true
        }
    })

    const test = await userRepo.find({
        where: {
            username: 'test'
        },
        relations: {
            friends: true
        }
    })

    console.log(bob);
    console.log(alice);
    console.log(test);
}

const create = async() => {
    const alice = new User()
    alice.friends = [];
    alice.username = 'alice';
    alice.hash = '';
    alice.salt = '';

    const bob = new User()
    bob.friends = [];
    bob.username = 'bob';
    bob.hash = '';
    bob.salt = '';


    console.log(alice);
    console.log(bob);
    alice.friends = [...alice.friends, bob];
    await AppDataSource.manager.save(bob);
    await AppDataSource.manager.save(alice);
}

main()