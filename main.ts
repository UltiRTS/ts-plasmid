import { randomInt } from "crypto";
import { Worker, parentPort, threadId } from "worker_threads";
import { Network, IncommingMsg } from "./lib/network";
import { State } from "./lib/state";

const state: State = new State();
const workers: Worker[] = [];
const network: Network = new Network(8080);
const clientID2username = {};

for(let i=0; i<4; i++) {
    let worker = new Worker('./worker.js');
    worker.on('online', () => {
        console.log(`Worker ${worker.threadId} online`);
    })
    worker.on('exit', (code) => {
        console.log(`worker ${worker.threadId} exited with code ${code}`);
    })
    worker.on('message', (msg) => {
        console.log(msg);
    })
}

network.on('message', (clientID: string, msg: IncommingMsg) => {
    let worker = workers[randomInt(0, workers.length)];

    switch(msg.action) {
        case 'LOGIN': {
            worker.postMessage(msg);
        }
    }
})