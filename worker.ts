import 'reflect-metadata';
import { parentPort, threadId } from 'worker_threads';
import os from 'os';
import path from 'path';
import { IncommingMsg } from './lib/network';
import { AppDataSource } from './db/datasource';
import { loginHandler } from './lib/worker/auth';
import { CMD, Receipt, State, Wrapped_Message } from './lib/interfaces';
import {
  delAI,
  hasMap,
  joinGameHandler,
  killEngine,
  leaveGame,
  midJoin,
  setAI,
  setMap,
  setMod,
  setSpec,
  setTeam,
  startGame,
} from './lib/worker/dod';
import { RedisStore } from './lib/store';
import { CallTracker } from 'assert';

import { store } from './lib/worker/shared';
import {
  gameEndedHandler,
  gameStartedHandler,
  interalRecruitPpl4Adventure,
  midJoinedHandler,
} from './lib/worker/internal';
import {
  joinChatRoomHandler,
  leaveChatRoomHandler,
  sayChatHandler,
} from './lib/worker/chat';
import {
  addFriendHandler,
  confirmHandler,
  recruitPpl4Adventure,
} from './lib/worker/messaging';
import {
  createAdventureHandler,
  forfeitAdventureHandler,
  joinAdventureHandler,
  leaveAdventureHandler,
  moveToHandler,
  preStartAdventureHandler,
  readyAdventureHandler,
} from './lib/worker/rougue';

import { markFriend, removeFriend, unMarkFriend } from "./lib/worker/friend";

import { workerLogger as logger } from "./lib/logger";

AppDataSource.initialize()
  .then(() => {
    logger.info(`worker #${threadId} connected to db`);
  })
  .catch((e) => {
    logger.error({ error: e }, 'worker #${threadId} failed to connect to db');
  });
const clientsHandlers: {
  [index: string]: (
    params: {
      username?: string;
      password?: string;
      gameName?: string;
      player?: string;
      team?: string;
      mapId?: number;
      mod?: string;
      room?: string;
      message?: string;
      chatName?: string;
      type?: string;
      confirmationId?: number;
      agree?: boolean;
      friendName?: string;
      floorIn?: number;
      nodeTo?: number;
      [key: string]: any;
    },
    seq: number,
    caller: string
  ) => Promise<Wrapped_Message[]>;
} = {
  LOGIN: loginHandler,
  JOINGAME: joinGameHandler,
  SETTEAM: setTeam,
  SETMAP: setMap,
  STARTGAME: startGame,
  SETSPEC: setSpec,
  LEAVEGAME: leaveGame,
  HASMAP: hasMap,
  MIDJOIN: midJoin,
  KILLENGINE: killEngine,
  SETMOD: setMod,
  SETAI: setAI,
  DELAI: delAI,
  JOINCHAT: joinChatRoomHandler,
  SAYCHAT: sayChatHandler,
  LEAVECHAT: leaveChatRoomHandler,
  ADDFRIEND: addFriendHandler,
  CLAIMCONFIRM: confirmHandler,
  ADV_JOIN: joinAdventureHandler,
  ADV_MOVETO: moveToHandler,
  ADV_CREATE: createAdventureHandler,
  ADV_PRESTART: preStartAdventureHandler,
  ADV_RECRUIT: recruitPpl4Adventure,
  ADV_READY: readyAdventureHandler,
  ADV_LEAVE: leaveAdventureHandler,
  ADV_FORFEIT: forfeitAdventureHandler,
  FRIEND_MARK: markFriend,
  FRIEND_UNMARK: unMarkFriend,
  FRIEND_REMOVE: removeFriend,
};

const interalHandlers: {
  [index: string]: (params: {
    gameName?: string;
    title?: string;
    player?: string;
    friendName?: string;
    firstTime?: boolean;
    [key: string]: any;
  }) => Promise<Wrapped_Message[]>;
} = {
  GAMESTARTED: gameStartedHandler,
  GAMEENDED: gameEndedHandler,
  MIDJOINED: midJoinedHandler,
  ADV_RECRUIT: interalRecruitPpl4Adventure,
};

let dbInitialized = false;

function toParent(msgs: Wrapped_Message[]) {
  parentPort?.postMessage(msgs);
}

parentPort?.on('message', async (msg: IncommingMsg) => {
  // console.log(msg);
  if (!(msg.action in clientsHandlers) && !(msg.action in interalHandlers))
    return;

  const time_start = Date.now();
  switch (msg.type) {
    case 'client': {
      const action = msg.action;
      logger.info('AAA Client Action');
      const hanlder = clientsHandlers[action];
      const resp = await hanlder(msg.parameters, msg.seq, msg.caller);
      toParent(resp);
      break;
    }
    case 'internal': {
      logger.info(`interal: ${msg}`);
      const action = msg.action;
      const hanlder = interalHandlers[action];
      const resp = await hanlder(msg.parameters);
      toParent(resp);
      break;
    }
  }

    const time_end = Date.now();
    logger.info(`cmd ${msg.action} consumed ${time_end - time_start}ms`);
});
