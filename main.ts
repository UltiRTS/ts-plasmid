import { randomInt } from "crypto";
import "reflect-metadata"
import { Worker, parentPort, threadId } from "worker_threads";
import { AutohostManager } from "./lib/autohost";
import { CMD, CMD_Autohost_Start_Game, Receipt, State } from "./lib/interfaces";
import { Network, IncommingMsg, Notification} from "./lib/network";

const network = new Network(8081);
const workers: Worker[] = [];

const clientID2seq: {[key: string]: number} = {}
const seq2clientID: {[key: number]: string} = {}
const clientID2username: {[key: string]: string} = {}
const username2clientID: {[key: string]: string} = {}

const autohostMgr = new AutohostManager([], {
   port: 5000 
});

network.on('message', (clientID: string, data: IncommingMsg) => {

    clientID2seq[clientID] = data.seq;
    seq2clientID[data.seq] = clientID;

    const workerId = randomInt(4);
    console.log(clientID, data);

    // if action is login and the user is not logged in, set the clientID to username
    if(data.action === 'LOGIN' && !(data.parameters.username in username2clientID)) {
        const username = data.parameters.username;

        clientID2username[clientID] = username;
        username2clientID[username] = clientID;
    }

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


    data.caller = clientID2username[clientID];
    data.type = 'client';

    workers[workerId].postMessage(data)
})

for(let i=0; i<4; i++) {
    let worker = new Worker('./worker.ts', {
        execArgv: ['-r', 'ts-node/register/transpile-only']
    });
    worker.on('online', () => {
        console.log(`Worker ${worker.threadId} online`);
    })
    worker.on('exit', (code) => {
        console.log(`worker ${worker.threadId} exited with code ${code}`);
    })
    worker.on('message', (payload:{
        receiptOrState: Receipt | State | CMD, 
        seq: number,
        type: string
    }) => {
        switch(payload.type) {
            case 'network': {
                network.emit('postMessage', seq2clientID[payload.seq], payload.receiptOrState);
                break
            }
            case 'cmd': {
                let cmd = payload.receiptOrState as CMD;
                if(cmd.to === 'autohost') {
                    let autohostCmd = cmd as CMD_Autohost_Start_Game;
                    autohostMgr.start(autohostCmd.payload.gameConf);
                }
                break;
            }
        }
    })

    workers.push(worker);
}