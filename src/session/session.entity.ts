import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('api_sessions')
export class ApiSession {
  @PrimaryColumn()
  token: string;

  @Column()
  phone: string;

  @Column('blob')
  passwordEncrypted: Buffer;

  @Column({ type: 'text', nullable: true })
  siteCookies: string;

  @Column({ nullable: true })
  userId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  lastUsedAt: Date;
}
