import "reflect-metadata"
import { randomInt } from "crypto";
import { Worker, parentPort, threadId } from "worker_threads";
import { AutohostManager } from "./lib/autohost";
import { CMD, CMD_Autohost_Start_Game, Receipt, State, Wrapped_Message } from "./lib/interfaces";
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

    // clear temporary caller set
    if(data.action === 'LOGIN') {
        const username = data.parameters.username;

        delete clientID2username[clientID];
        delete username2clientID[username];
    }


})

network.on('clean', (clientID: string) => {
    const seq = clientID2seq[clientID];
    const username = clientID2username[clientID];

    delete clientID2seq[clientID];
    delete clientID2username[clientID];
    delete seq2clientID[seq];
    delete username2clientID[username];

    // pass cmd to workers to clean the redis cache
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
    worker.on('message', (msgs: Wrapped_Message[]) => {
        for(const msg of msgs) {
            for(const target of msg.targets) {
                switch(target) {
                    case 'network': {
                        if(msg.receiptOf === 'LOGIN') {
                            const clientID = seq2clientID[msg.seq];
                            username2clientID[msg.client] = clientID;
                            clientID2username[clientID] = msg.client;
                        }

                        if(msg.payload.receipt) {
                            if(msg.seq !== -1) 
                                network.emit('postMessage', seq2clientID[msg.seq], msg.payload.receipt);
                            else if(msg.client !== '' && username2clientID[msg.client] != null) {
                                network.emit('postMessage', username2clientID[msg.client], msg.payload.receipt);
                            }
                        }
                        if(msg.payload.state) {
                            if(msg.seq !== -1) {
                                network.emit('postMessage', seq2clientID[msg.seq], msg.payload.state);
                            } else if(msg.client !== '' && username2clientID[msg.client] != null) {
                                network.emit('postMessage', username2clientID[msg.client], msg.payload.state);
                            }
                        }
                        break
                    }
                    case 'cmd': {
                        if(msg.payload.cmd) {
                            let cmd = msg.payload.cmd;
                            if(cmd.to === 'autohost') {
                                let autohostCmd = cmd as CMD_Autohost_Start_Game;
                                switch(autohostCmd.action) {
                                    case 'STARTGAME': {
                                        if(autohostCmd.payload.gameConf)
                                            autohostMgr.start(autohostCmd.payload.gameConf);
                                        else 
                                            console.log('empty gameconf')

                                        break;
                                    }
                                }
                            }
                        }
                        break;
                    }
                }
            }
        }
    })

    workers.push(worker);
}

autohostMgr.on('gameStarted', (msg: {
    gameName: string,
    payload: {
        autohost: string
        port: number
    }
}) => {
    const internalMsg: IncommingMsg = {
        action: 'GAMESTARTED',
        type: 'internal',
        seq: -1,
        caller: '',
        parameters: {
            ...msg.payload,
            gameName: msg.gameName
        },
        payload: {}
    }

    workers[randomInt(4)].postMessage(internalMsg);
})

autohostMgr.on('gameEnded', (gameName) => {
    const internalMsg: IncommingMsg = {
        action: 'GAMEENDED',
        type: 'internal',
        seq: -1,
        caller: '',
        parameters: {
            gameName
        },
        payload: {}
    }

    workers[randomInt(4)].postMessage(internalMsg);
})