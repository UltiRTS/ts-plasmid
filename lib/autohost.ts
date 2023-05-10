import { EventEmitter } from "stream";
import { WebSocketServer, WebSocket } from "ws";
import { GameConf } from "./interfaces";
import {Game} from '../db/models/game';
import {AppDataSource} from '../db/datasource';
import { MetadataArgsStorage } from "typeorm/metadata-args/MetadataArgsStorage";
import { User } from "../db/models/user";
import { getRandomInt } from "./util";
import { randomInt, createHash } from "crypto";

import { workerLogger as logger } from "./logger";

let dbInitialized = false;

// AppDataSource.initialize().then(() => {
//     dbInitialized = true;
// }).catch(e => {
//     console.log('db init failed', e);
// })

const gameRepo = AppDataSource.getRepository(Game);
const userRepo = AppDataSource.getRepository(User);

interface AutohostResponse {
    action: string
    parameters: {
        info?: string
        title?: string
        status?: boolean
        id?: number
        [key: string]: any
    }
}


export class AutohostManager extends EventEmitter {
    allowedAutohosts: string[] = []
    server: WebSocketServer | null = null
    clients: {[key: string]: {
        ws: WebSocket,
        workload: number,
        hostedId: {
            [key: number]: string
        }
    }} = {}
    hostedGames: {
        [key: string]: {
            autohost: string,
            running: boolean, 
            error: string, 
            ws: WebSocket | null, 
            game: Game, 
            lostMarks: {[key: number]: {
                team: number
                lost: boolean
                name: string
                isPlayer: boolean
            }},
        }
    } = {}

    constructor(allowedAutohost?: string[], 
        config?: {
        port: number,
        [key: string]: any
    }
    ) {
        super()

        if(allowedAutohost) this.allowedAutohosts = allowedAutohost;
        logger.info(`autohosts allowed: ${this.allowedAutohosts.join(', ')}`)
        this.server = new WebSocketServer({
            port: config?.port || 9000,
            host: '0.0.0.0'
        })

        this.server.on('error', (err) => {
            logger.error(err)
        })

        this.server.on('connection',(ws, req) => {

            this.emit('conn', ws, req)

            logger.info(`autohost ${req.socket.remoteAddress} connected`)


            const autohostIP = req.socket.remoteAddress
            if(autohostIP) this.clients[autohostIP] = {
                ws,
                workload: 0,
                hostedId: {}
            };
            // if(autohostIP && autohostIP in this.allowedAutohosts) {
            // } else {
            //     ws.terminate()
            //     console.log(`autohost ${autohostIP} not allowed`)
            // }

            ws.on('message', async (data, _) => {
                // parse messages from autohost
                const msg = JSON.parse(data.toString()) as AutohostResponse
                logger.info(`autohost msg: ${JSON.stringify(msg)}`)
                if(msg.action === 'serverStarted') {
                    logger.info('server started by autohost')
                } else if(msg.action === 'serverEnding') {
                    logger.info('server ended by autohost')
                }

                switch(msg.action) {
                    case 'serverStarted': {
                        if(msg.parameters.title) {
                            logger.info(`autohost ${autohostIP} started game ${msg.parameters.title}`)
                            this.hostedGames[msg.parameters.title].running = true
                            this.hostedGames[msg.parameters.title].game.start_time = new Date()

                            gameRepo.save(this.hostedGames[msg.parameters.title].game).then(game => {
                                if(msg.parameters.title) this.hostedGames[msg.parameters.title].game = game;
                                logger.info(`game ${game.id} started and saved`);
                            }).catch(e => {
                                logger.error(`save error: ${e}`);
                            })

                            this.emit('gameStarted', {
                                gameName: msg.parameters.title,
                                payload: {
                                    autohost: autohostIP,
                                    port: msg.parameters.port,
                                    id: msg.parameters.id
                                }
                            })
                        } 
                        break;
                    }
                    case 'serverEnding': {
                        if(msg.parameters.title) {
                            // delete occupied id
                            const autohost = this.hostedGames[msg.parameters.title].autohost;
                            for(const [key, value] of Object.entries(this.clients[autohost].hostedId)) {
                                if(value === msg.parameters.title) {
                                    delete this.clients[autohost].hostedId[parseInt(key)];
                                    break;
                                }
                            }

                            logger.info(`occupied: ${this.clients[autohost].hostedId}`);

                            this.hostedGames[msg.parameters.title].running = false
                            let winner_team = -1;
                            const lostMarks = this.hostedGames[msg.parameters.title].lostMarks;
                            for(const playerNum in lostMarks) {
                                if(lostMarks[playerNum].lost === false) {
                                    winner_team = lostMarks[playerNum].team;
                                    break;
                                }
                            }

                            this.hostedGames[msg.parameters.title].game.team_win = winner_team;
                            this.hostedGames[msg.parameters.title].game.end_time = new Date();


                            gameRepo.save(this.hostedGames[msg.parameters.title].game).then(g => {
                                logger.info(`game ${g.id} result saved`);
                            }).catch(e => {
                                logger.error(`update error: ${e}`);
                            })

                            for(const playerNum in lostMarks) {
                                const player = lostMarks[playerNum]; 
                                if(player.isPlayer) {
                                    const user = await userRepo.findOne({
                                        where: {
                                            username: player.name
                                        }
                                    })
                                    if(user) {
                                        user.winCount += player.lost?0:1;
                                        user.loseCount += player.lost?1:0;
                                        userRepo.save(user).then(u => {
                                            logger.info(`user ${user.username} winning count updated`);
                                        }).catch(e => {
                                            logger.error(`user ${user.username} winning count error saving: ${e}`);
                                        })
                                    }
                                }
                            }

                            this.hostedGames[msg.parameters.title].lostMarks

                            this.emit('gameEnded', msg.parameters.title)
                        }
                        break;
                    }
                    case 'workerExists': {
                        if(msg.parameters.title) {
                            this.emit('workerExists', msg.parameters.title)
                        }
                        break;
                    }
                    case 'midJoined': {
                        if(msg.parameters.title) {
                            this.emit('midJoined', msg.parameters)
                        }
                        break;
                    }
                    case 'info': {
                        logger.info(msg.parameters.info)
                        break;
                    }
                    case 'defeat': {
                        const playerNumber: number = msg.parameters.playerNumber;
                        if(msg.parameters.title) 
                            this.hostedGames[msg.parameters.title].lostMarks[playerNumber].lost = true;
                        break;
                    }
                    default: {
                        this.emit('message', msg);
                        logger.error(`autohost ${autohostIP} sent unknown message: ${msg.action}`)
                        break;
                    }
                }

            })

            ws.on('error', (err) => {
                logger.error(err)
            })

            ws.on('close', (code, buffer) => {
                if(autohostIP) delete this.clients[autohostIP] 
                logger.info(`autohost ${autohostIP} disconnected with code ${code}`)
            })
        })
    }

