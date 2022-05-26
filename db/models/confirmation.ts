import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { User } from "./user";

@Entity()
export class Confirmation {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    text: string;

    @Column()
    type: string;

    @Column()
    payload: string;

    @Column()
    claimed: boolean;

    @ManyToOne(() => User, (user) => user.confirmations)
    user: User
}

