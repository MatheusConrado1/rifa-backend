import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'int', default: 100 })
  walletBalance: number;

  @Column({ type: 'int', default: 0 })
  gamesPlayed: number;

  @Column({ type: 'int', default: 0 })
  gamesWon: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
