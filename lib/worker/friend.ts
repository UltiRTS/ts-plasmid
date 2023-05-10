import { Mark } from '../../db/models/user';
import { RedisStore } from '../store';
import { Notify, WrappedState } from '../util';
import { markRepo, store, userRepo } from './shared';

export async function markFriend(params: {
  friendName?: string
  text?: string
  [key: string]: any
}, seq: number, caller: string) {
  const friendName = params.friendName;
  const text = params.text;

  if (friendName == null || text == null)
    return [Notify('FRIEND_MARK', seq, 'insufficient parameters', caller)];

  const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');
  try {
    await store.acquireLock(USER_LOCK);
  }
  catch {
    return [Notify('FRIEND_MARK', seq, 'acquire user lock failed', caller)];
  }

  const dbUser = await userRepo.findOne({
    where: {
      username: caller,
    },
  });
  const dbFriend = await userRepo.findOne({
    where: {
      username: friendName,
    },
  });
  const user = await store.getUser(caller);

  if (dbUser == null || user == null || dbFriend == null) {
    await store.releaseLock(USER_LOCK);
    return [Notify('FRIEND_UNMARK', seq, 'user/friend not exists', caller)];
  }

  let mark = new Mark();
  mark.mark = text;
  mark.target = dbFriend;
  mark.user = dbUser;

  mark = await markRepo.save(mark);

  user.marks2dump = [
    ...user.marks2dump,
    {
      id: mark.id,
      name: friendName,
      mark: text,
    },
  ];

  await store.setUser(caller, user);

  await store.releaseLock(USER_LOCK);

  return [WrappedState('FRIEND_MARK', seq, await store.dumpState(caller), caller)];
}

export async function unMarkFriend(params: {
  friendName?: string
  markId?: number
  [key: string]: any
}, seq: number, caller: string) {
  const friendName = params.friendName;
  const markId = params.markId;

  if (friendName == null || markId == null)
    return [Notify('FRIEND_UNMARK', seq, 'insufficient parameters', caller)];

  const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');
  try {
    await store.acquireLock(USER_LOCK);
  }
  catch {
    return [Notify('FRIEND_UNMARK', seq, 'acquire user lock failed', caller)];
  }

  const dbUser = await userRepo.findOne({
    where: {
      username: caller,
    },
  });
  const dbFriend = await userRepo.findOne({
    where: {
      username: friendName,
    },
  });
  const user = await store.getUser(caller);

  if (dbUser == null || user == null || dbFriend == null) {
    await store.releaseLock(USER_LOCK);
    return [Notify('FRIEND_UNMARK', seq, 'user/friend not exists', caller)];
  }

  const mark = await markRepo.findOne({
    where: {
      id: markId,
    },
    relations: {
      user: true,
      target: true,
    },
  });

  if (mark && mark.user.username === caller) {
    markRepo.delete(mark.id);
    user.marks2dump = user.marks2dump.filter(x => x.id !== markId);
  }
  else {
    await store.releaseLock(USER_LOCK);
    return [Notify('FRIEND_UNMARK', seq, 'mark doesn\'t belongs to you', caller)];
  }

  await store.setUser(caller, user);
  await store.releaseLock(USER_LOCK);

  return [WrappedState('FRIEND_UNMARK', seq, await store.dumpState(caller), caller)];
}

export async function removeFriend(params: {
  friendName?: string
  [key: string]: any
}, seq: number, caller: string) {
  const friendName = params.friendName;

  if (friendName == null)
    return [Notify('FRIEND_REMOVE', seq, 'insufficient parameters', caller)];

  const USER_LOCK = RedisStore.LOCK_RESOURCE(caller, 'user');
  try {
    await store.acquireLock(USER_LOCK);
  }
  catch {
    return [Notify('FRIEND_REMOVE', seq, 'acquire user lock failed', caller)];
  }

  const dbUser = await userRepo.findOne({
    where: {
      username: caller,
    },
    relations: {
      friends: true,
    },
  });
  const dbFriend = await userRepo.findOne({
    where: {
      username: friendName,
    },
    relations: {
      friends: true,
    },
  });
  const user = await store.getUser(caller);

  if (dbUser == null || user == null || dbFriend == null) {
    await store.releaseLock(USER_LOCK);
    return [Notify('FRIEND_REMOVE', seq, 'user/friend not exists', caller)];
  }

  dbUser.friends = dbUser.friends.filter(friend => friend.username !== friendName);
  dbFriend.friends = dbFriend.friends.filter(friend => friend.username !== caller);

  await userRepo.save(dbUser);
  await userRepo.save(dbFriend);

  user.friends2dump = user.friends2dump.filter(f => f !== friendName);

  await store.setUser(caller, user);
  await store.releaseLock(USER_LOCK);

  return [WrappedState('FRIEND_REMOVE', seq, await store.dumpState(caller), caller)];
}
