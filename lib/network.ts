import {WebSocketServer, WebSocket} from 'ws';
import { randomString } from "./util";
import {EventEmitter} from "events";

export interface IncommingMsg {
    action: string,
    seq: number,
    parameter: {[key: string]: any}
}

export interface Notification {
    action: string,
    seq: number,
    message: string
}

export class Network extends EventEmitter {
    server: WebSocketServer;
    clients: {[id: string]: WebSocket};

    constructor(port: number, options={}) {
        super(options);

        this.server = new WebSocketServer({port: port});
        this.clients = {};

        this.server.on('connection', (ws, req) => {
            let clientID = randomString(16);
            while(clientID in this.clients) {
                clientID = randomString(16);
            }

            this.clients[clientID] = ws;
            
            ws.on('message', (msg) => {
                this.emit('message', clientID, JSON.parse(msg.toString()));
            })
        })

        this.on('postMessage', (clientID: string, msg: Object) => {
            if(clientID in this.clients) {
                this.clients[clientID].send(JSON.stringify(msg));
            }
        })
    }

}