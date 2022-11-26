const {WebSocket} = require('ws');
const { randomInt } = require('crypto');
const readline = require('node:readline')
const {stdin, stdout} = require('node:process');
const { json } = require('stream/consumers');

let pingEnabled = false;
let opened = false;
const wsInit = () => {
    const ws = new WebSocket('ws://localhost:8081');
    ws.on('open', () => {
        opened = true;
    })

    ws.on('message', (data) => {
        const jsonData = JSON.parse(data);
        if(jsonData.action !== 'PING') {
            if(jsonData.state) {
                console.log(jsonData.state);
                // console.log(jsonData.state.user)
            } else {
                console.log(jsonData);
            }
        }
        switch(jsonData.action) {
            case 'JOINADV': {
                console.log(JSON.stringify(jsonData));
                break;
            }
            case 'LEAVECHAT': {
                // console.log(jsonData.state.user.chatRooms);
                break;
            }
            case 'SETAI': {
                console.log(jsonData.state.user.game);
                break;
            }
            case 'GAMESTARTED': {
                console.log(jsonData.state);
                break;
            }
            case 'SAYCHAT': {
                // for(const room in jsonData.state.user.chatRooms) {
                //     console.log(jsonData.state.user.chatRooms[room]);
                // }
                break;
            }
            case 'PING': {
                if(pingEnabled) {
                    ws.send(JSON.stringify({
                        action: 'PONG',
                        parameters: {}
                    }))
                }
                break;
            }
            case 'CLAIMCONFIRM': {
                console.log(jsonData.state.user.confirmations);
                break;
            }
            case 'MIDJOINED': {
                console.log('midjoined');
                break;
            }
        }
    });

    ws.on('close', async () => {
        opened = false;
        console.log('closed')
    })

    return ws;
}
const main = async () => {
    const rl = readline.createInterface({
        input: stdin,
        output: stdout
    })
    let ws = wsInit();


    const help = "type help to get help\n supporting commands\n"
        + "login <username> <password>\n"
        + "joinchat <room> <password>\n"
        + "saychat <room> <message>\n"

    for await (const line of rl) {
        if(line.startsWith('quit')) break;
        if(line.startsWith('help')) {
            console.log(help);
            continue;
        }


        let cmd = line.split(' ');
        if(cmd[0] == 'reconnect') {
            ws = wsInit();
        }

        if(!opened) {
            console.log('not connected to server')
            continue;
        }
        switch(cmd[0]) {
            case 'login': {
                let username = cmd[1];
                let password = cmd[2];

                ws.send(JSON.stringify({
                    action: 'LOGIN',
                    parameters: {
                        username,
                        password
                    },
                    seq: randomInt(0, 1000000)
                }))
                break;
            }
            case 'joinchat': {
                let room = cmd[1];
                let password = cmd[2];
                
                ws.send(JSON.stringify({
                    action: 'JOINCHAT',
                    parameters: {
                        chatName: room,
                        password
                    },
                    seq: randomInt(0, 1000000)
                }))
                break;
            }
            case 'leavechat': {
                let room = cmd[1];
                
                ws.send(JSON.stringify({
                    action: 'LEAVECHAT',
                    parameters: {
                        chatName: room
                    },
                    seq: randomInt(0, 1000000)
                }))
                break;
            }
            case 'saychat': {
                let room = cmd[1];
                let message = cmd[2];
                
                ws.send(JSON.stringify({
                    action: 'SAYCHAT',
                    parameters: {
                        chatName: room,
                        message
                    },
                    seq: randomInt(0, 1000000)
                }))
                break;
            }
            case 'joingame': {
                let gameName = cmd[1];
                let password = cmd[2];
                let mapId = parseInt(cmd[3]) || 0;

                ws.send(JSON.stringify({
                    action: 'JOINGAME',
                    parameters: {
                        gameName,
                        password,
                        mapId
                    },
                    seq: randomInt(0, 1000000)
                }))
                break;
            }
            case 'setai': {
                let game = cmd[1]
                let type = cmd[2]
                let ai = cmd[3]
                let team = cmd[4]

                ws.send(JSON.stringify({
                    action: 'SETAI',
                    parameters: {
                       gameName: game,
                       AI: ai,
                       team: team,
                       type: type
                    },
                    seq: randomInt(0, 1000000)
                }))
                break;
            }
            case 'delai': {
                let game = cmd[1]
                let type = cmd[2]
                let ai = cmd[3]

                ws.send(JSON.stringify({
                    action: 'DELAI',
                    parameters: {
                        gameName: game,
                        AI: ai,
                        type: type
                    },
                    seq: randomInt(0, 1000000)
                }))
                break;
            }
            case 'setteam': {
                let game = cmd[1]
                let player = cmd[2]
                let team = cmd[3]

                ws.send(JSON.stringify({
                    action: 'SETTEAM',
                    parameters: {
                        gameName: game,
                        player: player,
                        team: team
                    },
                    seq: randomInt(0, 1000000)
                }))
                break;
            }
            case 'setmap': {
                let game = cmd[1]
                let mapId = parseInt(cmd[2])

                ws.send(JSON.stringify({
                    action: 'SETMAP',
                    parameters: {
                        gameName: game,
                        mapId: mapId
                    },
                    seq: randomInt(0, 10000000)
                }))
                break;
            }
            case 'fault': {
                ws.send(JSON.stringify({
                    action: 'FAULT',
                    parameters: {
                    }
                }))
                break;
            }
            case 'startgame': {
                ws.send(JSON.stringify({
                    action: 'STARTGAME',
                    parameters: {},
                    seq: randomInt(0, 1000000)
                }))
                break;
            }
            case 'hasmap': {
                const mapId = cmd[1];
                ws.send(JSON.stringify({
                    action: 'HASMAP',
                    parameters: {
                        mapId
                    },
                    seq: randomInt(0, 1000000)
                }))
                break;
            }
            case 'setspec': {
                const gameName = cmd[1];
                const player = cmd[2];
                ws.send(JSON.stringify({
                    action: 'SETSPEC',
                    parameters: {
                        gameName,
                        player
                    },
                    seq: randomInt(0, 1000000)
                }))
                break;
            }
            case 'leavegame': {
                ws.send(JSON.stringify({
                    action: 'LEAVEGAME',
                    parameters: {},
                    seq: randomInt(0, 1000000)
                }))
                break;
            }
            case 'enableping': {
                pingEnabled = true;
                break;
            }
            case 'disableping': {
                pingEnabled = false;
                break;
            }
            case 'midjoin': {
                ws.send(JSON.stringify({
                    action: 'MIDJOIN',
                    parameters: {},
                    seq: randomInt(0, 1000000)
                }))
                break;
            }
            case 'killEngine': {
                ws.send(JSON.stringify({
                    action: 'KILLENGINE',
                    parameters: {},
                    seq: randomInt(0, 1000000)
                }))
                break;
            }

            case 'addFriend': {
                const friendName = cmd[1];
                ws.send(JSON.stringify({
                    action: 'ADDFRIEND',
                    parameters: {
                        friendName 
                    },
                    seq: randomInt(0, 1000000)
                }))
                break;
            }
            case 'claim': {
                const confirmationId = cmd[1];
                const type = cmd[2];
                const agree = cmd[3];

                ws.send(JSON.stringify({
                    action: 'CLAIMCONFIRM',
                    parameters: {
                        confirmationId,
                        type,
                        agree 
                    },
                    seq: randomInt(0, 1000000)
                }))
                break;
            }
            case 'setmod': {
                const mod = cmd[1];
                ws.send(JSON.stringify({
                    action: 'SETMOD',
                    parameters: {
                        mod
                    },
                    seq: randomInt(0, 1000000)
                }))
                break;
            }

            case 'joinadv': {
                const adv = cmd[1];
                ws.send(JSON.stringify({
                    action: 'JOINADV',
                    parameters: {
                        advName: adv
                    },
                    seq: randomInt(0, 1000000)
                }))
                break;
            }

            case 'moveto': {
                const adv = cmd[1];
                const floorIn = cmd[2];
                const nodeTo = cmd[3];
                ws.send(JSON.stringify({
                    action: 'MOVETO',
                    parameters: {
                        advName: adv,
                        floorIn,
                        nodeTo
                    },
                    seq: randomInt(0, 1000000)
                }))
                break;
            }
        }
    }

}

main()