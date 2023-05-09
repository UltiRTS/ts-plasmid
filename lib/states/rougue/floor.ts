import { randomInt } from "crypto"
import { CombatNode, DecisionNode, ExitNode, Node, StoreNode } from "./node"
import { businessLogger as logger } from '@/lib/logger'

export class Floor {
    nodes_count: number
    nodes: Node[] = []
    pp: {[key: string]: number} = {
    }
    exit2boss: number
    adj_list: {
        [key: number]: number[]
    } = {}

    constructor(adventure?: number, floor_id?: number, nodes_count?: number, hardness?: number, partition?: {
        combat: number
        decision: number
        store: number
    });
    constructor(adventure: number = -1, floor_id: number = -1, nodes_count: number = 0, hardness: number = 1, partition: {
        combat: number
        decision: number
        store: number
    } = {
        combat: 0.7,
        decision: 0.2,
        store: 0.1
    }) {
        this.nodes_count = nodes_count;

        const partition_sum = partition.combat + partition.decision + partition.store;
        this.pp = {
            combat: 0,
            decision: 0,
            store: 0
        }
        this.pp.combat = partition.combat / partition_sum;
        this.pp.decision = partition.decision / partition_sum + this.pp.combat;
        this.pp.store = partition.store / partition_sum + this.pp.decision;

        for(let i=0; i<nodes_count-1; i++) {
            const r = Math.random(); 
            if(r < this.pp.combat) {
                this.nodes.push(new CombatNode(i, floor_id, adventure));
            } else if(r >= this.pp.combat && r < this.pp.decision) {
                this.nodes.push(new DecisionNode(i, floor_id));
            } else {
                this.nodes.push(new StoreNode(i, floor_id));
            }
        }

        this.nodes.push(new ExitNode(this.nodes_count-1, floor_id));

        this.genGraph();
    }

    moveTo(player: string, nodeTo: number) {
        let nodeIn = null;
        for(const node of this.nodes) {
            if(node.members.includes(player)) nodeIn = node;
        }
        if(nodeIn === null) {
            return {
                status: false,
                reason: 'not in any node'
            }
        }

        if(!nodeIn.children.includes(nodeTo)) {
            return {
                status: false,
                reason: 'current node is not connected with ' + nodeTo
            }
        }

        if(nodeIn.type === 'combat') {
            let combatNode = nodeIn as CombatNode;
            if(!combatNode.cleared) {
                return {
                    status: false,
                    reason: 'in combat node, not cleared yet'
                }
            }
        }

        nodeIn.leave(player);
        this.nodes[nodeTo].join(player);

        return {
            status: true,
            reason: 'moved'
        }
    }

    genGraph() {
        for(let i=0; i<this.nodes_count; i++) {
            this.adj_list[i] = [];

            const nodesAvailable = this.nodes_count - i - 1;
            const nodes4rand = nodesAvailable>=6?6:nodesAvailable;
            // the last node
            if(nodes4rand === 0) {
                break;
            }
            const nodes2connect = randomInt(1, nodes4rand+1);
            for(let j=0; j<nodes2connect; j++) {
                let adj = randomInt(i+1, this.nodes_count);
                while(this.adj_list[i].includes(adj)) adj = randomInt(i+1, this.nodes_count);
                this.adj_list[i].push(adj);
            }

            this.nodes[i].setChildren(this.adj_list[i]);
        }
        this.adj_list[this.nodes_count-1] = [];
    }

    outDegree(i: number) {
        if(this.adj_list[i] == null) return 0;

        return this.adj_list[i].length;
    }

    join(player: string, node: number) {
        for(let i=0; i<this.nodes.length; i++) {
            this.nodes[i].leave(player);
        }
        this.nodes[node].join(player);
    }

    show() {
        for(let node of this.nodes) {
            logger.info(`node: ${node.type} with ${this.adj_list[node.id]}`); 
        }
    }

    members() {
        let res: string[] = [];
        for(const node of this.nodes) {
            res = res.concat(node.members);
        }

        return res;
    }

    leave(player: string) {
        for(const node of this.nodes) {
            node.leave(player);
        }
    }

    isIn(player: string) {
        for(const node of this.nodes) {
            if(node.isIn(player)) return true;
        }

        return false;
    }


    static from(str: string) {
        const obj = JSON.parse(str) as Floor;
        const floor = Object.assign(new Floor(), obj);
        for(let i=0; i<floor.nodes.length; i++) {
            let node: Node | null = null;
            if(floor.nodes[i].type === 'combat') {
                node = CombatNode.from(JSON.stringify(obj.nodes[i]));
            } else if(floor.nodes[i].type === 'decision') {
                node = DecisionNode.from(JSON.stringify(obj.nodes[i]));
            } else if(floor.nodes[i].type === 'store') {
                node = StoreNode.from(JSON.stringify(obj.nodes[i]));
            } else if(floor.nodes[i].type === 'exit') {
                node = ExitNode.from(JSON.stringify(obj.nodes[i]));
            }
 
            if(node == null) {
                node = new Node();
            }

            floor.nodes[i] = node;
        }
        
        return floor;
    }
}

// const main = () => {
//     const g = new Floor('test adventure', 1, 15, 1, {
//         combat: 0.7,
//         decision: 0.1,
//         store: 0.2
//     });

//     g.show();
// }

// main();