const {WebSocket} = require('ws');
const { randomInt } = require('crypto');
const readline = require('node:readline')
const {stdin, stdout} = require('node:process');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const main = async () => {
    const rl = readline.createInterface({
        input: stdin,
        output: stdout
    })
    let opened = false;

    const ws = new WebSocket('ws://localhost:8081');
    ws.on('open', () => {
        opened = true;
    })

    ws.on('message', (data) => {
        const jsonData = JSON.parse(data);
        console.log(jsonData)
        switch(jsonData.action) {
            case 'LEAVECHAT': {
                console.log(jsonData.state.user.chatRooms);
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
                for(const room in jsonData.state.user.chatRooms) {
                    console.log(jsonData.state.user.chatRooms[room]);
                }
                break;
            }
        }
    });

    ws.on('close', () => {
        opened = false;
        console.log('closed')
    })

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

        if(!opened) {
            console.log('not connected to server')
            continue;
        }

        let cmd = line.split(' ');
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
        }
    }

}

main()
