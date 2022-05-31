import "reflect-metadata"
import { randomInt } from "crypto";
import { Worker, parentPort, threadId } from "worker_threads";
import { Network, IncommingMsg } from "./lib/network";
import { State } from "./lib/state";
import { Receipt } from "./worker";
import {User} from './lib/states/user';
import {User as DBUser} from './db/models/user';
import { ChatRoom as DBChatRoom } from "./db/models/chat";
import { ChatRoom } from "./lib/states/chat";
import { fullfillParameters, CMD_PARAMETERS } from "./lib/util";

const state: State = new State();
const workers: Worker[] = [];
const network: Network = new Network(8080);
// clientID -> username
const clientID2username: Record<string, string> = {};
const username2clientID: Record<string, string> = {};
// seq -> clientID
const seq2respond: Record<number, string> = {};
let seqCount = 0

for(let i=0; i<4; i++) {
    let worker = new Worker('./worker.js');
    worker.on('online', () => {
        console.log(`Worker ${worker.threadId} online`);
    })
    worker.on('exit', (code) => {
        console.log(`worker ${worker.threadId} exited with code ${code}`);
    })
    worker.on('message', async (msg: Receipt) => {
        switch(msg.receiptOf) {
            case 'LOGIN': {
                if(msg.status) {
                    const user: DBUser = msg.payload.user;
                    const stateUser = new User(user);
                    clientID2username[seq2respond[msg.seq]] = user.username;
                    username2clientID[user.username] = seq2respond[msg.seq];

                    state.addUser(stateUser);
                    console.log(stateUser)

                    network.emit('postMessage', seq2respond[msg.seq], {
                        action: 'LOGIN',
                        seq: msg.seq,
                        state: state.dump(stateUser.username)
                    })
                } else {
                    network.emit('postMessage', seq2respond[msg.seq], {
                        action: 'NOTIFY',
                        seq: msg.seq,
                        message: msg.message,
                    })
                }

                break;
            }
            case 'JOINCHAT': {
                const chatRoom: DBChatRoom = msg.payload.chatRoom;
                if(msg.status) {
                    if(msg.payload.type === 'CREATE') {
                        const stateChatRoom = new ChatRoom(chatRoom);
                        const user = state.getUser(clientID2username[seq2respond[msg.seq]]);
                        if(user!==null) {
                            stateChatRoom.join(user);
                            await state.addChat(stateChatRoom);
                            console.log(stateChatRoom)

                            network.emit('postMessage', seq2respond[msg.seq], {
                                action: 'JOINCHAT',
                                seq: msg.seq,
                                state: state.dump(user.username)
                            })
                        }
                    } else if(msg.payload.type === 'JOIN') {
                        console.log('joining')
                        const stateChatRoom = state.getChat(chatRoom.roomName);
                        console.log(stateChatRoom);
                        if(stateChatRoom === null) {
                            network.emit('postMessage', seq2respond[msg.seq], {
                                action: 'NOTIFY',
                                seq: msg.seq,
                                message: 'Chat room may be dismissed',
                            })
                            break;
                        }

                        const user = state.getUser(clientID2username[seq2respond[msg.seq]]);
                        if(user !== null) {
                            stateChatRoom.join(user);
                            await state.assignChat(stateChatRoom.roomName, stateChatRoom);
                            console.log(stateChatRoom)
                            network.emit('postMessage', seq2respond[msg.seq], {
                                action: 'JOINCHAT',
                                seq: msg.seq,
                                state: state.dump(user.username)
                            })
                        }
                    }
                } else {
                    network.emit('postMessage', seq2respond[msg.seq], {
                        action: 'NOTIFY',
                        seq: msg.seq,
                        message: msg.message,
                    })
                }
                state.releaseChat(chatRoom.roomName);
                break;
            }
            case 'SAYCHAT': {
                const chat: ChatRoom = msg.payload.chat;
                if(msg.status) {
                    await state.assignChat(chat.roomName, chat);
                    console.log(chat)
                    console.log(chat.lastMessage)

                    for(const member of chat.members) {
                        network.emit('postMessage', username2clientID[member], {
                            action: 'SAYCHAT',
                            seq: msg.seq,
                            state: state.dump(clientID2username[seq2respond[msg.seq]])
                        })
                    }
                } else {
                    network.emit('postMessage', seq2respond[msg.seq], {
                        action: 'NOTIFY',
                        seq: msg.seq,
                        message: msg.message,
                    })
                }
                state.releaseChat(chat.roomName);
                break;
            }
            case 'LEAVECHAT': {
                const chat: ChatRoom = msg.payload.chat;
                if(msg.status) {
                    await state.assignChat(chat.roomName, chat);
                    console.log(chat)

                    network.emit('postMessage', seq2respond[msg.seq], {
                        action: 'LEAVECHAT',
                        seq: msg.seq,
                        state: state.dump(clientID2username[seq2respond[msg.seq]])
                    })
                } else {
                    network.emit('postMessage', seq2respond[msg.seq], {
                        action: 'NOTIFY',
                        seq: msg.seq,
                        message: msg.message,
                    })
                }
                state.releaseChat(chat.roomName);
                break;
            }
        }
        delete seq2respond[msg.seq];
    })

    workers.push(worker)
}

network.on('message', async (clientId: string, msg: IncommingMsg) => {
    let worker = workers[randomInt(0, workers.length)];


    console.log(`msg from ${clientId} with seq ${msg.seq}`)

    if(msg.action === 'GETSEQ') {
        network.emit('postMessage', clientId, {
            action: 'GETSEQ',
            seq: seqCount,
        })

        seqCount++;
        if(seqCount > 10000000000) seqCount = 0;

        return;
    }

    if(msg.action in CMD_PARAMETERS && !(fullfillParameters(msg.action as keyof typeof CMD_PARAMETERS, msg.parameters))) {
        network.emit('postMessage', clientId, {
            action: 'NOTIFY',
            seq: msg.seq,
            message: 'Invalid parameters',
        })
        return;
    }


    if(!msg.seq) {
        network.emit('postMessage', clientId, {
            action: 'NOTIFY',
            message: 'seq not found',
        });
        return
    }
    if(msg.seq in seq2respond) {
        network.emit('postMessage', clientId, {
            action: 'NOTIFY',
            message: 'seq already used',
        });
        return
    }


    // record in mem only if message have seq, right cmd and sufficient parameters
    seq2respond[msg.seq] = clientId;

    // need filter for permission

    switch(msg.action) {
        case 'LOGIN': {
            worker.postMessage(msg);
            break;
        }
        case 'JOINCHAT': {
            const chat = state.getChat(msg.parameters.chatName);
            if(!(chat === null)) await state.lockChat(chat.roomName);

            msg.payload = {
                chat: chat
            }
            worker.postMessage(msg);
            break;
        }
        case 'SAYCHAT': {
            const chat = state.getChat(msg.parameters.chatName);
            if(!(chat === null)) await state.lockChat(chat.roomName);

            msg.payload = {
                chat,
                user: state.getUser(clientID2username[clientId])
            }
            worker.postMessage(msg);
            break;
        }
        case 'LEAVECHAT': {
            const chat = state.getChat(msg.parameters.chatName);
            if(!(chat === null)) await state.lockChat(chat.roomName);

            msg.payload = {
                chat: state.getChat(msg.parameters.chatName),
                user: state.getUser(clientID2username[clientId])
            }
            worker.postMessage(msg);
            break;
        }
    }
})