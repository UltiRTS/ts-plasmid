/** @format */

import 'reflect-metadata';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { TypeORMError } from 'typeorm';
import { mainLogger as logger } from 'lib/logger';
import { AutohostManager } from './lib/autohost';
import type {
  CMD,
  CMD_Adventure_recruit,
  CMD_Autohost_Kill_Engine,
  CMD_Autohost_Midjoin,
  CMD_Autohost_Start_Game,
  Wrapped_Message,
} from './lib/interfaces';

import type {
  IncommingMsg,
  Notification,
} from './lib/network';
import {
  Network,
  wrapReceipt,
  wrapState,
} from './lib/network';
import { RedisStore } from './lib/store';
import { AppDataSource } from './db/datasource';

const network = new Network(8081);
const workers: Worker[] = [];
const store = new RedisStore();

const clientID2seq: { [key: string]: number } = {};
const seq2clientID: { [key: number]: string } = {};
const clientID2username: { [key: string]: string } = {};
const username2clientID: { [key: string]: string } = {};

const autohostMgr = new AutohostManager([], { port: 5000 });
function main() {
  logger.info('starting main feature...');

  logger.debug('registering network event handlers...');
  let workerIndex = 0;

  const postMessageToWorker = (value: any) => {
    const workerId = workerIndex;
    workerIndex = (workerIndex + 1) % workers.length;
    workers[workerId].postMessage(value);
  };

  network.on('message', (clientID: string, data: IncommingMsg) => {
    clientID2seq[clientID] = data.seq;
    seq2clientID[data.seq] = clientID;

    // if action is login and the user is not logged in, set the clientID to username
    if (
      data.action === 'LOGIN'
      && !(data.parameters.username in username2clientID)
    ) {
      const username = data.parameters.username;

      clientID2username[clientID] = username;
      username2clientID[username] = clientID;

      store.setOnline(Object.keys(username2clientID));
    }

    if (!['LOGIN'].includes(data.action)) {
      if (!(clientID in clientID2username)) {
        network.emit('postMessage', seq2clientID[data.seq], {
          action: 'NOTIFY',
          seq: data.seq,
          message: 'please login',
          from: data.action,
        } as Notification);
        return;
      }
    }

    data.caller = clientID2username[clientID];
    data.type = 'client';

    postMessageToWorker(data);

    // clear temporary caller set
    if (data.action === 'LOGIN') {
      const username = data.parameters.username;

      delete clientID2username[clientID];
      delete username2clientID[username];
    }
  });

  network.on('clean', async (clientID: string) => {
    const seq = clientID2seq[clientID];
    const username = clientID2username[clientID];
    logger.info(`trigering clean, user: ${username}`);

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
      payload: {},
    };

    if (user?.adventure) {
      const leaveAdvMsg: IncommingMsg = {
        action: 'ADV_LEAVE',
        type: 'client',
        seq: -1,
        caller: username,
        parameters: {
          advId: user.adventure,
        },
        payload: {},
      };
      postMessageToWorker(leaveAdvMsg);
    }

    postMessageToWorker(leaveGameMsg);

    if (!user)
      return;
    for (const room of user.chatRooms) {
      const leaveChatMsg: IncommingMsg = {
        action: 'LEAVECHAT',
        type: 'client',
        seq: -1,
        caller: username,
        payload: {},
        parameters: {
          chatName: room,
        },
      };
      postMessageToWorker(leaveChatMsg);
    }
  });

  logger.info('registering autohost event handlers...');
  autohostMgr.on(
    'gameStarted',
    (msg: {
      gameName: string
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
          gameName: msg.gameName,
        },
        payload: {},
      };

      postMessageToWorker(internalMsg);
    },
  );

  autohostMgr.on('gameEnded', (gameName) => {
    const internalMsg: IncommingMsg = {
      action: 'GAMEENDED',
      type: 'internal',
      seq: -1,
      caller: '',
      parameters: {
        gameName,
      },
      payload: {},
    };

    postMessageToWorker(internalMsg);
  });

  autohostMgr.on('midJoined', (params: { title?: string; player?: string }) => {
    const internalMsg: IncommingMsg = {
      action: 'MIDJOINED',
      type: 'internal',
      seq: -1,
      caller: '',
      parameters: {
        ...params,
      },
      payload: {},
    };

    postMessageToWorker(internalMsg);
  });
  logger.info('autohost event handlers registered');
  initializeWorkers();
  logger.info('waiting for workers to be ready...');
  Promise.all(workers.map((worker) => {
    return new Promise((resolve) => {
      worker.once('online', resolve);
    });
  })).then(() => {
    logger.info('all workers are ready, server is ready to accept connections');
  });
}

