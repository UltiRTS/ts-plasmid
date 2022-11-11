import { GameRoom } from "./states/room"
import { User } from "./states/user"

export interface GameConf {
    id: number
    title: string
    mgr: string
    aiHosters: number[]
    mapId: number
    team: {[key: string]: {
      index: number,
      isAI: boolean,
      isChicken: boolean,
      isSpectator: boolean,
      team: number,
    }}
    [key: string]: any
}
export interface Receipt {
    message: string
    payload: {[key: string]: any}
}

export interface User2Dump extends Omit<User, 'game'> {
    game: GameRoom | null
}

export interface State {
    user: User2Dump | null,
    chats: string[],
    games: {
        title: string
        hoster: string
        mapId: number
    }[]
}

export interface CMD {
    to: string,
    action: string,
    payload: {
        [key: string]: any
    }
}

export interface CMD_Autohost_Start_Game extends CMD {
    payload: {
        gameConf: GameConf
        [key: string]: any
    }
}

export interface Wrapped_Message {
    payload: {
        receipt?: Receipt
        state?: State
        cmd?: CMD
    }
    receiptOf: string
    status: boolean
    seq: number
    // cmd, network, all
    targets: string[],
    // usernames
    client: string
}