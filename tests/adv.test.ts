import { Adventure } from "../lib/states/rougue/adventure";
import { RedisStore } from "../lib/store";

const main = async () => {
    const adv = new Adventure(1000, 3);
    const user = 'user';

    adv.recruit(user);
    adv.join(user);

    console.log(adv.recruits);
    console.log(adv.members());

    const store = new RedisStore();

    await store.setAdventure(1, adv);
    const res = await store.getAdventure(1);
    console.log(res);
}

main();