import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from "typeorm";
import { RoleEntity } from "./role.entity";

@Entity("users")
export class UserEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  username!: string;

  @Column()
  displayName!: string;

  @Column()
  passwordHash!: string;

  @Column({ default: true })
  enabled!: boolean;

  @ManyToMany(() => RoleEntity, { eager: true })
  @JoinTable({ name: "user_roles" })
  roles!: RoleEntity[];
}
