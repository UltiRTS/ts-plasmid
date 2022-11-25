import { Effect } from "./effect";
import { Floor } from "./floor";

export class Adventure {
    effects: Effect[] = []
    name: string = ''
    floors: Floor[] = []
    floorTotal: number
    teamHp: number = 300

    hardness: number = 1

    constructor(name?: string, floorTotal?: number);
    constructor(name: string, floorTotal: number) {
        this.name = name;
        this.floorTotal = floorTotal;

        this.floors.push(this.genFloorPlan());
    }

    members() {
        let res: string[] = [];
        for(const floor of this.floors) {
            res = res.concat(floor.members());
        }

        return res;
    }

    // join them to floor 0, node 0
    join(player: string) {
        this.floors[0].join(player, 0);
    }

    genFloorPlan() {
        const floor = new Floor(this.name, 1, 15, this.hardness, {
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