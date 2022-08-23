import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToMany, JoinTable} from "typeorm"
import { Confirmation } from "./confirmation"
import { Chat } from "./chat"
import crypto from 'crypto'

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: number

    @Column('varchar', {unique: true})
    username: string

    @Column()
    hash: string

    @Column()
    salt: string

    @Column('int', {default: 0})
    accessLevel: number

    @Column('int', {default: 0})
    exp: number

    @Column('int', {default: 0})
    sanity: number

    @Column('boolean', {default: false})
    blocked: boolean

    @OneToMany(() => Confirmation, (confirmation) => confirmation.user)
    confirmations: Confirmation[]

    @OneToMany(() => Chat, (chat) => chat.author)
    chats: Chat[]

    @ManyToMany(() => User, (user) => user.id)
    @JoinTable()
    friends: User[]


    static saltNhash(password: string) {
        const salt = crypto.randomBytes(16).toString('hex'); 
    
        // Hashing user's salt and password with 1000 iterations, 
        
        const hash = crypto.pbkdf2Sync(password, salt,  
        1000, 64, `sha512`).toString(`hex`); 

        return {
            salt, hash
        }
    }

    verify(password: string) {
        var hash = crypto.pbkdf2Sync(password,  
            this.salt, 1000, 64, `sha512`).toString(`hex`); 
            return this.hash === hash; 
    }
}