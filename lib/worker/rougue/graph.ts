import { randomInt } from "crypto"
import { Node } from "./node"

class Graph {
    nodes_count: number
    nodes: Node[] = []
    probs: {[key: string]: number} = {
        cache: 0.7,
        exit: 1

    }
    exit2boss: number
    adj_list: {
        [key: number]: number[]
    } = {}

    constructor(nodes_count: number, partition: {
        combat: number
        decision: number
        store: number
    }, probs: {
        cache: number
        exit: number
        exit2boss: number
    }) {
        this.nodes_count = nodes_count;

        const prob_sum = probs.cache + probs.exit;

        this.probs = {}
        this.probs.cache = probs.cache / prob_sum;
        this.probs.exit = probs.exit / prob_sum + this.probs.cache;

        this.exit2boss = probs.exit2boss;

        const partition_sum = partition.combat + partition.decision + partition.store;
        const pp = {
            combat: 0,
            decision: 0,
            store: 0
        }
        pp.combat = partition.combat / partition_sum;
        pp.decision = partition.decision / partition_sum + pp.combat;
        pp.store = partition.store / partition_sum + pp.decision;

        for(let i=0; i<nodes_count-1; i++) {
            this.adj_list[i] = [];
            if(i < pp.combat * nodes_count) {
                this.nodes.push(new Node('combat', i));
            } else if(i < pp.decision * nodes_count) {
                this.nodes.push(new Node('decision', i));
            } else if(i < pp.store) {
                this.nodes.push(new Node('store', i));
            } else {
                this.nodes.push(new Node('combat', i));
            }
        }
        this.nodes.push(new Node('exit', nodes_count-1));
        this.adj_list[nodes_count-1] = [];
        for(let i=0; i<nodes_count-1; i++) {
            if(this.outDegree(i) === 0) {
                console.log('genrating starts from: ', i);
                this.genGraph(i);
            }
        }
    }

    genGraph(node: number) {
        if(node >= this.nodes.length) return;
        if(node === this.nodes.length-1) return;
        if(this.outDegree(node) > 0) return;

        switch(this.nodes[node].type) {
            case 'combat': {
                let candidates = this.nodes.filter(x => {
                    return (this.outDegree(x.id) === 0) && (x.id != this.nodes[node].id)
                }) 
                // go to exit
                if(candidates.length === 0) {
                    this.adj_list[node].push(this.nodes_count-1);
                    break;
                }
                const nextNodesCount = candidates.length>=6?randomInt(6):randomInt(Math.ceil(candidates.length));
                for(let i=0; i<nextNodesCount; i++) {
                    const nodeSelected = candidates[randomInt(candidates.length)];
                    candidates.splice(candidates.indexOf(nodeSelected), 1);

                    this.adj_list[node].push(nodeSelected.id);
                    this.genGraph(nodeSelected.id);
                }
                break;
            }
            case 'decision': {
                let candidates = this.nodes
                                       .filter(x => {
                                            return (this.outDegree(x.id) === 0) && (x.id !== this.nodes[node].id)
                                       }) 
                // go to exit
                if(candidates.length === 0) {
                    this.adj_list[node].push(this.nodes_count-1);
                    break;
                }

                const nextNodesCount = candidates.length>=6?randomInt(6):randomInt(Math.ceil(candidates.length));
                for(let i=0; i<nextNodesCount; i++) {
                    let nodeSelected = candidates[randomInt(candidates.length)];
                    candidates.splice(candidates.indexOf(nodeSelected), 1);

                    this.adj_list[node].push(nodeSelected.id);
                    this.genGraph(nodeSelected.id);
                }
                break;
            }
            case 'store': {
                let candidates = this.nodes.filter(x => {
                    return (this.outDegree(x.id) === 0) && (x.id !== this.nodes[node].id)
                }) 
                // go to exit
                if(candidates.length === 0) {
                    this.adj_list[node].push(this.nodes_count-1);
                    break;
                }

                const nextNodesCount = candidates.length>=6?randomInt(6):randomInt(Math.ceil(candidates.length));
                for(let i=0; i<nextNodesCount; i++) {
                    let nodeSelected = candidates[randomInt(candidates.length)];
                    candidates.splice(candidates.indexOf(nodeSelected), 1);

                    this.adj_list[node].push(nodeSelected.id);
                    this.genGraph(nodeSelected.id);
                }
                break;
            }
        }

        if(this.adj_list[node].length === 0) this.adj_list[node].push(this.nodes_count - 1);
    }


    outDegree(i: number) {
        if(this.adj_list[i] == null) return 0;

        return this.adj_list[i].length;
    }

    show() {
        for(let i=0; i<this.nodes_count; i++) {
            console.log(this.nodes[i].id, this.nodes[i].type, ':', this.adj_list[i]);
        }
    }
}

const main = () => {
    const g = new Graph(20, {
        combat: 0.7,
        decision: 0.1,
        store: 0.2
    }, {
        cache: 0.95,
        exit: 0.05,
        exit2boss: 0.5
    });

    g.show();
}

main();