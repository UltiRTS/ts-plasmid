import {createClient, RedisClientType, } from 'redis';


const main = async () => {
    const client = createClient();
    await client.connect();
    const res = await client.configSet({
        'notify-keyspace-events': 'KEA'
    })
    console.log(res);

    await client.subscribe('__keyevent@0__:del', (key: string) => {
        console.log(key)
    })

}

main();