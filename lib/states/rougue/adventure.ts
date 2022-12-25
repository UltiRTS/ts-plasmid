import { Effect } from "./effect";
import { Floor } from "./floor";

export class Adventure {
    effects: Effect[] = []
    id: number
    floors: Floor[] = []
    floorTotal: number
    teamHp: number = 300

    recruits: string[] = []

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

    recruit(player: string) {
        if(!this.recruits.includes(player)) this.recruits.push(player);
    }

    derecruit(player: string) {
        if(this.recruits.includes(player)) {
            this.recruits.splice(this.recruits.indexOf(player), 1);
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

    empty() {
        return this.recruits.length === 0;
    }

    // join them to floor 0, node 0
    join(player: string) {
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