import { Worker, isMainThread, threadId } from 'node:worker_threads';
import { randomInt } from 'node:crypto';
import { EventEmitter } from 'node:stream';
import { WebSocket } from 'ws';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  if (isMainThread) {
    for (let i = 0; i < 1; i++) {
      new Worker('./tests/pressure.test.ts', {
        execArgv: ['-r', 'ts-node/register/transpile-only'],
      });
    }
  }
  else {
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

async function pressureTest() {
  const ws = new WebSocket('ws://localhost:8081');
  const emitter = new EventEmitter();

  const joinChat = () => {
    ws.send(JSON.stringify({
      action: 'JOINCHAT',
      parameters: {
        room: 'test',
        password: '',
      },
      seq: randomInt(0, 10000000),
    }));
  };

  const sayChat = () => {
    ws.send(JSON.stringify({
      action: 'SAYCHAT',
      parameters: {
        chatName: 'test',
        message: 'hello from test',
      },
      seq: randomInt(0, 10000000),
    }));
  };

  const leaveChat = () => {
    ws.send(JSON.stringify({
      action: 'LEAVECHAT',
      parameters: {
        chatName: 'test',
      },
      seq: randomInt(0, 10000000),
    }));
  };

  const joinGame = () => {
    ws.send(JSON.stringify({
      action: 'JOINGAME',
      parameters: {
        gameName: 'test',
        password: '',
        mapId: 30,
      },
      seq: randomInt(0, 10000000),
    }));
  };

  const leaveGame = () => {
    ws.send(JSON.stringify({
      action: 'LEAVEGAME',
      parameters: {
        gameName: 'test',
      },
      seq: randomInt(0, 10000000),
    }));
  };

  const advLeave = () => {
    ws.send(JSON.stringify({
      action: 'ADV_LEAVE',
      parameters: {
      },
      seq: randomInt(0, 10000000),
    }));
  };

  const advCreate = () => {
    ws.send(JSON.stringify({
      action: 'ADV_CREATE',
      parameters: {
      },
      seq: randomInt(0, 10000000),
    }));
  };

  const advRecruit = () => {
    ws.send(JSON.stringify({
      action: 'ADV_CREATE',
      parameters: {
        friendName: 'test',
      },
      seq: randomInt(0, 10000000),
    }));
  };

  const advPreStart = () => {
    ws.send(JSON.stringify({
      action: 'ADV_PRESTART',
      parameters: {
      },
      seq: randomInt(0, 10000000),
    }));
  };

  // const handlerList = [joinGame];
  const handlerList = [advLeave, advCreate, advRecruit, advPreStart];
  // const handlerList = [joinGame, ];

  emitter.on('loggedIn', async () => {
    for (let i = 0; i < NUM_CMDS; i++) {
      const cmd2call = handlerList[randomInt(handlerList.length)];
      cmd2call();
      // await sleep(randomInt(0, 200));
    }
  });

  emitter.on('done', () => {
    console.log(`stats for ${threadId}:`, stats);
  });

  ws.on('open', () => {
    const username = `test_${threadId}12`;
    const password = 'test';
    ws.send(JSON.stringify({
      action: 'LOGIN',
      parameters: {
        username,
        password,
      },
      seq: randomInt(0, 1000000),
    }));
  });

  let counter = 0;
  ws.on('message', (data) => {
    const jsonData = JSON.parse(data.toString());
    if (jsonData.action === 'PING')
      return;

    if (jsonData.action === 'LOGIN')
      emitter.emit('loggedIn');

    if (jsonData.action === 'NOTIFY') {
      if (!Object.keys(stats).includes(jsonData.from)) {
        stats[jsonData.from] = {
          success: 0,
          failure: 0,
          locked: 0,
        };
      }
      stats[jsonData.from].failure++;
      if (jsonData.message.includes('lock'))
        stats[jsonData.from].locked++;
    }
    else {
      if (!Object.keys(stats).includes(jsonData.action)) {
        stats[jsonData.action] = {
          success: 0,
          failure: 0,
          locked: 0,
        };
      }
      stats[jsonData.action].success++;
    }

    counter++;
    if (counter > NUM_CMDS)
      emitter.emit('done');
  });
}

main();