    assignAutohost() {
        const autohostLen = Object.keys(this.clients).length;
        if(autohostLen === 0) return '';

        return Object.keys(this.clients)[
            getRandomInt(autohostLen)
        ];
    }

    randRoomId(autohost: string) {
        const hostedIds = this.clients[autohost].hostedId;
        let randId = randomInt(10000);
        while(randId in hostedIds) {
            randId = randomInt(10000);
        }

        return randId;
    }

    start(gameConf: GameConf) {
        logger.info(`game ${gameConf.title} starting`)
        if(gameConf.mgr == null) {
            gameConf.mgr = this.assignAutohost();
            // do load balance here
        }

        const roomHash = createHash('md5').update(gameConf.title).digest('hex')
        const roomId = parseInt(roomHash, 16) % 8000;
        gameConf.id = roomId;
        this.clients[gameConf.mgr].hostedId[gameConf.id] = gameConf.title;
        logger.info('occupied:', this.clients[gameConf.mgr].hostedId);
        this.hostedGames[gameConf.title] = {
            autohost: gameConf.mgr,
            running: false,
            error: '',
            ws: null,
            game: new Game(),
            lostMarks: {},
        }

        for(const playerName in gameConf.team) {
            const playerNum = gameConf.team[playerName].index;
            const player = gameConf.team[playerName];
            if(!gameConf.team[playerName].isSpectator) {
                this.hostedGames[gameConf.title].lostMarks[playerNum] = {
                    team: player.team,
                    lost: false,
                    name: playerName,
                    isPlayer: !(player.isAI || player.isChicken)
                }
            }
        }
        logger.info(`generated lost marks dict: ${this.hostedGames[gameConf.title].lostMarks}`);

        this.hostedGames[gameConf.title].lostMarks

        this.hostedGames[gameConf.title].game.game_config = this.serializeGameConf(gameConf);
        this.hostedGames[gameConf.title].game.team_win = -1;

        if(gameConf.mgr in this.clients) {
            this.clients[gameConf.mgr].workload += 1
            this.hostedGames[gameConf.title].ws = this.clients[gameConf.mgr].ws
            this.clients[gameConf.mgr].ws.send(JSON.stringify({
                action: 'startGame', 
                parameters: gameConf
            }))
            logger.info(`sending game ${gameConf.title} configration to ${gameConf.mgr}`)
        } else {
            this.hostedGames[gameConf.title].error = 'Manager not connected'
            logger.info(`autohost ${gameConf.mgr} not found`)
        }

    }
    midJoin(title: string, params: {
        playerName: string
        isSpec: boolean
        token: string
        team: string
        id: number
    }) {
        if(!this.hostedGames[title])
            return false;
        if(this.hostedGames[title].running) {
            this.hostedGames[title].ws?.send(JSON.stringify({
                action: 'midJoin',
                parameters: {
                    ...params,
                    title
                }
            }))
        }
    }

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

    killEngine(params: {
        id: number
        title: string
    }) {
        if(!this.hostedGames[params.title])
            return false;
        if(this.hostedGames[params.title].running) {
            this.hostedGames[params.title].ws?.send(JSON.stringify({
                action: 'killEngine',
                parameters: params
            }))
            return true;
        } else {
            logger.info(`game ${params.title} not hosted`)
            return false;
        }
    }

    serializeGameConf(gameConf: GameConf) {
        const map = gameConf.mapId; 
        const teams = gameConf.team;

        let mapStr = `map:${map};`
        let teamStr = '';
        for(const team in teams) {
            if(teams[team].isAI) teamStr += 'ai' + teams[team].team;
            else if(teams[team].isChicken) teamStr += 'chicken' + teams[team].team;
            else if(teams[team].isSpectator) {
                // do nothing for spectators
            } else {
                teamStr += team + teams[team].team;
            }

            teamStr += ',';
        }

        return mapStr + teamStr;
    }
}