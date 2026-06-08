import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity("external_systems")
export class ExternalSystemEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  projectId!: string;

  @Column()
  code!: string;

  @Column()
  name!: string;

  @Column()
  baseUrl!: string;

  @Column({ default: "" })
  loginUrl!: string;

  @Column()
  browserProfileId!: string;

  @Column({ type: "simple-json", default: "{}" })
  sessionPolicy!: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
