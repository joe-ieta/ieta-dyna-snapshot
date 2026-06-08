import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from "typeorm";
import { PermissionEntity } from "./permission.entity";

@Entity("roles")
export class RoleEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  code!: string;

  @Column()
  name!: string;

  @ManyToMany(() => PermissionEntity, { eager: true })
  @JoinTable({ name: "role_permissions" })
  permissions!: PermissionEntity[];
}
