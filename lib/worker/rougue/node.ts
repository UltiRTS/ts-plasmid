import { BlobOptions } from "buffer";
import { Game } from "../../../db/models/game";
import { GameRoom } from "../../states/room";

export class Node {
    id: number
    type: string
    floorIn: number

    members: string[] = []
    children: number[] = []

    constructor(type: string, id: number, floorIn: number) {
        this.type = type
        this.id = id;
        this.floorIn = floorIn;
    }

    join(player: string) {
        if(!this.members.includes(player)) this.members.push(player)
    }

    leave(player: string) {
        if(this.members.includes(player)) 
            this.members.splice(this.members.indexOf(player), 1);
    }

    setChildren(children: number[]) {
        this.children = children;
    }
}

export class CombatNode extends Node {

    game: GameRoom
    incre: number

    constructor(id: number, floor: number, adventure: string) {
        super('combat', id, floor)
        this.incre = 0
        this.floorIn = floor
        
        this.game = new GameRoom(`rglike-${adventure}-${floor}-${id}`, 'rglike');
    }

    join(player: string) {
        if(!this.members.includes(player)) this.members.push(player)
    }

    join2play(player: string) {
        this.join(player);
        if(!this.game.isStarted) this.game.setPlayer(player, 'A');
    }

    join2spec(player: string) {
        this.join(player);
        this.game.setPlayer(player, 'A');
        this.game.setSpec(player);
    }

    startGame() {
        // random config
        this.game.setAI('AI0', 'B');
        this.game.setAI('AI1', 'B');
        this.game.setAI('AI2', 'B');
        this.game.setAI('AI3', 'B');

        this.game.setMapId(30);

        return this.game.configureToStart();
    }

    leave(player: string) {
        if(this.members.includes(player)) 
            this.members.splice(this.members.indexOf(player), 1);
    }
}

export class DecisionNode extends Node {
    nodesSelected: number[] = []
    
    constructor(id: number, floor: number) {
        super('decision', id, floor);
    }

    selectNode(node: number) {
        if(!this.nodesSelected.includes(node)) {
            this.nodesSelected.push(node);
            return true;
        } else return false;
    }
}

export class StoreNode extends Node {
    constructor(id: number, floor: number) {
        super('store', id, floor);
    }
}

export class ExitNode extends Node {
    constructor(id: number, floor: number) {
        super('exit', id, floor);
    }
}