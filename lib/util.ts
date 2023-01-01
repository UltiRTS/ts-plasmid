import axios, { responseEncoding } from 'axios';
import {dntpAddr} from '../config';
import { CMD, Receipt, State, Wrapped_Message} from './interfaces';

import pino from "pino";

const transport = pino.transport({
  target: 'pino/file',
  options: { destination: '/tmp/plasmid.log', append: true }
})
export const logger = pino(transport);

const charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export const CMD_PARAMETERS = {
    'LOGIN': ['username', 'password'],
    'REGISTER': ['username', 'password'],
    'JOINCHAT': ['chatName', 'password'],
    'LEAVECHAT': ['chatName'],
    'SAYCHAT': ['chatName', 'message'],
    'JOINGAME': ['gameName', 'mapId', 'password'],
    'SETAI': ['gameName', 'AI', 'team', 'type'],
    'DELAI': ['gameName', 'AI', 'type'],
    'SETTEAM': ['gameName', 'player', 'team'],
    'SETMAP': ['gameName', 'mapId'],
    'LEAVEGAME': [],
    'STARTGAME': [],
    'HASMAP': ['mapId'],
    'SETSPEC': ['gameName', 'player'],
    'MIDJOIN': [],
    'KILLENGINE': [],
    'ADDFRIEND': ['friendName'],
    // friend - agree
    'CLAIMCONFIRM': ['type', 'confirmationId'],
    'SETMOD': ['mod']
}


export function randomString(length: number) {
    let result = "";
    for (let i = 0; i < length; i++) {
        result += charSet[Math.floor(Math.random() * charSet.length)];
    }
    return result;
}

export function fullfillParameters(cmd: keyof typeof CMD_PARAMETERS, parameters: object) {
    if(!(cmd in CMD_PARAMETERS)) return false;

    const neededParams: string[] = CMD_PARAMETERS[cmd];
    for(const param of neededParams) {
        if(!(param in parameters)) return false;
    }

    return true;
}

export function getMods() {
    return axios.get(dntpAddr + '/mods').then(res => {
        const mods: [{
            id: number
            name: string
            archive: number
            version: string
        }] = res.data.mods;
        const modsNames = [];
        for(const mod of mods) {
            if(!(mod.name in modsNames)) modsNames.push(mod.name);
        }

        console.log(modsNames);
        return modsNames;

    }).catch(e => {
        console.log('error connection');
        console.log(e);
        return [] as string[];
    })    
}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

export function Notify(receiptOf: string, seq: number, msg: string, client: string, targets: string[] = ['client']) {
     return {
        receiptOf,
        seq,
        status: false,
        targets,
        payload: { 
            receipt: {
                message: msg
            } as Receipt
        },
        client
    } as Wrapped_Message
}

export function WrappedState(receiptOf: string, seq: number, state: State, client: string, targets: string[] = ['client']) {
     return {
        receiptOf,
        seq,
        status: true,
        targets,
        payload: {
            state
        },
        client
    } as Wrapped_Message
}

export function WrappedCMD(receiptOf: string, seq: number, cmd: CMD, extraTarget: string, client: string, options: {
    state?: State
    receipt?: Receipt
}) {
     return {
        receiptOf,
        seq,
        status: true,
        targets: extraTarget==='cmd'?['cmd']:[extraTarget, 'cmd'],
        payload: {
            cmd,
            receipt: options.receipt,
            state: options.state
        },
        client
    } as Wrapped_Message
}

export function userLevel(exp: number) {
    return Math.floor(Math.sqrt(exp*20))
}