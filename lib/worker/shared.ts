/** @format */

import { AppDataSource } from '../../db/datasource';
import { InventoryItem, Mark, User } from '../../db/models/user';
import { ChatRoom } from '../../db/models/chat';
import { RedisStore } from '../store';
import { Confirmation } from '../../db/models/confirmation';
import { Adventure } from '../../db/models/adventure';

export const store = new RedisStore();
export const userRepo = AppDataSource.getRepository(User);
export const chatRepo = AppDataSource.getRepository(ChatRoom);
export const confirmRepo = AppDataSource.getRepository(Confirmation);
export const advRepo = AppDataSource.getRepository(Adventure);
export const markRepo = AppDataSource.getRepository(Mark);
export const invetoryItemRepo = AppDataSource.getRepository(InventoryItem);
