import { randomInt } from "crypto";
import "reflect-metadata"
import { Worker, parentPort, threadId } from "worker_threads";
import { Receipt } from "./lib/interfaces";
import { Network, IncommingMsg, Notification} from "./lib/network";

const network = new Network(8081);
const workers: Worker[] = [];

const clientID2seq: {[key: string]: number} = {}
const seq2clientID: {[key: number]: string} = {}
const clientID2username: {[key: string]: string} = {}
const username2clientID: {[key: string]: string} = {}

network.on('message', (clientID: string, data: IncommingMsg) => {
    const workerId = randomInt(4);
    console.log(clientID, data);

    if(!(['LOGIN'].includes(data.action))) {
        if(!(clientID in clientID2username)) {
            network.emit('postMessage', seq2clientID[data.seq], {
                action: data.action,
                seq: data.seq,
                message: 'please login'
            } as Notification)
            return;
        }
    }

    clientID2seq[clientID] = data.seq;
    seq2clientID[data.seq] = clientID;

    // if it's not logged in, caller will be undefined
    data.caller = clientID2username[clientID];

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
        console.log(receipt);
        switch(receipt.receiptOf) {
            case 'LOGIN':
                if(receipt.status) {
                    const username: string = receipt.payload.username;
                    const clientID: string = seq2clientID[receipt.seq];

                    clientID2username[clientID] = username;
                    username2clientID[username] = clientID;
                }
                break
        }

        console.log(seq2clientID[receipt.seq])

        network.emit('postMessage', seq2clientID[receipt.seq], receipt);
        console.log(receipt)
    })

    workers.push(worker);
}