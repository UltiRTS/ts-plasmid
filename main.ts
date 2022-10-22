import { randomInt } from "crypto";
import "reflect-metadata"
import { Worker, parentPort, threadId } from "worker_threads";
import { Receipt } from "./lib/interfaces";
import { Network } from "./lib/network";

const network = new Network(8081);
const workers: Worker[] = [];

network.on('message', (clientID: string, data: any) => {
    const workerId = randomInt(4);
    workers[workerId].postMessage(data)
})

for(let i=0; i<4; i++) {
    let worker = new Worker('./worker.js');
    worker.on('online', () => {
        console.log(`Worker ${worker.threadId} online`);
    })
    worker.on('exit', (code) => {
        console.log(`worker ${worker.threadId} exited with code ${code}`);
    })
    worker.on('message', (receipt: Receipt) => {
        console.log(receipt)
    })

    workers.push(worker);
}