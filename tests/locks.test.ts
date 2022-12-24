import { randomInt } from "node:crypto";
import { RedisStore } from "../lib/store";
import { sleep } from "../lib/util";
import { Worker, isMainThread, threadId} from 'node:worker_threads'

const NUM_WORKERS = 20;
const NUM_OPERATIONS = 50;

if (isMainThread) {
  // This re-loads the current file inside a Worker instance.
  for(let i=0; i<NUM_WORKERS; i++) {
    new Worker('./tests/lock.test.ts', {
        execArgv: ['-r', 'ts-node/register/transpile-only']
    });
  }
} else {
    const store = new RedisStore();
    const locks = ['lock1', 'lock2'];

    store.emitter.on('initialized', async () => {
        for(let i=0; i<NUM_OPERATIONS; i++) {
            let num = randomInt(1000000);

            if(num % 2 === 0) {
                await acuqireSingle(locks);
                console.log(`thread ${threadId} acquired single`)
            } else {
                await acquireAll(locks);
                console.log(`thread ${threadId} acquired all`)
            }

            sleep(randomInt(0, 200));
        }
    })

    async function acuqireSingle(locks: string[]) {
        let lock2acquire = locks[randomInt(locks.length)];
        await store.acquireLock(lock2acquire);
    }

    async function acquireAll(locks: string[]) {
        await store.acquireLocks(locks);
    }
}
