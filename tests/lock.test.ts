import { RedisStore } from "../lib/store";
import { sleep } from "../lib/util";

import { Worker, isMainThread, threadId} from 'node:worker_threads'

if (isMainThread) {
  // This re-loads the current file inside a Worker instance.
  for(let i=0; i<50; i++) {
    new Worker('./tests/lock.test.ts', {
        execArgv: ['-r', 'ts-node/register/transpile-only']
    });
  }
} else {
    const store = new RedisStore();
    const lock = 'lock';

    store.emitter.on('initialized', async () => {
        await store.acquireLock(lock);
        console.log(`thread ${threadId} acquired lock`)
        sleep(500);
        await store.releaseLock(lock);
        console.log(`thread ${threadId} released lock`)
    })
}