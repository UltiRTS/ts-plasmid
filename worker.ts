import { parentPort } from "worker_threads";
import { IncommingMsg } from "./lib/network";

parentPort?.on('message', (msg: IncommingMsg) => {

    switch(msg.action) {
        case 'LOGIN': {

        }
    }
})
