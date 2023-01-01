import "reflect-metadata"
import { randomInt } from "crypto";
import { Worker, parentPort, threadId } from "worker_threads";
import { AutohostManager } from "./lib/autohost";
import { CMD, CMD_Adventure_recruit, CMD_Autohost_Kill_Engine, CMD_Autohost_Midjoin, CMD_Autohost_Start_Game, Receipt, State, Wrapped_Message } from "./lib/interfaces";
import { Network, IncommingMsg, Notification, wrapReceipt, wrapState} from "./lib/network";
import { RedisStore } from "./lib/store";

const network = new Network(8081);
const workers: Worker[] = [];
const store = new RedisStore();

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

        store.setOnline(Object.keys(username2clientID));
    }

    if(!(['LOGIN'].includes(data.action))) {
        if(!(clientID in clientID2username)) {
            network.emit('postMessage', seq2clientID[data.seq], {
                action: 'NOTIFY',
                seq: data.seq,
                message: 'please login',
                from: data.action
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

network.on('clean', async (clientID: string) => {
    const seq = clientID2seq[clientID];
    const username = clientID2username[clientID];
    console.log('trigering clean, user: ', username);

    const user = await store.getUser(username); 

    delete clientID2seq[clientID];
    delete clientID2username[clientID];
    delete seq2clientID[seq];
    delete username2clientID[username];

    store.setOnline(Object.keys(username2clientID));

    // pass cmd to workers to clean the redis cache
    const leaveGameMsg: IncommingMsg = {
        action: 'LEAVEGAME',
        type: 'client',
        seq: -1,
        caller: username,
        parameters: {},
        payload: {}
    }

    if(user?.adventure) {
        const leaveAdvMsg: IncommingMsg = {
            action: 'ADV_LEAVE',
            type: 'client',
            seq: -1,
            caller: username,
            parameters: {
                advId: user.adventure
            },
            payload: {}
        }
        workers[randomInt(4)].postMessage(leaveAdvMsg);
    }

    workers[randomInt(4)].postMessage(leaveGameMsg);

    if(!user) return;
    for(const room of user.chatRooms) {
        const leaveChatMsg: IncommingMsg = {
            action: 'LEAVECHAT',
            type: 'client',
            seq: -1,
            caller: username,
            payload: {},
            parameters: {
                chatName: room
            }
        }
        workers[randomInt(4)].postMessage(leaveChatMsg);
    }
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
    worker.on('message', async (msgs: Wrapped_Message[]) => {
        for(const msg of msgs) {
            for(const target of msg.targets) {
                switch(target) {
                    case 'client': {
                        // sustain the mapping
                        if(msg.receiptOf === 'LOGIN') {
                            const clientID = seq2clientID[msg.seq];
                            username2clientID[msg.client] = clientID;
                            clientID2username[clientID] = msg.client;
                        }

                        if(msg.payload.receipt) {
                            if(msg.seq !== -1) 
                                network.emit('postMessage', seq2clientID[msg.seq], wrapReceipt(msg.receiptOf, msg.seq, msg.payload.receipt));
                            else if(msg.client !== '' && username2clientID[msg.client] != null) {
                                network.emit('postMessage', username2clientID[msg.client], wrapReceipt(msg.receiptOf, msg.seq, msg.payload.receipt));
                            }
                        }
                        if(msg.payload.state) {
                            if(msg.seq !== -1) {
                                network.emit('postMessage', seq2clientID[msg.seq], wrapState(msg.receiptOf, msg.seq, msg.payload.state));
                            } else if(msg.client !== '' && username2clientID[msg.client] != null) {
                                network.emit('postMessage', username2clientID[msg.client], wrapState(msg.receiptOf, msg.seq, msg.payload.state));
                            }
                        }
                        break
                    }
                    case 'cmd': {
                        if(msg.payload.cmd) {
                            let cmd = msg.payload.cmd;
                            if(cmd.to === 'autohost') {
                                let autohostCmd = cmd as CMD;
                                switch(autohostCmd.action) {
                                    case 'STARTGAME': {
                                        let startCmd = cmd as CMD_Autohost_Start_Game;
                                        if(startCmd.payload.gameConf)
                                            autohostMgr.start(startCmd.payload.gameConf);
                                        else 
                                            console.log('empty gameconf')

                                        break;
                                    }
                                    case 'MIDJOIN': {
                                        let midjoinCmd = cmd as CMD_Autohost_Midjoin;
                                        const payload = midjoinCmd.payload;
                                        const title = payload.title;
                                        autohostMgr.midJoin(title, {
                                            playerName: payload.playerName,
                                            id: payload.id,
                                            isSpec: payload.isSpec,
                                            team: payload.team,
                                            token: payload.token
                                        })

                                        break;
                                    }
                                    case 'KILLENGINE': {
                                        let killCmd = cmd as CMD_Autohost_Kill_Engine;
                                        let payload = killCmd.payload;
                                        autohostMgr.killEngine({
                                            id: payload.id,
                                            title: payload.title
                                        })

                                        break;
                                    }
                                }
                            } else if(cmd.to === 'client') {
                            } else if(cmd.to === 'internal') {
                                console.log('internal message get called');
                                switch(cmd.action) {
                                    case 'ADV_RECRUIT': {
                                        let recruitCmd = cmd as CMD_Adventure_recruit
                                        let recruitPayload = recruitCmd.payload;
                                        const leaveChatMsg: IncommingMsg = {
                                            action: 'ADV_RECRUIT',
                                            type: 'internal',
                                            seq: -1,
                                            caller: msg.client,
                                            payload: {},
                                            parameters: {
                                                advId: recruitPayload.advId,
                                                friendName: recruitPayload.friendName,
                                                firstTime: recruitPayload.firstTime,
                                                caller: msg.client
                                            }
                                        }
                                        workers[randomInt(4)].postMessage(leaveChatMsg);
                                        break;
                                    }
                                }
                            }
                        }
                        break;
                    }
                    case 'all': {
                        if(!msg.payload.state) break;

                        const users = Object.keys(username2clientID);
                        for(const user of users) {
                            network.emit('postMessage', username2clientID[user], wrapState('DUMP2ALL', -1, await store.dumpState(user)));
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

autohostMgr.on('midJoined', (params: {
    title?: string
    player?: string
}) => {
    const internalMsg: IncommingMsg = {
        action: 'MIDJOINED',
        type: 'internal',
        seq: -1,
        caller: '',
        parameters: {
            ...params
        },
        payload: {}
    }

    workers[randomInt(4)].postMessage(internalMsg);
})