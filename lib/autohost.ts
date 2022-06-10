import { EventEmitter } from "stream";
import { WebSocketServer, WebSocket } from "ws";


export class AutohostManager extends EventEmitter {
    allowedAutohosts: string[] = []
    server: WebSocketServer | null = null
    clients: {[key: string]: {
        ws: WebSocket,
        workload: number
    }} = {}
    hostedGames: {[key: string]: {title: string, hosted: false}}

    constructor(allowedAutohost?: string[], 
        config?: {
        port: number,
        [key: string]: any
    }
    ) {
        super()

        this.allowedAutohosts = allowedAutohost || [];
        this.server = new WebSocketServer({
            port: config?.port || 9000
        })

        this.server.on('connection',(ws, req) => {
            const autohostIP = req.socket.remoteAddress
            if(autohostIP && autohostIP in this.allowedAutohosts) {
                this.clients[autohostIP] = {
                    ws,
                    workload: 0
                };
            } else ws.terminate()

            ws.on('message', (data, _) => {
                // parse messages from autohost

            })

            ws.on('close', (code, buffer) => {
                if(autohostIP) delete this.clients[autohostIP] 
                console.log(`autohost ${autohostIP} disconnected with code ${code}`)
            })
        })
    }

    start(gameConf: {[key: string]: any}) {}
    midJoin() {}

    loadBalance() {
        const workloadsPairs = Object.entries(this.clients)
            .map(([ip, client]) => [ip, client.workload])
            .sort((a, b) => {
                if(typeof a[1] === 'number' && typeof b[1] === 'number') {
                    return a[1] - b[1]
                }
                return 0
            })
        
        if(workloadsPairs.length > 0) return String(workloadsPairs[0][0])
        else return null
    }

}