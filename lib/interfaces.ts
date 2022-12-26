import { ChatRoom } from "./states/chat"
import { GameRoom } from "./states/room"
import { User } from "./states/user"
import { Adventure } from "./states/rougue/adventure"

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

export interface User2Dump extends Omit<User, 'game' | 'chatRooms' | 'serialize' | 'getState' | 'joinChat' | 'leaveChat' | 'leaveGame' | 'claimConfirmation' | 'verify' | 'adventure' | 'adventures' | 'confirmations' | 'friends' | 'confirmations2dump' | 'friends2dump' | 'reverseMarks' | 'marks'> {
    game: GameRoom | null
    adventure: Adventure | null
    confirmations: Confirmation2Dump[]
    friends: string[]
    onlines: string[]
    chatRooms: {
        [key: string]: ChatRoom
    }
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

export interface CMD_Autohost_Midjoin extends CMD {
    payload: {
        playerName: string
        isSpec: boolean
        token: string
        team: string
        id: number
        title: string
    }
}

export interface CMD_Autohost_Kill_Engine extends CMD {
    payload: {
        id: number
        title: string
    }
}

export interface CMD_Adventure_recruit extends CMD {
    payload: {
        advId: number
        friendName: string
        firstTime: boolean
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

export interface Game_Overview {
    [title: string]: {
        hoster: string
        mapId: number
    }
}

export interface Chat_Overview {
    [title: string]: string
}

export interface Adv_Overview {
    [title: string]: string
}

export interface Confirmation2Dump {
    id: number
    text: string
    type: string
    payload: string
    claimed: boolean
}

export interface Mark2dump {
    id: number
    name: string
    mark: string
}

export interface ConfirmationContent {
    type: string
}

export interface ConfirmationContentAddFriend extends ConfirmationContent {
    targetVal: string
}

export interface ConfirmationContentAdvRecruit extends ConfirmationContent {
    recruiter: string
    advId: number
    firstTime: boolean
}