import {WebSocketServer, WebSocket} from 'ws';
import { randomString } from "./util";
import {EventEmitter} from "events";

export interface IncommingMsg {
    action: string,
    seq: number,
    parameters: {[key: string]: any},
    payload: {[key: string]: any}
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

            ws.on('close', (ws: WebSocket, code: number) => {
                this.emit('clean', clientID);
                delete this.clients[clientID];

                console.log(`Client ${clientID} disconnected with code ${code}`);
            })

        })

        this.on('postMessage', (clientID: string, msg: Object) => {
            if(clientID in this.clients) {
                this.clients[clientID].send(JSON.stringify(msg));
            }
        })
    }

}