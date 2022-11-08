import "reflect-metadata"
import { parentPort } from "worker_threads";
import { IncommingMsg } from "./lib/network";
import {AppDataSource} from './db/datasource';
import { loginHandler } from "./lib/worker/auth";
import { CMD, Receipt, State } from "./lib/interfaces";
import { delAI, hasMap, joinGameHandler, killEngine, leaveGame, midJoin, setAI, setMap, setMod, setSpec, setTeam, startGame } from "./lib/worker/dod";
import { RedisStore } from "./lib/store";
import { CallTracker } from "assert";

import { store } from "./lib/worker/shared";


const handlersTable: {
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
    }, seq: number, caller: string) => Promise<{resp: Receipt | State | CMD, type: string}>
} = 
{ 
        LOGIN: loginHandler,
        JOINGAME: joinGameHandler,
        // SETTEAM: setTeam,
        // SETMAP: setMap,
        STARTGAME: startGame,
        // SETSPEC: setSpec,
        // LEAVEGAME: leaveGame,
        // HASMAP: hasMap,
        // MIDJOIN: midJoin,
        // KILLENGINE: killEngine,
        // SETMOD: setMod,
        // SETAI: setAI,
        // DELAI: delAI
}

let dbInitialized = false;

function toParent(receiptOrState: Receipt | State | CMD, seq: number, type: string) {
    parentPort?.postMessage({
        receiptOrState,
        seq,
        type
    })
}

AppDataSource.initialize().then(() => {
    dbInitialized = true;
}).catch(e=> {
    console.log(e)
})

parentPort?.on('message', async (msg: IncommingMsg) => {
    if(!(msg.action in handlersTable)) return;

    switch(msg.type) {
        case 'client': {
            const action = msg.action;
            const hanlder = handlersTable[action]

            const {resp, type} = await hanlder(msg.parameters, msg.seq, msg.caller);
            if(type === 'network') {
                toParent(resp, msg.seq, 'network');
            } else if(type === 'cmd') {
                toParent(resp, msg.seq, 'cmd');
            }
            break;
        }
    }

})
