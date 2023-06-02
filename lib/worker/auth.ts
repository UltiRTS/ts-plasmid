import { InventoryItem, User } from 'db/models/user';
import { Adventure } from 'lib/states/rougue/adventure';
import { User as StateUser } from 'lib/states/user';
import { RedisStore } from 'lib/store';
import { Notify, WrappedState } from 'lib/util';
import { businessLogger as logger } from 'lib/logger';

import { advRepo, invetoryItemRepo, store, userRepo } from './shared';

export async function loginHandler(
  params: {
    username?: string
    password?: string
    [key: string]: any
  },
  seq: number,
  caller: string,
) {
  const { username, password } = params;

  if (username == null || password == null)
    return [Notify('LOGIN', seq, 'missing username or password', caller)];

  const RESOURCE_OCCUPIED = RedisStore.LOCK_RESOURCE(username, 'user');
  try {
    await store.acquireLock(RESOURCE_OCCUPIED);
  }
  catch {
    return [Notify('LOGIN', seq, 'acquire user lock failed', caller)];
  }

  const user = await userRepo.findOne({
    where: {
      username,
    },
    relations: {
      friends: true,
      confirmations: true,
      marks: {
        target: true,
        user: true,
      },
      adventures: true,
    },
  });

  if (user == null) {
    const user = new User();
    user.username = username;
    user.confirmations = [];
    user.friends = [];
    user.chats = [];
    user.marks = [];
    user.adventures = [];
    const testItem = new InventoryItem();
    testItem.name = 'test';
    testItem.qty = 1;
    testItem.description = 'test';
    await invetoryItemRepo.save(testItem);

    user.inventory = [testItem];

    const creds = User.saltNhash(password);
    user.salt = creds.salt;
    user.hash = creds.hash;

    await userRepo.save(user);

    const userState = new StateUser(user);
    await store.setUser(username, userState);
    logger.info(`getting inside auth: ${await store.getUser(username)}`);

    await store.releaseLock(RESOURCE_OCCUPIED);
    return [
      WrappedState('LOGIN', seq, await store.dumpState(username), caller),
    ];
  }

  user.confirmations = user.confirmations.filter((c) => {
    return c.claimed === false;
  });

  if (!user.verify(password)) {
    await store.releaseLock(RESOURCE_OCCUPIED);
    return [Notify('LOGIN', seq, 'wrong password of username', caller)];
  }
  else {
    const userState = new StateUser(user);
    userState.confirmations2dump = [];
    if (userState.adventure) {
      let adv = await store.getAdventure(userState.adventure);
      if (adv == null) {
        const dbAdv = await advRepo.findOne({
          where: {
            id: userState.adventure,
          },
        });
        if (dbAdv) {
          adv = Adventure.from(dbAdv.config);
          await store.setAdventure(adv.id, adv);
          logger.info(adv.recruits);
        }
      }
    }

    for (const conf of user.confirmations) {
      if (!conf.claimed) {
        userState.confirmations2dump.push({
          id: conf.id,
          text: conf.text,
          type: conf.type,
          payload: conf.payload,
          claimed: conf.claimed,
        });
      }
    }
    logger.info('AAAA Setting user');
    await store.setUser(username, userState);

    await store.releaseLock(RESOURCE_OCCUPIED);
    logger.info('AAAA Login Handler');
    return [
      WrappedState('LOGIN', seq, await store.dumpState(username), caller),
    ];
  }
}

export async function registerHandler(params: {
  username?: string
  password?: string
  // bio: string
  // machineID: string
  [key: string]: any
}, seq: number, caller: string) {
  const { username, password } = params;
  if (!username || !password)
    return [Notify('REGISTER', seq, 'missing username or password', caller)];

  const RESOURCE_OCCUPIED = RedisStore.LOCK_RESOURCE(username, 'user');
  const creds = User.saltNhash(password);
  const user = userRepo.create({
    username,
    salt: creds.salt,
    hash: creds.hash,
  });
  await userRepo.save(user);
  const userState = new StateUser(user);
  await store.setUser(username, userState);
  logger.info(`getting inside auth: ${await store.getUser(username)}`);

  await store.releaseLock(RESOURCE_OCCUPIED);
  return [
    WrappedState('REGISTER', seq, await store.dumpState(username), caller),
  ];
}
