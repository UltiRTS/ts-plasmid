import { GameRoom } from "./states/room"
import { User } from "./states/user"

export interface Receipt {
    receiptOf: string
    seq: number
    status: boolean
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