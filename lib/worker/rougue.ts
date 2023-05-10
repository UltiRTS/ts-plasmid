import { randomInt } from 'node:crypto';
import { businessLogger as logger } from 'lib/logger';
import { Adventure } from '../states/rougue/adventure';
import { Adventure as DBAdventure } from '../../db/models/adventure';
import { Notify, WrappedCMD, WrappedState } from '../util';
import { RedisStore } from '../store';
import type { CMD_Adventure_recruit, Wrapped_Message } from '../interfaces';
import { advRepo, store, userRepo } from './shared';

export async function joinAdventureHandler(params: {
  advId?: number
  [key: string]: any
}, seq: number, caller: string) {
  const advId = params.advId;

  if (advId == null)
    return [Notify('ADV_JOIN', seq, 'insufficient parameters', caller)];

  const ADV_LOCK = RedisStore.LOCK_RESOURCE(String(advId), 'adv');
  const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');

  const locks = [ADV_LOCK, USER_LOCK];

  try {
    await store.acquireLocks(locks);
  }
  catch {
    return [Notify('ADV_JOIN', seq, 'adventure, user lock acquired fail', caller)];
  }

  const user = await store.getUser(caller);

  if (user == null) {
    await store.releaseLocks(locks);
    return [Notify('ADV_JOIN', seq, 'user not found', caller)];
  }

  const adventure = await store.getAdventure(advId);

  if (adventure == null) {
    await store.releaseLocks(locks);
    return [Notify('ADV_JOIN', seq, 'no such adventure', caller)];
  }

  adventure.join(caller);
  user.adventure = adventure.id;

  await store.setAdventure(advId, adventure);
  await store.setUser(caller, user);

  await store.releaseLocks(locks);

  const res: Wrapped_Message[] = [];

  const members = adventure.members();
  for (const member of members) {
    if (member !== caller)
      res.push(WrappedState('ADV_JOIN', -1, await store.dumpState(member), member));
  }

  res.push(WrappedState('ADV_JOIN', seq, await store.dumpState(caller), caller));

  return res;
}

export async function moveToHandler(params: {
  advId?: number
  floorIn?: number
  nodeTo?: number
  [key: string]: any
}, seq: number, caller: string) {
  const advId = params.advId;
  let nodeTo = params.nodeTo;
  let floorIn = params.floorIn;

  if (advId == null || nodeTo == null || floorIn == null)
    return [Notify('ADV_MOVETO', seq, 'insufficient parameters', caller)];

  nodeTo = parseInt(String(nodeTo));
  floorIn = parseInt(String(floorIn));

  const ADV_LOCK = RedisStore.LOCK_RESOURCE(String(advId), 'adv');

  try {
    await store.acquireLock(ADV_LOCK);
  }
  catch {
    return [Notify('ADV_MOVETO', seq, 'adventure lock acquired fail', caller)];
  }

  const adventure = await store.getAdventure(advId);
  if (adventure == null) {
    await store.releaseLock(ADV_LOCK);
    return [Notify('ADV_MOVETO', seq, 'adventure not exists', caller)];
  }

  const moveRes = adventure.moveTo(caller, floorIn, nodeTo);
  if (moveRes.status === false) {
    await store.releaseLock(ADV_LOCK);
    return [Notify('ADV_MOVETO', seq, moveRes.reason, caller)];
  }

  await store.releaseLock(ADV_LOCK);

  const res: Wrapped_Message[] = [];
  for (const member of adventure.members()) {
    if (member === caller)
      continue;
    res.push(WrappedState('ADV_MOVETO', -1, await store.dumpState(member), member));
  }

  res.push(WrappedState('ADV_MOVETO', seq, await store.dumpState(caller), caller));

  return res;
}

