import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from '../modules/users/entities/user.entity';
import { CreateUsersTable1744766400000 } from './migrations/1744766400000-CreateUsersTable';

config({ path: '.env' });
config({ path: 'src/.env', override: false });

const parsePort = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parsePort(process.env.DB_PORT, 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASS ?? 'postgres',
  database: process.env.DB_NAME ?? 'rifa',
  synchronize: false,
  entities: [User],
  migrations: [CreateUsersTable1744766400000],
});
