import { BlobOptions } from "buffer";
import { json } from "stream/consumers";
import { Game } from "../../../db/models/game";
import { GameRoom } from "../../states/room";

export class Node {
    id: number = -1
    type: string = ''
    floorIn: number = -1 
    adventure: string = ''

    members: string[] = []
    children: number[] = []

    constructor(type?: string, id?: number, floorIn?: number, adventure?: string);
    constructor(type: string, id: number, floorIn: number, adventure: string) {
        this.type = type
        this.id = id;
        this.floorIn = floorIn;
        this.adventure = adventure
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

    static from(str: string) {
        try {
            return Object.assign(new Node(), JSON.parse(str));
        } catch(e) {
            console.log('simple node from: ', e);
            return null;
        }
    }
}

export class CombatNode extends Node {

    game: GameRoom = new GameRoom()
    cleared: boolean = false

    constructor(id?: number, floor?: number, adventure?: string);
    constructor(id: number, floor: number, adventure: string) {
        super('combat', id, floor, adventure)
        this.floorIn = floor
        this.adventure = adventure
        
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

    static from(str: string) {
        try {
            const node = Object.assign(new CombatNode(), JSON.parse(str) as CombatNode);
            const obj = JSON.parse(str) as CombatNode;
            const game = GameRoom.from(JSON.stringify(obj.game));
            if(game == null) 
                node.game = new GameRoom(`rglike-${obj.adventure}-${obj.floorIn}-${obj.id}`, 'rglike');
            else node.game = game;
            return node;
        } catch(e) {
            console.log('combat node from: ', e);
            return null;
        }
    }
}

export class DecisionNode extends Node {
    nodesSelected: number[] = []
    
    constructor(id?: number, floor?: number, adventure?: string);
    constructor(id: number, floor: number, adventure: string) {
        super('decision', id, floor, adventure);
    }

    selectNode(node: number) {
        if(!this.nodesSelected.includes(node)) {
            this.nodesSelected.push(node);
            return true;
        } else return false;
    }

    static from(str: string) {
        try {
            return Object.assign(new DecisionNode(), JSON.parse(str));
        } catch(e) {
            console.log('decision node from: ', e);
            return null;
        }
    }
}

export class StoreNode extends Node {
    constructor(id?: number, floor?: number, adventure?: string);
    constructor(id: number, floor: number, adventure: string) {
        super('store', id, floor, adventure);
    }

    static from(str: string) {
        try {
            return Object.assign(new StoreNode(), JSON.parse(str));
        } catch(e) {
            console.log('store node from: ', e);
            return null;
        }
    }
}

export class ExitNode extends Node {
    constructor(id?: number, floor?: number, adventure?: string);
    constructor(id: number, floor: number, adventure: string) {
        super('exit', id, floor, adventure);
    }

    static from(str: string) {
        try {
            return Object.assign(new ExitNode(), JSON.parse(str));
        } catch(e) {
            console.log('exit node from: ', e);
            return null;
        }
    }
}