export async function createAdventureHandler(params: {
}, seq: number, caller: string) {
  const user = await store.getUser(caller);
  if (user == null)
    return [Notify('ADV_CREATE', seq, 'adventure/user lock acquired fail', caller)];

  const existedAdvId = user.adventure;
  if (existedAdvId) {
    const existedAdv = await advRepo.findOne({
      where: {
        id: existedAdvId,
      },
      relations: {
        members: true,
      },
    });
    if (existedAdv) {
      existedAdv.members = existedAdv.members.filter(m => m.username !== caller);
      advRepo.save(existedAdv);
    }
  }

  let adv = new DBAdventure();
  adv.config = '';
  adv.members = [user];
  adv = await advRepo.save(adv);

  const stateAdv = new Adventure(adv.id, randomInt(3, 5));
  stateAdv.recruit(caller);
  stateAdv.join(caller);

  const dbUser = await userRepo.findOne({
    where: {
      id: user.id,
    },
    relations: {
      adventures: true,
    },
  });
  if (dbUser) {
    dbUser.adventures = [...dbUser.adventures, adv];
    await userRepo.save(dbUser);
  }

  user.adventure = adv.id;

  const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');
  const ADV_LOCK = RedisStore.LOCK_RESOURCE(String(adv.id), 'adv');
  const locks = [USER_LOCK, ADV_LOCK];

  try {
    await store.acquireLocks(locks);
  }
  catch (e) {
    return [Notify('ADV_CREATE', seq, 'adventure/user lock acquired fail', caller)];
  }

  await store.setUser(caller, user);
  await store.setAdventure(adv.id, stateAdv);

  await store.releaseLocks(locks);

  return [WrappedState('ADV_CREATE', seq, await store.dumpState(caller), caller)];
}

// pass advId to -1 to create new adventure
export async function preStartAdventureHandler(params: {
}, seq: number, caller: string) {
  const user = await store.getUser(caller);
  if (user == null)
    return [Notify('ADV_PRESTART', seq, 'user not exists', caller)];

  const advId = user.adventure;

  if (advId == null)
    return [Notify('ADV_PRESTART', seq, 'no related adventure found', caller)];

  const ADV_LOCK = RedisStore.LOCK_RESOURCE(String(advId), 'adv');
  const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');
  const locks = [ADV_LOCK, USER_LOCK];

  try {
    await store.acquireLocks(locks);
  }
  catch {
    return [Notify('ADV_PRESTART', seq, 'adventure/user lock acquired fail', caller)];
  }

  const stateAdv = await store.getAdventure(advId);

  if (stateAdv == null) {
    await store.releaseLocks(locks);
    return [Notify('ADV_PRESTART', seq, 'no such adventure', caller)];
  }

  stateAdv.recruit(caller);

  let recruitAgain = false;

  const members = stateAdv.members().sort();
  const recruits = stateAdv.recruits.sort();

  if (recruits.length < members.length)
    recruitAgain = true;

  await store.setUser(caller, user);
  await store.setAdventure(advId, stateAdv);
  await store.releaseLocks(locks);

  logger.info(stateAdv.recruits);

  const res: Wrapped_Message[] = [];
  if (recruitAgain) {
    for (const recruitee of stateAdv.members()) {
      if (recruitee === caller)
        continue;

      const CMD: CMD_Adventure_recruit = {
        to: 'internal',
        action: 'ADV_RECRUIT',
        payload: {
          advId,
          friendName: recruitee,
          firstTime: false,
        },
      };
      res.push(WrappedCMD('ADV_PRESTART', -1, CMD, 'cmd', caller, {}));
    }
  }

  res.push(WrappedState('ADV_PRESTART', seq, await store.dumpState(caller), caller));

  setTimeout(async () => {
    let retry = 3;
    while (retry > 0) {
      try {
        await store.acquireLock(ADV_LOCK);
      }
      catch (e) {
        retry--;
      }

      const adventure = await store.getAdventure(advId);
      if (adventure == null)
        return;

      if (!adventure.ready2start())
        adventure.readys = [];

      await store.setAdventure(advId, adventure);
      await store.releaseLock(ADV_LOCK);

      break;
    }
  }, 30 * 60 * 1000);

  return res;
}

export async function ready2startHandler(params: {
  advId?: number
  [key: string]: any
}, seq: number, caller: string) {

}

export async function startGameHandler(params: {
  advId?: number
  [key: string]: any
}, seq: number, caller: string) {

}

