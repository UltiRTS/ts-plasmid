import { randomInt } from 'node:crypto';
import { Worker, isMainThread, threadId } from 'node:worker_threads';
import { RedisStore } from '../lib/store';
import { sleep } from '../lib/util';

const NUM_THREAD = 10;
const NUM_CMDS = 100;

if (isMainThread) {
  // This re-loads the current file inside a Worker instance.
  for (let i = 0; i < NUM_THREAD; i++) {
    new Worker('./tests/lock.test.ts', {
      execArgv: ['-r', 'ts-node/register/transpile-only'],
    });
  }
}
else {
  const store = new RedisStore();
  const locks = ['lock', 'lock1'];

  store.emitter.on('initialized', async () => {
    for (let i = 0; i < NUM_CMDS; i++) {
      const num = randomInt(10000);

      if (num % 2 == 0) {
        const lock = locks[randomInt(locks.length)];
        await store.acquireLock(lock);
        console.log(`thread ${threadId} acquired lock`);
        sleep(500);
        await store.releaseLock(lock);
        console.log(`thread ${threadId} released lock`);
      }
      else {
        await store.acquireLocks(locks);
        console.log(`thread ${threadId} acquired locks`);
        sleep(500);
        await store.releaseLocks(locks);
        console.log(`thread ${threadId} released locks`);
      }
    }
  });
}
