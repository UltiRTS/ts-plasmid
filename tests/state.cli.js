#!/usr/local/bin/node

const {WebSocket} = require('ws');
const {Command, program} = require('commander');
const { randomInt } = require('crypto');


program
    .name('state test util')
    .description('CLI of state testing')
    .version('1.0.0')

program
    .command('login')
    .argument('<username>')
    .argument('<password>').action((username, password) => {
        console.log(username, password)
        const ws = new WebSocket('ws://localhost:8080')
        ws.on('open', () => {
            ws.send(JSON.stringify({
                action: 'LOGIN',
                parameters: {
                    username: username,
                    password: password
                },
                seq: randomInt(1, 10000),
            }))
            console.log('request sent')
        })
        ws.on('message', (data) => {
            console.log(JSON.parse(data))
            ws.close()
        });
    });

program
    .command('add')
    .argument('<first>', 'integer argument', parseInt)
    .argument('[second]', 'integer argument', parseInt, 1000)
    .action((first, second) => {
        console.log(`${first} + ${second} = ${first + second}`);
    });

program.parse(process.argv)