export async function leaveAdventureHandler(params: {
  advId?: number
  [key: string]: any
}, seq: number, caller: string) {
  const advId = params.advId;
  if (advId == null)
    return [Notify('ADV_LEAVE', seq, 'no such adventure', caller)];

  const ADV_LOCK = RedisStore.LOCK_RESOURCE(String(advId), 'adv');
  const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');
  const locks = [ADV_LOCK, USER_LOCK];

  try {
    await store.acquireLocks(locks);
  }
  catch {
    logger.error('lock failed');
    return [Notify('ADV_PRESTART', seq, 'adventure/user lock acquired fail', caller)];
  }

  const adventure = await store.getAdventure(advId);
  const user = await store.getUser(caller);

  if (adventure == null || user == null) {
    await store.releaseLocks(locks);
    logger.info('adventure not aexits');
    return [Notify('ADV_LEAVE', seq, 'adventure/user not exists', caller)];
  }

  adventure.derecruit(caller);
  adventure.deready(caller);
  user.adventure = null;
  await store.setAdventure(advId, adventure);

  logger.info(`decruiting ${caller}`);

  await store.setUser(caller, user);
  if (adventure.empty()) {
    await store.delAdventure(advId);
    logger.info('deleting adventure');
    const dbAdventure = await advRepo.findOne({
      where: {
        id: adventure.id,
      },
    });
    if (dbAdventure != null) {
      dbAdventure.config = adventure.serialize();
      await advRepo.save(dbAdventure);
    }
  }

  await store.releaseLocks(locks);

  const res: Wrapped_Message[] = [];
  for (const member in adventure.recruits) {
    if (member !== caller)
      res.push(WrappedState('ADV_LEAVE', -1, await store.dumpState(member), member));
  }

  res.push(WrappedState('ADV_LEAVE', -1, await store.dumpState(caller), caller));
  return res;
}

export async function readyAdventureHandler(params: {
  [key: string]: any
}, seq: number, caller: string) {
  const user = await store.getUser(caller);
  if (user == null)
    return [Notify('ADV_READY', seq, 'user not exists', caller)];

  const advId = user.adventure;
  if (advId == null)
    return [Notify('ADV_READY', seq, 'joined no adventure', caller)];

  const ADV_LOCK = RedisStore.LOCK_RESOURCE(String(advId), 'adv');
  try {
    await store.acquireLock(ADV_LOCK);
  }
  catch (e) {
    return [Notify('ADV_READY', seq, 'acquire adventure lock failed', caller)];
  }

  const adventure = await store.getAdventure(advId);
  if (adventure == null) {
    await store.releaseLock(ADV_LOCK);
    return [Notify('ADV_READY', seq, 'no such adventure', caller)];
  }

  adventure.ready(caller);

  await store.setAdventure(advId, adventure);

  await store.releaseLock(ADV_LOCK);

  const res: Wrapped_Message[] = [];
  for (const recruit of adventure.recruits) {
    if (recruit !== caller)
      res.push(WrappedState('ADV_READY', -1, await store.dumpState(recruit), recruit));
  }

  res.push(WrappedState('ADV_READY', seq, await store.dumpState(caller), caller));

  return res;
}

export async function forfeitAdventureHandler(params: {
  [key: string]: any
}, seq: number, caller: string) {
  const user = await store.getUser(caller);
  if (user == null)
    return [Notify('ADV_FORFEIT', seq, 'user not exists', caller)];

  const advId = user.adventure;
  if (advId == null)
    return [Notify('ADV_FORFEIT', seq, 'joined no adventure', caller)];

  const ADV_LOCK = RedisStore.LOCK_RESOURCE(String(advId), 'adv');
  const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');
  const locks = [ADV_LOCK, USER_LOCK];

  try {
    await store.acquireLocks(locks);
  }
  catch (e) {
    return [Notify('ADV_FORFEIT', seq, 'acquire adventure lock failed', caller)];
  }

  const adventure = await store.getAdventure(advId);
  if (adventure == null) {
    await store.releaseLocks(locks);
    return [Notify('ADV_FORFEIT', seq, 'no such adventure/user', caller)];
  }

  adventure.deready(caller);
  adventure.derecruit(caller);
  adventure.leave(caller);

  user.adventure = null;

  await store.setUser(caller, user);
  await store.setAdventure(advId, adventure);
  await store.releaseLocks(locks);

  const dbAdventure = await advRepo.findOne({
    where: {
      id: advId,
    },
    relations: {
      members: true,
    },
  });
  const dbUser = await userRepo.findOne({
    where: {
      username: caller,
    },
    relations: {
      adventures: true,
    },
  });

  if (dbAdventure) {
    dbAdventure.members = dbAdventure.members.filter((m) => {
      m.username !== caller;
    });
    advRepo.save(dbAdventure);
  }

  if (dbUser) {
    dbUser.adventures = dbUser.adventures.filter((adv) => {
      adv.id !== advId;
    });
    userRepo.save(dbUser);
  }

  const res: Wrapped_Message[] = [];
  for (const recruit of adventure.recruits) {
    if (recruit !== caller)
      res.push(WrappedState('ADV_FORFEIT', -1, await store.dumpState(recruit), recruit));
  }

  res.push(WrappedState('ADV_FORFEIT', seq, await store.dumpState(caller), caller));

  return res;
}
