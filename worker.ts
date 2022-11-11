import "reflect-metadata"
import { parentPort } from "worker_threads";
import { IncommingMsg } from "./lib/network";
import {AppDataSource} from './db/datasource';
import { loginHandler } from "./lib/worker/auth";
import { CMD, Receipt, State, Wrapped_Message } from "./lib/interfaces";
import { delAI, hasMap, joinGameHandler, killEngine, leaveGame, midJoin, setAI, setMap, setMod, setSpec, setTeam, startGame } from "./lib/worker/dod";
import { RedisStore } from "./lib/store";
import { CallTracker } from "assert";

import { store } from "./lib/worker/shared";
import { gameEndedHandler, gameStartedHandler } from "./lib/worker/internal";

const clientsHandlers: {
    [index: string]: 
    (params: {
        username?: string,
        password?: string,
        gameName?: string
        player?: string
        team?: string
        mapId?: number
        mod?: string
        [key:string]: any
    }, seq: number, caller: string) => Promise<Wrapped_Message[]>
} = 
{ 
        LOGIN: loginHandler,
        JOINGAME: joinGameHandler,
        SETTEAM: setTeam,
        SETMAP: setMap,
        STARTGAME: startGame,
        SETSPEC: setSpec,
        LEAVEGAME: leaveGame,
        HASMAP: hasMap,
        // MIDJOIN: midJoin,
        // KILLENGINE: killEngine,
        SETMOD: setMod,
        SETAI: setAI,
        DELAI: delAI
}

const interalHandlers: {
    [index: string]: (params: {
        gameName?: string
        [key: string]: any
    }) => Promise<Wrapped_Message[]>
} = {
    GAMESTARTED: gameStartedHandler,
    GAMEENDED: gameEndedHandler
}

let dbInitialized = false;

function toParent(msgs: Wrapped_Message[]) {
    parentPort?.postMessage(msgs);
}

AppDataSource.initialize().then(() => {
    dbInitialized = true;
}).catch(e=> {
    console.log(e)
})

parentPort?.on('message', async (msg: IncommingMsg) => {
    console.log(msg);
    if(!(msg.action in clientsHandlers) && !(msg.action in interalHandlers)) return;


    switch(msg.type) {
        case 'client': {
            const action = msg.action;
            const hanlder = clientsHandlers[action]
            const resp = await hanlder(msg.parameters, msg.seq, msg.caller);
            toParent(resp);
            break;
        }
        case 'internal': {
            console.log('interal: ', msg);
            const action = msg.action;
            const hanlder = interalHandlers[action];
            const resp = await hanlder(msg.parameters);
            toParent(resp);
            break;
        }
    }

})
