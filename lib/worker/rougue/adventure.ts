import { Effect } from "./effect";
import { Floor } from "./floor";

export class Adventure {
    effects: Effect[] = []
    name: string = ''
    floors: Floor[] = []
    floorTotal: number
    teamHp: number = 300

    hardness: number = 1

    constructor(name: string, floorTotal: number) {
        this.name = name;
        this.floorTotal = floorTotal;

        this.floors.push(this.genFloorPlan());
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
        return JSON.parse(str) as Adventure;
    }
}