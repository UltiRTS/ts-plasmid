import { EventEmitter } from 'node:events';
import http from 'node:http';
import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';
import { randomString } from './util';
import type { Receipt, State } from './interfaces';
import { workerLogger as logger } from './logger';

export interface IncommingMsg {
  action: string
  seq: number
  type: string
  caller: string
  parameters: { [key: string]: any }
  payload: { [key: string]: any }
}

export interface Notification {
  action: string
  seq: number
  message: string
}

export class Network extends EventEmitter {
  httpServer: http.Server;
  server: WebSocketServer;
  clients: { [id: string]: WebSocket };

  constructor(port: number, options = {}) {
    super(options);

    this.httpServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('okay');
    });

    this.httpServer.listen(port);

    this.server = new WebSocketServer({ server: this.httpServer });
    this.clients = {};

    this.server.on('connection', (ws, req) => {
      let clientID = randomString(16);
      let pingPongCount = 0;
      while (clientID in this.clients)
        clientID = randomString(16);

      this.clients[clientID] = ws;

      const pingPongInterval = setInterval(() => {
        if (pingPongCount > 3) {
          ws.terminate();
          clearInterval(pingPongInterval);
        }
        pingPongCount++;
        ws.send(JSON.stringify({
          action: 'PING',
          parameters: {},
        }));
      }, 3000);

      ws.on('message', (msg) => {
        const data = JSON.parse(msg.toString());
        switch (data.action) {
          case 'PONG':
            pingPongCount = 0;
            break;
          default:
            this.emit('message', clientID, data);
        }
      });

      ws.on('close', (ws: WebSocket, code: number) => {
        this.emit('clean', clientID);
        // clearInterval(pingPongInterval);
        delete this.clients[clientID];

        logger.info(`Client ${clientID} disconnected with code ${code}`);
      });
    });

    this.on('postMessage', (clientID: string, msg: Object) => {
      if (clientID in this.clients)
        this.clients[clientID].send(JSON.stringify(msg));
    });

    this.on('dump2all', (msg: Object) => {
      for (const clientID in this.clients)
        this.clients[clientID].send(JSON.stringify(msg));
    });
  }
}

export function wrapState(action: string, seq: number, state: State) {
  return {
    action,
    seq,
    state,
  };
}

export function wrapReceipt(action: string, seq: number, receipt: Receipt) {
  return {
    action: 'NOTIFY',
    seq,
    ...receipt,
    from: action,
  };
}
