const { randomInt } = require('node:crypto');
const readline = require('node:readline');
const { stdin, stdout } = require('node:process');
const { json } = require('node:stream/consumers');
const { WebSocket } = require('ws');

let pingEnabled = false;
let opened = false;
function wsInit() {
  const ws = new WebSocket('ws://localhost:8081');
  ws.on('open', () => {
    opened = true;
  });

  ws.on('message', (data) => {
    const jsonData = JSON.parse(data);
    if (jsonData.action !== 'PING') {
      if (jsonData.state) {
        console.log(jsonData.state);
        console.log(jsonData.state.user.confirmations);
        // console.log(jsonData.state.user)
      }
      else {
        console.log('json data', jsonData);
      }
    }
    switch (jsonData.action) {
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
        if (pingEnabled) {
          ws.send(JSON.stringify({
            action: 'PONG',
            parameters: {},
          }));
        }
        break;
      }
      case 'CLAIMCONFIRM': {
        console.log('length of confirms:', jsonData.state.user.confirmations.length);
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
    console.log('closed');
  });

  return ws;
}
async function main() {
  const rl = readline.createInterface({
    input: stdin,
    output: stdout,
  });
  let ws = wsInit();

  const help = 'type help to get help\n supporting commands\n'
        + 'login <username> <password>\n'
        + 'joinchat <room> <password>\n'
        + 'saychat <room> <message>\n';

  for await (const line of rl) {
    if (line.startsWith('quit'))
      break;
    if (line.startsWith('help')) {
      console.log(help);
      continue;
    }

    const cmd = line.split(' ');
    if (cmd[0] == 'reconnect')
      ws = wsInit();

    if (!opened) {
      console.log('not connected to server');
      continue;
    }
    switch (cmd[0]) {
      case 'login': {
        const username = cmd[1];
        const password = cmd[2];

        ws.send(JSON.stringify({
          action: 'LOGIN',
          parameters: {
            username,
            password,
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }
      case 'joinchat': {
        const room = cmd[1];
        const password = cmd[2];

        ws.send(JSON.stringify({
          action: 'JOINCHAT',
          parameters: {
            chatName: room,
            password,
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }
      case 'leavechat': {
        const room = cmd[1];

        ws.send(JSON.stringify({
          action: 'LEAVECHAT',
          parameters: {
            chatName: room,
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }
      case 'saychat': {
        const room = cmd[1];
        const message = cmd[2];

        ws.send(JSON.stringify({
          action: 'SAYCHAT',
          parameters: {
            chatName: room,
            message,
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }
      case 'joingame': {
        const gameName = cmd[1];
        const password = cmd[2];
        const mapId = parseInt(cmd[3]) || 0;

        ws.send(JSON.stringify({
          action: 'JOINGAME',
          parameters: {
            gameName,
            password,
            mapId,
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }
      case 'setai': {
        const game = cmd[1];
        const type = cmd[2];
        const ai = cmd[3];
        const team = cmd[4];

        ws.send(JSON.stringify({
          action: 'SETAI',
          parameters: {
            gameName: game,
            AI: ai,
            team,
            type,
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }
      case 'delai': {
        const game = cmd[1];
        const type = cmd[2];
        const ai = cmd[3];

        ws.send(JSON.stringify({
          action: 'DELAI',
          parameters: {
            gameName: game,
            AI: ai,
            type,
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }
      case 'setteam': {
        const game = cmd[1];
        const player = cmd[2];
        const team = cmd[3];

        ws.send(JSON.stringify({
          action: 'SETTEAM',
          parameters: {
            gameName: game,
            player,
            team,
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }
      case 'setmap': {
        const game = cmd[1];
        const mapId = parseInt(cmd[2]);

        ws.send(JSON.stringify({
          action: 'SETMAP',
          parameters: {
            gameName: game,
            mapId,
          },
          seq: randomInt(0, 10000000),
        }));
        break;
      }
      case 'fault': {
        ws.send(JSON.stringify({
          action: 'FAULT',
          parameters: {
          },
        }));
        break;
      }
      case 'startgame': {
        ws.send(JSON.stringify({
          action: 'STARTGAME',
          parameters: {},
          seq: randomInt(0, 1000000),
        }));
        break;
      }
      case 'hasmap': {
        const mapId = cmd[1];
        ws.send(JSON.stringify({
          action: 'HASMAP',
          parameters: {
            mapId,
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }
      case 'setspec': {
        const gameName = cmd[1];
        const player = cmd[2];
        ws.send(JSON.stringify({
          action: 'SETSPEC',
          parameters: {
            gameName,
            player,
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }
      case 'leavegame': {
        ws.send(JSON.stringify({
          action: 'LEAVEGAME',
          parameters: {},
          seq: randomInt(0, 1000000),
        }));
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
          seq: randomInt(0, 1000000),
        }));
        break;
      }
      case 'killEngine': {
        ws.send(JSON.stringify({
          action: 'KILLENGINE',
          parameters: {},
          seq: randomInt(0, 1000000),
        }));
        break;
      }

      case 'addFriend': {
        const friendName = cmd[1];
        ws.send(JSON.stringify({
          action: 'ADDFRIEND',
          parameters: {
            friendName,
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }
      case 'claim': {
        const confirmationId = cmd[1];
        const type = cmd[2];
        const agree = cmd[3] === 'true';

        ws.send(JSON.stringify({
          action: 'CLAIMCONFIRM',
          parameters: {
            confirmationId,
            type,
            agree,
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }
      case 'setmod': {
        const mod = cmd[1];
        ws.send(JSON.stringify({
          action: 'SETMOD',
          parameters: {
            mod,
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }
      case 'createAdv': {
        ws.send(JSON.stringify({
          action: 'ADV_CREATE',
          parameters: {
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }
      case 'startadv': {
        ws.send(JSON.stringify({
          action: 'ADV_PRESTART',
          parameters: {
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }

      case 'leaveadv': {
        const adv = cmd[1];
        ws.send(JSON.stringify({
          action: 'ADV_LEAVE',
          parameters: {
            advId: parseInt(adv),
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }

      case 'forfeitAdv': {
        ws.send(JSON.stringify({
          action: 'ADV_FORFEIT',
          parameters: {
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }

      case 'recruit': {
        const friendName = cmd[1];
        ws.send(JSON.stringify({
          action: 'ADV_RECRUIT',
          parameters: {
            friendName,
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }

      case 'joinadv': {
        const adv = cmd[1];
        ws.send(JSON.stringify({
          action: 'ADV_JOIN',
          parameters: {
            advId: parseInt(adv),
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }

      case 'moveto': {
        const adv = cmd[1];
        const floorIn = cmd[2];
        const nodeTo = cmd[3];
        ws.send(JSON.stringify({
          action: 'ADV_MOVETO',
          parameters: {
            advId: parseInt(adv),
            floorIn,
            nodeTo,
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }

      case 'mark': {
        const friendName = cmd[1];
        const text = cmd[2];
        ws.send(JSON.stringify({
          action: 'FRIEND_MARK',
          parameters: {
            friendName,
            text,
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }
      case 'unmark': {
        const friendName = cmd[1];
        const markId = parseInt(cmd[2]);
        ws.send(JSON.stringify({
          action: 'FRIEND_UNMARK',
          parameters: {
            friendName,
            markId,
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }
      case 'removeFriend': {
        const friendName = cmd[1];
        ws.send(JSON.stringify({
          action: 'FRIEND_REMOVE',
          parameters: {
            friendName,
          },
          seq: randomInt(0, 1000000),
        }));
        break;
      }
    }
  }
}

main();
