import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity("capture_plans")
export class CapturePlanEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  projectId!: string;

  @Column()
  externalSystemId!: string;

  @Column()
  code!: string;

  @Column()
  name!: string;

  @Column({ default: "" })
  description!: string;

  @Column({ type: "simple-json", default: "[]" })
  steps!: unknown[];

  @Column({ type: "simple-json", default: "[]" })
  inputSchema!: unknown[];

  @Column({ default: true })
  enabled!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
