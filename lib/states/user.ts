
import {User as DBUser} from '../../db/models/user';


export class User extends DBUser {
    constructor(user: DBUser) {
        super();
        this.id = user.id;
        this.username = user.username;
        this.accessLevel = user.accessLevel;
        this.exp = user.exp;
        this.sanity = user.sanity;
        this.blocked = user.blocked;
        // clear sensitive fields
        this.hash = "";
        this.salt = "";
    }

    getState() {
        return {
            id: this.id,
            username: this.username,
            accessLevel: this.accessLevel,
            exp: this.exp,
            sanity: this.sanity,
            blocked: this.blocked
        }
    }
}