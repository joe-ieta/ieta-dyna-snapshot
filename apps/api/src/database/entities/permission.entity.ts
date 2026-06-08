import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("permissions")
export class PermissionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  code!: string;

  @Column()
  name!: string;

  @Column({ default: "" })
  description!: string;
}
