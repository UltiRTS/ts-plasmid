import 'reflect-metadata';
import { sleep } from '../lib/util';
import { AppDataSource } from '../db/datasource';
import { Mark, User } from '../db/models/user';

let dbInitialized = false;

AppDataSource.initialize().then(() => {
  dbInitialized = true;
  main();
}).catch((e) => {
  console.log(e);
});

const userRepo = AppDataSource.getRepository(User);
const markRepo = AppDataSource.getRepository(Mark);

async function main() {
  sleep(2000);

  const user = await userRepo.findOne({
    where: {
      username: 'test',
    },
  });

  if (user == null)
    return;

  const mark = new Mark();
  mark.mark = 'something wrong with this guy';
  mark.target = user;
  mark.user = user;

  const res = await markRepo.save(mark);
  console.log(res);
  await AppDataSource.destroy();
}
