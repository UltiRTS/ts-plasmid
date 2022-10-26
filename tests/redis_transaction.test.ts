import { createClient} from "redis";

const main = async () => {
    const client = createClient();

    client.set('a', '1');
}