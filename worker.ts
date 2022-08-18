import "reflect-metadata"
import { parentPort } from "worker_threads";
import { IncommingMsg } from "./lib/network";
import {AppDataSource} from './db/datasource';
import {User} from './db/models/user';
import { Chat as DBChat, ChatRoom as DBChatRoom } from "./db/models/chat";
import {User as StateUser} from './lib/states/user';
import {ChatRoom as StateChatRoom} from './lib/states/chat';
import {GameRoom} from './lib/states/room';

let dbInitialized = false;

export interface Receipt {
    receiptOf: string
    seq: number
    status: boolean
    message: string
    payload: {[key: string]: any}
}

function toParent(receipt: Receipt) {
    parentPort?.postMessage(receipt)
}

AppDataSource.initialize().then(() => {
    dbInitialized = true;
}).catch(e=> {
    console.log(e)
})


parentPort?.on('message', async (msg: IncommingMsg) => {
    if(!dbInitialized) {
        console.log("DB not initialized");
        return;
    }

    switch(msg.action) {
        case 'LOGIN': {
            const { username, password } = msg.parameters;

            let user = await AppDataSource
                .getRepository(User)
                .findOneBy({
                    username: username
                })
            
            if(user === null) {
                user = new User()
                user.username = username
                const {salt, hash} = User.saltNhash(password)
                user.salt = salt
                user.hash = hash

                await AppDataSource.manager.transaction(async (txEntityManager) => {
                    await txEntityManager.save(user)
                })

                const receipt: Receipt = {
                    receiptOf: 'LOGIN',
                    status: true,
                    seq: msg.seq,
                    message: 'register successfully',
                    payload: {
                        user: user
                    }
                }

                toParent(receipt)
            } else {
                if(user.verify(password)) {
                    const receipt: Receipt = {
                        receiptOf: 'LOGIN',
                        status: true,
                        seq: msg.seq,
                        message: 'login successfully',
                        payload: {
                            user: user
                        }
                    }

                    toParent(receipt)
                } else {
                    const receipt: Receipt = {
                        receiptOf: 'LOGIN',
                        status: false,
                        seq: msg.seq,
                        message: 'wrong password',
                        payload: {}
                    }

                    toParent(receipt)
                }
            }
            break;
        }
        case 'JOINCHAT': {
            const {chat} = msg.payload;
            const {chatName, password} = msg.parameters;
            if(chat === null) {
                const chatRoom = new DBChatRoom()
                chatRoom.password = password
                chatRoom.chats = []
                chatRoom.roomName = chatName

                // can't change to async due to may happen conflicts
                await AppDataSource.manager.transaction(async (txEntityManager) => {
                    await txEntityManager.save(chatRoom)
                })

                parentPort?.postMessage({
                    receiptOf: 'JOINCHAT',
                    status: true,
                    seq: msg.seq,
                    message: 'chat created',
                    payload: {
                        chatRoom,
                        type: 'CREATE'
                    } 
                })
            } else {
                if(password === chat.password) {
                    const receipt: Receipt = {
                        receiptOf: 'JOINCHAT',
                        status: true,
                        seq: msg.seq,
                        message: 'chat joined',
                        payload: {
                            chatRoom: chat,
                            type: 'JOIN'
                        }
                    }

                    toParent(receipt)
                } else {
                    const receipt: Receipt = {
                        receiptOf: 'JOINCHAT',
                        status: false,
                        seq: msg.seq,
                        message: 'wrong password',
                        payload: {}
                    }

                    toParent(receipt)
                }
            }
            break;
        }
        case 'SAYCHAT': {
            const chat: StateChatRoom = msg.payload.chat;
            const user: StateUser = msg.payload.user;
            const {message} = msg.parameters;

            if(chat === null) {
                parentPort?.postMessage({
                    receiptOf: 'SAYCHAT',
                    status: false,
                    seq: msg.seq,
                    message: 'chat not found',
                    payload: {
                        chat
                    }
                })
            } else {
                if(user === null) {
                    parentPort?.postMessage({
                        receiptOf: 'SAYCHAT',
                        status: false,
                        seq: msg.seq,
                        message: 'user not found',
                        payload: {
                            chat
                        }
                    })
                } else {
                    const chatMessage = new DBChat()
                    chatMessage.author = user
                    chatMessage.createAt = new Date()
                    chatMessage.room = chat
                    chatMessage.message = message


                    AppDataSource.manager.transaction(async (txEntityManager) => {
                        try {
                            await txEntityManager.save(chatMessage)
                        } catch(e) {
                            console.log('msg save failed: ', e)
                        }
                    })
                    chat.lastMessage = {
                        author: chatMessage.author.username,
                        content: chatMessage.message,
                        time: chatMessage.createAt
                    }

                    parentPort?.postMessage({
                        receiptOf: 'SAYCHAT',
                        status: true,
                        seq: msg.seq,
                        message: 'chat message sent',
                        payload: {
                            chat
                        }
                    })
                }
            }
            break;
        }
        case 'LEAVECHAT': {
            const chat: StateChatRoom = msg.payload.chat;
            const user: StateUser = msg.payload.user;

            if(chat === null) {
                parentPort?.postMessage({
                    receiptOf: 'LEAVECHAT',
                    status: false,
                    seq: msg.seq,
                    message: 'chat not found',
                    payload: {
                        chat
                    }
                })
            } else {
                if(user === null) {
                    parentPort?.postMessage({
                        receiptOf: 'LEAVECHAT',
                        status: false,
                        seq: msg.seq,
                        message: 'user not found',
                        payload: {
                            chat
                        }
                    })
                } else {
                    chat.members = chat.members.filter((member) => member !== user.username)
                    delete user.chatRooms[chat.roomName]
                    parentPort?.postMessage({
                        receiptOf: 'LEAVECHAT',
                        status: true,
                        seq: msg.seq,
                        message: 'chat left',
                        payload: {
                            chat,
                            user
                        }
                    })
                }
            }
            break;
        }
        case 'JOINGAME': {
            const game: GameRoom = msg.payload.game;
            const user: StateUser = msg.payload.user;
            if(user === null) {
                parentPort?.postMessage({
                    receiptOf: 'JOINGAME',
                    status: false,
                    seq: msg.seq,
                    message: 'user not found',
                    payload: {}
                })
                break;
            }
            if(user.game !== null) {
                parentPort?.postMessage({
                    receiptOf: 'JOINGAME',
                    status: false,
                    seq: msg.seq,
                    message: 'already in game',
                    payload: {
                        game
                    }
                })
                break;
            }
            if(game === null) {
                const {gameName, mapId, password} = msg.parameters;
                const {roomID, autohost} = msg.payload;
                console.log('woker received autohost: ', autohost)
                const gameRoom = 
                    new GameRoom(gameName, user.username, parseInt(mapId), roomID, password, autohost)

                parentPort?.postMessage({
                    receiptOf: 'JOINGAME',
                    status: true,
                    seq: msg.seq,
                    message: 'game created',
                    payload: {
                        game: gameRoom,
                        type: 'CREATE'
                    }
                })
            } else {

                if(user.username in game.players) {
                    parentPort?.postMessage({
                        receiptOf: 'JOINGAME',
                        status: false,
                        seq: msg.seq,
                        message: 'already in game',
                        payload: {
                            game
                        }
                    })
                } else {
                    game.players[user.username] = {
                        isSpec: false,
                        team: 'A',
                        hasmap: false,
                    }

                    parentPort?.postMessage({
                        receiptOf: 'JOINGAME',
                        status: true,
                        seq: msg.seq,
                        message: 'game joined',
                        payload: {
                            game: game,
                            type: 'JOIN'
                        }
                    })
                }
            }
            break;
        }
        case 'MIDJOIN': {
            const game: GameRoom = msg.payload.game;
            const user: StateUser = msg.payload.user;
            if(user === null || game === null) {
                parentPort?.postMessage({
                    receiptOf: 'MIDJOIN',
                    status: false,
                    seq: msg.seq,
                    message: 'user or game not found',
                    payload: {}
                })
                break;
            }

            const playerName = user.username
            const token = game.engineToken
            const isSpec = game.players[playerName].isSpec
            const team = game.players[playerName].team

            parentPort?.postMessage({
                receiptOf: 'MIDJOIN',
                status: true,
                seq: msg.seq,
                message: 'mid join request sent',
                payload: {
                    id: game.id,
                    title: game.title,
                    playerName,
                    token,
                    isSpec,
                    team,
                }
            })

            break;
        }
        case 'SETAI': {
            const game: GameRoom = msg.payload.game;
            const user: StateUser = msg.payload.user;

            if(game === null || user === null) {
                parentPort?.postMessage({
                    receiptOf: 'SETAI',
                    status: false,
                    seq: msg.seq,
                    message: 'user or game not found',
                    payload: {
                        game
                    }
                })
                break;
            }

            const {AI, team, type} = msg.parameters;

            if(game.hoster === user.username) {
                if(type === 'AI') game.ais[AI] = {team}
                else if(type === 'Chicken') game.chickens[AI] = {team}

                parentPort?.postMessage({
                    receiptOf: 'SETAI',
                    status: true,
                    seq: msg.seq,
                    message: 'AI or chicken set',
                    payload: {
                        game
                    }
                })
            } else {
                const poll = AI + team;
                if(!game.polls[poll]) game.polls[poll] = new Set()

                game.polls[poll].add(user.username)
                if(game.polls[poll].size > Object.keys(game.players).length / 2) {
                    if(type === 'AI') game.ais[AI] = {team}
                    else if(type === 'Chicken') game.chickens[AI] = {team}

                    delete game.polls[poll]
                }
                parentPort?.postMessage({
                    receiptOf: 'SETAI',
                    status: true,
                    seq: msg.seq,
                    message: 'AI or chicken set',
                    payload: {
                        game
                    }
                })
            }

            break;
        }
        case 'DELAI': {
            const game: GameRoom = msg.payload.game;
            const user: User = msg.payload.user;

            if(game === null || user === null) {
                parentPort?.postMessage({
                    receiptOf: 'DELAI',
                    status: false,
                    seq: msg.seq,
                    message: 'user or game not found',
                    payload: {
                        game
                    }
                })
                break;
            }

            const {AI, type} = msg.parameters;
            if(game.hoster === user.username) {
                if(type === 'AI') delete game.ais[AI]
                else if(type === 'Chicken') delete game.chickens[AI]

                parentPort?.postMessage({
                    receiptOf: 'DELAI',
                    status: true,
                    seq: msg.seq,
                    message: 'AI deleted',
                    payload: {
                        game
                    }
                })
            } else {
                const poll = 'DEL ' + type + AI;

                if(!game.polls[poll]) game.polls[poll] = new Set()
                game.polls[poll].add(user.username)

                if(game.polls[poll].size > Object.keys(game.players).length / 2) {
                    if(type === 'AI') delete game.ais[AI]
                    else if(type === 'Chicken') delete game.chickens[AI]
                    delete game.polls[poll]
                }

                parentPort?.postMessage({
                    receiptOf: 'DELAI',
                    status: true,
                    seq: msg.seq,
                    message: 'poll added',
                    payload: {
                        game
                    }
                })
            }

            break;
        }
        case 'SETTEAM': {
            const game: GameRoom = msg.payload.game;
            const user: StateUser = msg.payload.user;

            if(game === null || user === null) {
                parentPort?.postMessage({
                    receiptOf: 'SETTEAM',
                    status: false,
                    seq: msg.seq,
                    message: 'user or game not found',
                    payload: {
                        game
                    }
                })
                break;
            }

            const {player, team} = msg.parameters;
            if(user.username === game.hoster || player === user.username) {
                const poll = 'SETTEAM ' + player + team;
                if(game.polls[poll]) delete game.polls[poll]

                game.players[player].team = team
                parentPort?.postMessage({
                    receiptOf: 'SETTEAM',
                    status: true,
                    seq: msg.seq,
                    message: 'team set',
                    payload: {
                        game
                    }
                })
            } else {
                const poll = 'SETTEAM ' + player + team;
                if(!game.polls[poll]) game.polls[poll] = new Set()
                game.polls[poll].add(user.username)

                if(game.polls[poll].size > Object.keys(game.players).length / 2) {
                    game.players[player].team = team
                    delete game.polls[poll]
                }
                parentPort?.postMessage({
                    receiptOf: 'SETTEAM',
                    status: true,
                    seq: msg.seq,
                    message: 'set team poll added',
                    payload: {
                        game
                    }
                })
            }

            break;
        }
        case 'SETSPEC': {
            const game: GameRoom = msg.payload.game;
            const user: StateUser = msg.payload.user;

            if(game === null || user === null) {
                parentPort?.postMessage({
                    receiptOf: 'SETSPEC',
                    status: false,
                    seq: msg.seq,
                    message: 'user or game not found',
                    payload: {
                        game
                    }
                })
                break;
            }

            const {player} = msg.parameters;
            const poll = 'SETSPEC ' + player;

            // if(player == game.hoster) {
            //     parentPort?.postMessage({
            //         receiptOf: 'SETSPEC',
            //         status: false,
            //         seq: msg.seq,
            //         message: "can't set hoster ast spect",
            //         payload: {
            //             game
            //         }
            //     })
            //     break;
            // }
            if(user.username === game.hoster || player === user.username) {
                game.players[player].isSpec = true
                delete game.polls[poll]
                parentPort?.postMessage({
                    receiptOf: 'SETSPEC',
                    status: true,
                    seq: msg.seq,
                    message: 'player set as spec',
                    payload: {
                        game
                    }
                })
            } else {
                if(!game.polls[poll]) game.polls[poll] = new Set()
                game.polls[poll].add(user.username)

                if(game.polls[poll].size > Object.keys(game.players).length / 2) {
                    game.players[player].isSpec = true
                    delete game.polls[poll]
                }
                parentPort?.postMessage({
                    receiptOf: 'SETSPEC',
                    status: true,
                    seq: msg.seq,
                    message: 'set spec poll added',
                    payload: {
                        game
                    }
                })
            }

            break;
        }
        case 'SETMAP': {
            const game: GameRoom = msg.payload.game;
            const user: StateUser = msg.payload.user;

            if(game === null || user === null) {
                parentPort?.postMessage({
                    receiptOf: 'SETTEAM',
                    status: false,
                    seq: msg.seq,
                    message: 'user or game not found',
                    payload: {
                        game
                    }
                })
                break;
            }

            const {mapId} = msg.parameters;

            if(user.username === game.hoster) {
                const poll = 'SETMAP ' + mapId;
                if(game.polls[poll]) delete game.polls[poll];

                for(const player of Object.keys(game.players)) {
                    game.players[player].hasmap = false
                }

                game.mapId = mapId;

                parentPort?.postMessage({
                    receiptOf: 'SETMAP',
                    status: true,
                    seq: msg.seq,
                    message: 'map set',
                    payload: {
                        game
                    }
                })
            } else {
                const poll = 'SETMAP ' + mapId;

                if(!game.polls[poll]) game.polls[poll] = new Set()
                game.polls[poll].add(user.username)

                if(game.polls[poll].size > Object.keys(game.players).length / 2) {
                    game.mapId = mapId 
                    for(const player of Object.keys(game.players)) {
                        game.players[player].hasmap = false
                    }
                    delete game.polls[poll]
                }
                parentPort?.postMessage({
                    receiptOf: 'SETMAP',
                    status: true,
                    seq: msg.seq,
                    message: 'set map poll added',
                    payload: {
                        game
                    }
                })
            }

            break;
        }
        case 'HASMAP': {
            const game: GameRoom = msg.payload.game;
            const user: StateUser = msg.payload.user;

            if(game === null || user === null) {
                console.log('user or game not found')
                parentPort?.postMessage({
                    receiptOf: 'HASMAP',
                    status: false,
                    seq: msg.seq,
                    message: 'user or game not found',
                    payload: {
                        game
                    }
                })
                break;
            }

            let mapId = parseInt(msg.parameters.mapId);
            console.log(mapId)
            if(mapId === game.mapId) {
                game.players[user.username].hasmap = true;
                parentPort?.postMessage({
                    receiptOf: 'HASMAP',
                    status: true,
                    seq: msg.seq,
                    message: 'has map',
                    payload: {
                        game
                    }
                })
            } else {
                parentPort?.postMessage({
                    receiptOf: 'HASMAP',
                    status: false,
                    seq: msg.seq,
                    message: 'report map mismatch',
                    payload: {
                        game
                    }
                })
            }

            break;
        }

        case 'STARTGAME': {
            const game: GameRoom = msg.payload.game;
            const user: StateUser = msg.payload.user;

            if(game === null || user === null) {
                parentPort?.postMessage({
                    receiptOf: 'STARTGAME',
                    status: false,
                    seq: msg.seq,
                    message: 'user or game not found',
                    payload: {
                        game
                    }
                })
                break;
            }
            const poll = 'STARTGAME';
            let start = false;
            if(!game.polls[poll]) game.polls[poll] = new Set()
            if(game.players[user.username].hasmap) {
                console.log('user has map')
                game.polls[poll].add(user.username)
                start = game.polls[poll].size >= Object.keys(game.players).length / 2 
                    || game.hoster === user.username 

                for(const player of Object.keys(game.players)) {
                    start = start && game.players[player].hasmap
                }

                if(start) {
                    delete game.polls[poll]
                }
                parentPort?.postMessage({
                    receiptOf: 'STARTGAME',
                    status: true,
                    seq: msg.seq,
                    message: 'start game poll added',
                    payload: {
                        game,
                        start
                    }
                })
            } else {
                parentPort?.postMessage({
                    receiptOf: 'STARTGAME',
                    status: false,
                    seq: msg.seq,
                    message: user.username + ' does not have map',
                    payload: {
                        game
                    }
                })
            }
            break;
        }
        case 'LEAVEGAME': {
            const game: GameRoom = msg.payload.game;
            const user: StateUser = msg.payload.user;

            if(game === null || user === null) {
                parentPort?.postMessage({
                    receiptOf: 'LEAVEGAME',
                    status: false,
                    seq: msg.seq,
                    message: 'user or game not found',
                    payload: {
                        game,
                    }
                })
                break;
            }

            delete game.players[user.username]
            if(Object.keys(game.players).length === 0) {
                console.log('dimissing');
                parentPort?.postMessage({
                    receiptOf: 'LEAVEGAME',
                    status: true,
                    seq: msg.seq,
                    message: 'game deleted',
                    payload: {
                        game,
                        dismiss: true
                    }
                })
            } else {
                console.log('exiting');
                if(game.players[game.hoster] === undefined) {
                    game.hoster = Object.keys(game.players)[0]
                }
                parentPort?.postMessage({
                    receiptOf: 'LEAVEGAME',
                    status: true,
                    seq: msg.seq,
                    message: user.username + 'leave',
                    payload: {
                        game,
                        dismiss: false
                    }
                })
            }

            break;
        }
        case 'KILLENGINE': {
            const game: GameRoom = msg.payload.game;
            const user: StateUser = msg.payload.user;

            if(game === null || user === null) {
                parentPort?.postMessage({
                    receiptOf: 'KILLENGINE',
                    status: false,
                    seq: msg.seq,
                    message: 'user or game not found',
                    payload: {
                        game,
                    }
                })
                break;
            }

            if(game.hoster === user.username) {
                parentPort?.postMessage({
                    receiptOf: 'KILLENGINE',
                    status: true,
                    seq: msg.seq,
                    message: 'engine killed',
                    payload: {
                        game,
                        dismiss: true
                    }
                })
            }
            break;
        }
    }
})
