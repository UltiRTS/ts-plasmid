import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne } from "typeorm";
import { User } from "./user";

@Entity()
export class ChatRoom {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    roomName: string

    @Column()
    password: string

    @Column('datetime', {default: () => "CURRENT_TIMESTAMP"})
    createAt: Date

    @OneToMany(() => Chat, (chat) => chat.room)
    chats: Chat[]

}

@Entity()
export class Chat {
    @PrimaryGeneratedColumn()
    id: number

    @ManyToOne(() => User, (user) => user.chats)
    author: User

    @Column()
    message: string

    @ManyToOne(() => ChatRoom, (room) => room.chats)
    room: ChatRoom

    @Column('datetime', {default: () => 'CURRENT_TIMESTAMP'})
    createAt: Date

}