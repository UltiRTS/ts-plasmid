import { createClient } from 'redis';

async function main() {
  const client = createClient();

  client.set('a', '1');
}
