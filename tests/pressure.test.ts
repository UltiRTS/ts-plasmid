import {Worker, isMainThread, threadId} from 'node:worker_threads';
import { WebSocket } from 'ws';
import { randomInt } from'crypto';
import { EventEmitter } from 'node:stream';
import { exit } from 'node:process';

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const main = async () => {
    if(isMainThread) {
        for(let i=0; i<1; i++) {
            new Worker('./tests/pressure.test.ts', {
                execArgv: ['-r', 'ts-node/register/transpile-only']
            });
        }
    } else {
        pressureTest();
    }
}

const stats: {
    [action: string]: {
        success: number
        failure: number
        locked: number
    }
} = {};

const NUM_CMDS = 100;

const pressureTest = async () => {
    const ws = new WebSocket('ws://localhost:8081');
    const emitter = new EventEmitter();

    const joinChat = () => {
        ws.send(JSON.stringify({
            action: 'JOINCHAT',
            parameters: {
                room: 'test',
                password: ''
            },
            seq: randomInt(0, 10000000)
        }))
    }

    const sayChat = () => {
        ws.send(JSON.stringify({
            action: 'SAYCHAT',
            parameters: {
                chatName: 'test',
                message: 'hello from test'
            },
            seq: randomInt(0, 10000000)
        }))
    }

    const leaveChat = () => {
        ws.send(JSON.stringify({
            action: 'LEAVECHAT',
            parameters: {
                chatName: 'test',
            },
            seq: randomInt(0, 10000000)
        }))
    }

    const joinGame = () => {
        ws.send(JSON.stringify({
            action: 'JOINGAME',
            parameters: {
                gameName: 'test',
                password: '',
                mapId: 30
            },
            seq: randomInt(0, 10000000)
        }))
    }

    const leaveGame = () => {
        ws.send(JSON.stringify({
            action: 'LEAVEGAME',
            parameters: {
                gameName: 'test',
            },
            seq: randomInt(0, 10000000)
        }))
    }

    // const handlerList = [joinChat, sayChat, leaveChat, joinGame, leaveGame];
    const handlerList = [joinGame, ];

    emitter.on('loggedIn', async () => {
        for(let i=0; i<NUM_CMDS; i++) {
            const cmd2call = handlerList[randomInt(handlerList.length)];
            cmd2call(); 
            // await sleep(randomInt(0, 200));
        }
    })

    emitter.on('done', () => {
        console.log(`stats for ${threadId}:`, stats);
    })

    ws.on('open', () => {
        const username = `test_${threadId}`;
        const password = 'test';
        ws.send(JSON.stringify({
            action: 'LOGIN',
            parameters: {
                username,
                password
            },
            seq: randomInt(0, 1000000)
        }))
    })

    let counter = 0;
    ws.on('message', (data) => {
        
        const jsonData = JSON.parse(data.toString());
        if(jsonData.action === 'PING') return;

        if(jsonData.action === 'LOGIN') {
            emitter.emit('loggedIn');
        }

        if(jsonData.action === 'NOTIFY') {
            if(!Object.keys(stats).includes(jsonData.from)) {
                stats[jsonData.from] = {
                    success: 0,
                    failure: 0,
                    locked: 0
                }
            }
            stats[jsonData.from].failure++;
            if(jsonData.message.includes('lock')) {
                stats[jsonData.from].locked++;
            }
        } else {
            if(!Object.keys(stats).includes(jsonData.action)) {
                stats[jsonData.action] = {
                    success: 0,
                    failure: 0,
                    locked: 0
                }
            }
            stats[jsonData.action].success++;
        }

        counter++;
        if(counter > NUM_CMDS) emitter.emit('done');
    })
}

main();