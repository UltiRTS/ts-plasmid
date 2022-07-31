import { EventEmitter } from "stream";
import { WebSocketServer, WebSocket } from "ws";
import { GameConf } from "./states/room";

interface AutohostResponse {
    action: string
    parameters: {
        info?: string
        title?: string
        status?: boolean
        [key: string]: any
    }
}


export class AutohostManager extends EventEmitter {
    allowedAutohosts: string[] = []
    server: WebSocketServer | null = null
    clients: {[key: string]: {
        ws: WebSocket,
        workload: number
    }} = {}
    hostedGames: {[key: string]: {hosted: boolean, error: string}} = {}

    constructor(allowedAutohost?: string[], 
        config?: {
        port: number,
        [key: string]: any
    }
    ) {
        super()

        if(allowedAutohost) this.allowedAutohosts = allowedAutohost;
        console.log(`autohosts allowed: ${this.allowedAutohosts.join(', ')}`)
        this.server = new WebSocketServer({
            port: config?.port || 9000,
            host: '0.0.0.0'
        })

        this.server.on('error', (err) => {
            console.log(err)
        })

        this.server.on('connection',(ws, req) => {

            this.emit('conn', ws, req)

            console.log(`autohost ${req.socket.remoteAddress} connected`)


            const autohostIP = req.socket.remoteAddress
            if(autohostIP) this.clients[autohostIP] = {
                ws,
                workload: 0
            };
            // if(autohostIP && autohostIP in this.allowedAutohosts) {
            // } else {
            //     ws.terminate()
            //     console.log(`autohost ${autohostIP} not allowed`)
            // }

            ws.on('message', (data, _) => {
                // parse messages from autohost
                const msg = JSON.parse(data.toString()) as AutohostResponse
                console.log(`autohost msg: ${JSON.stringify(msg)}`)
                if(msg.action === 'serverStarted') {
                    console.log('server started by autohost')
                } else if(msg.action === 'serverEnding') {
                    console.log('server ended by autohost')
                }

                switch(msg.action) {
                    case 'serverStarted': {
                        if(msg.parameters.title) {
                            console.log(`autohost ${autohostIP} started game ${msg.parameters.title}`)
                            this.hostedGames[msg.parameters.title].hosted = true
                            this.emit('gameStarted', {
                                gameName: msg.parameters.title,
                                payload: {
                                    autohost: autohostIP,
                                    port: msg.parameters.port
                                }
                            })
                        } 
                        break;
                    }
                    case 'serverEnding': {
                        if(msg.parameters.title) {
                            this.hostedGames[msg.parameters.title].hosted = false
                            this.emit('gameEnded', msg.parameters.title)
                        }
                        break;
                    }
                    case 'info': {
                        console.log(msg.parameters.info)
                        break;
                    }
                    default: {
                        console.log(`autohost ${autohostIP} sent unknown message: ${msg.action}`)
                    }
                }

            })

            ws.on('error', (err) => {
                console.log(err)
            })

            ws.on('close', (code, buffer) => {
                if(autohostIP) delete this.clients[autohostIP] 
                console.log(`autohost ${autohostIP} disconnected with code ${code}`)
            })
        })
    }

    start(gameConf: GameConf) {
        console.log(`game ${gameConf.title} starting`)
        this.hostedGames[gameConf.title] = {
            hosted: false,
            error: ''
        }

        if(gameConf.mgr in this.clients) {
            this.clients[gameConf.mgr].workload += 1
            this.clients[gameConf.mgr].ws.send(JSON.stringify({
                action: 'startGame', 
                parameters: gameConf
            }))
            console.log(`sending game ${gameConf.title} configration to ${gameConf.mgr}`)
        } else {
            this.hostedGames[gameConf.title].error = 'Manager not connected'
            console.log(`autohost ${gameConf.mgr} not found`)
        }

    }
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