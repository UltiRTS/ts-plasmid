const {WebSocket} = require('ws');
const { randomInt } = require('crypto');
const readline = require('node:readline')
const {stdin, stdout} = require('node:process');

const main = async () => {
    const rl = readline.createInterface({
        input: stdin,
        output: stdout
    })
    let opened = false;

    const ws = new WebSocket('ws://localhost:8080');
    ws.on('open', () => {
        opened = true;
    })

    ws.on('message', (data) => {
        console.log(JSON.parse(data))
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
            }
        }
    }

}

main()