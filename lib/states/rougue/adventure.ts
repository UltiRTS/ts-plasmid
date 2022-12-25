import { Effect } from "./effect";
import { Floor } from "./floor";

export class Adventure {
    effects: Effect[] = []
    name: string = ''
    floors: Floor[] = []
    floorTotal: number
    teamHp: number = 300

    recruits: string[] = []

    hardness: number = 1

    constructor(name?: string, floorTotal?: number);
    constructor(name: string, floorTotal: number) {
        this.name = name;
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
        this.recruits.push(player);
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

    // join them to floor 0, node 0
    join(player: string) {
        if(!(player in this.recruits)) {
            return;
        }
        this.floors[0].join(player, 0);
    }

    genFloorPlan(id: number) {
        const floor = new Floor(this.name, id, 15, this.hardness, {
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