function handleClientMsg(msg: Wrapped_Message) {
  if (msg.receiptOf === 'LOGIN') {
    const clientID = seq2clientID[msg.seq];
    username2clientID[msg.client] = clientID;
    clientID2username[clientID] = msg.client;
  }

  if (msg.payload.receipt) {
    if (msg.seq !== -1) {
      network.emit(
        'postMessage',
        seq2clientID[msg.seq],
        wrapReceipt(msg.receiptOf, msg.seq, msg.payload.receipt),
      );
    }
    else if (msg.client !== '' && username2clientID[msg.client] != null) {
      network.emit(
        'postMessage',
        username2clientID[msg.client],
        wrapReceipt(msg.receiptOf, msg.seq, msg.payload.receipt),
      );
    }
  }
  if (msg.payload.state) {
    if (msg.seq !== -1) {
      network.emit(
        'postMessage',
        seq2clientID[msg.seq],
        wrapState(msg.receiptOf, msg.seq, msg.payload.state),
      );
    }
    else if (msg.client !== '' && username2clientID[msg.client] != null) {
      network.emit(
        'postMessage',
        username2clientID[msg.client],
        wrapState(msg.receiptOf, msg.seq, msg.payload.state),
      );
    }
  }
}

function handlCmd(msg: Wrapped_Message) {
  if (!msg.payload.cmd)
    return;

  const cmd = msg.payload.cmd;
  if (cmd.to === 'autohost') {
    const autohostCmd = cmd as CMD;
    switch (autohostCmd.action) {
      case 'STARTGAME': {
        const startCmd = cmd as CMD_Autohost_Start_Game;
        if (startCmd.payload.gameConf)
          autohostMgr.start(startCmd.payload.gameConf);
        else logger.info('empty gameconf');

        break;
      }
      case 'MIDJOIN': {
        const midjoinCmd = cmd as CMD_Autohost_Midjoin;
        const payload = midjoinCmd.payload;
        const title = payload.title;
        autohostMgr.midJoin(title, {
          playerName: payload.playerName,
          id: payload.id,
          isSpec: payload.isSpec,
          team: payload.team,
          token: payload.token,
        });

        break;
      }
      case 'KILLENGINE': {
        const killCmd = cmd as CMD_Autohost_Kill_Engine;
        const payload = killCmd.payload;
        autohostMgr.killEngine({
          id: payload.id,
          title: payload.title,
        });

        break;
      }
    }
  }
  else if (cmd.to === 'client') {
  }
  else if (cmd.to === 'internal') {
    logger.info('internal message get called');
    switch (cmd.action) {
      case 'ADV_RECRUIT': {
        const recruitCmd = cmd as CMD_Adventure_recruit;
        const recruitPayload = recruitCmd.payload;
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
            caller: msg.client,
          },
        };
        sendToWorker(leaveChatMsg);
        break;
      }
    }
  }
}

function initializeWorkers() {
  logger.info('initializing workers...');
  let workerPoolSize = Number.parseInt(process.env.PLASMID_WORKER_POOL_SIZE ?? '') || os.cpus().length;
  if (workerPoolSize < 1) {
    logger.warn('worker pool size is less than 1, setting to default(1)');
    workerPoolSize = 1;
  }
  for (let i = 0; i < workerPoolSize; i++) {
    const worker
      = process.env.NODE_ENV === 'development'
        ? new Worker(path.join(__dirname, './worker.ts'), {
          execArgv: ['-r', 'ts-node/register/transpile-only'],
        })
        : new Worker(path.join(__dirname, 'worker.js'));
    worker.on('online', () => {
      logger.info(`Worker #${worker.threadId} online`);
    });
    worker.on('error', (err) => {
      logger.error({ error: err }, `Worker #${worker.threadId} error: ${err.message}`);
    });
    // worker's threadId is -1 when exited
    // worker.on('exit', (code) => {
    //   logger.info(`worker #${worker.threadId} exited with code ${code}`);
    // });
    worker.on('message', async (msgs: Wrapped_Message[]) => {
      for (const msg of msgs) {
        for (const target of msg.targets) {
          switch (target) {
            case 'client': {
              // sustain the mapping
              handleClientMsg(msg);
              break;
            }
            case 'cmd': {
              handlCmd(msg);
              break;
            }
            case 'all': {
              if (!msg.payload.state)
                break;
              const users = Object.keys(username2clientID);
              for (const user of users) {
                network.emit(
                  'postMessage',
                  username2clientID[user],
                  wrapState('DUMP2ALL', -1, await store.dumpState(user)),
                );
              }
              break;
            }
          }
        }
      }
    });

    workers.push(worker);
  }
  logger.info(`workers initialized, available workers: ${workers.length}`);
}

AppDataSource.initialize()
  .then(() => {
    logger.info('db initialized');
    if (process.env.NODE_ENV !== 'production')
      AppDataSource.synchronize();
  })
  .then(main)
  .catch((e) => {
    if (e instanceof TypeORMError)
      logger.error({ error: e }, 'db failed');

    logger.error({ error: e }, 'unexpected error');
  });
