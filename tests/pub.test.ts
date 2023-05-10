import { createClient } from 'redis';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const client = createClient();
  await client.connect();
  const res = await client.configSet({
    'notify-keyspace-events': 'KEA',
  });
  console.log(res);

  for (let i = 0; i < 100; i++) {
    await client.set('a', '1');
    await sleep(100);
    await client.del('a');
  }
}

main();
