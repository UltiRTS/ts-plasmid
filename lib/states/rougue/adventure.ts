import { Effect } from "./effect";
import { Floor } from "./floor";

export class Adventure {
    effects: Effect[] = []
    id: number
    floors: Floor[] = []
    floorTotal: number
    teamHp: number = 300

    recruits: string[] = []
    readys: string[] = []

    budget: number = 10
    recruit_ticket: number = 3
    

    hardness: number = 1

    constructor(id?: number, floorTotal?: number);
    constructor(id: number, floorTotal: number) {
        this.id = id;
        this.floorTotal = floorTotal;

        this.floors.push(this.genFloorPlan(0));
    }

    members() {
        let res: string[] = [];
        for(const floor of this.floors) {
            res = res.concat(floor.members());
        }

        return res;
    }

    ready(player: string) {
        if(!this.readys.includes(player)) this.readys.push(player);
    }

    deready(player: string) {
        if(this.readys.includes(player)) {
            this.readys.splice(this.readys.indexOf(player), 1);
        }
    }

    ready2start() {
        return this.recruits.length === this.readys.length;
    }

    recruit(player: string, config: {
        level: number
        cost: boolean
    } = {level:0, cost:false}) {
        let consumption = 0;
        if(config.cost) {
            consumption = Math.floor(0.1 * config.level);
        }

        if(this.recruit_ticket < 0 || this.budget < consumption) return false;
        if(!this.recruits.includes(player)) {
            this.recruits.push(player);
        }
    }

    derecruit(player: string, config: {
        level: number
        refund: boolean
    } = {level: 0, refund: false}) {
        if(this.recruits.includes(player)) {
            this.recruits.splice(this.recruits.indexOf(player), 1);
            if(config.refund) {
                this.budget += Math.floor(0.1 * config.level);
                this.recruit_ticket++;
            }
        }
    }

    moveTo(player: string, floorIn: number, nodeTo: number) {
        if(this.floors.length < floorIn) {
            return {
                status: false,
                reason: 'no such floor'
            }
        }

        return this.floors[floorIn].moveTo(player, nodeTo);
    }

    leave(player: string) {
        for(const floor of this.floors) {
            floor.leave(player);
        }
    }

    empty() {
        return this.recruits.length === 0;
    }

    // join them to floor 0, node 0
    join(player: string, config: {
        level: number
        cost: boolean
        fund: boolean
    } = {level: 0, cost: false, fund: false}) {

        if(config.cost) {
            this.budget -= Math.floor(0.1 * config.level);
            this.recruit_ticket--;
        }

        if(!this.recruits.includes(player)) {
            return;
        }
        this.floors[0].join(player, 0);
    }

    genFloorPlan(id: number) {
        const floor = new Floor(this.id, id, 15, this.hardness, {
            combat: 0.7,
            decision: 0.1,
            store: 0.2
        });

        return floor;
    }

    serialize() {
        return JSON.stringify(this);
    }

    static from(str: string) {
        // TODO: recursive Object assign to bind related functions to object
        const obj = JSON.parse(str) as Adventure;
        const adv = Object.assign(new Adventure(), obj);
        for(let i=0; i<adv.floors.length; i++) {
            adv.floors[i] = Floor.from(JSON.stringify(adv.floors[i]));
        }

        return adv;
    }
}