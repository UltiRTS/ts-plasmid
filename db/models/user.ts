import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm"
import { Confirmation } from "./confirmation"

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    username: string

    @Column()
    password: string

    @Column()
    accessLevel: number

    @Column()
    exp: number

    @Column()
    sanity: number

    @Column()
    blocked: boolean

    @OneToMany(() => Confirmation, (confirmation) => confirmation.user)
    confirmations: Confirmation[]

}