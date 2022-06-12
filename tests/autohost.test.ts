import {GameRoom} from '../lib/states/room';
import {AutohostManager} from '../lib/autohost';

const room = new GameRoom('test', 'chan', 1, 1, '', '::ffff:127.0.0.1')

const gameConf = room.configureToStart()

const autohostMgr = new AutohostManager(['127.0.0.1', '::ffff:127.0.0.1'], {
    port: 5000
})

autohostMgr.on('gameStarted', (gameName) => {
    console.log(`game ${gameName} started`)
})

autohostMgr.on('gameEnded', (gameName) => {
    console.log(`game ${gameName} ended`)
})

autohostMgr.on('conn', (ws, req) => {
    console.log('autohost connected')
    setTimeout(() => {
        autohostMgr.start(gameConf)
    }, 1000);
})