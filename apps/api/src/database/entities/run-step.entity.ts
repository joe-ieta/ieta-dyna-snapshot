import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("run_steps")
@Index(["runId", "stepId"])
export class RunStepEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  runId!: string;

  @Column()
  planId!: string;

  @Column()
  stepId!: string;

  @Column({ default: 0 })
  sequence!: number;

  @Column({ default: "" })
  stepName!: string;

  @Column({ default: "" })
  stepType!: string;

  @Column({ default: "pending" })
  status!: string;

  @Column({ nullable: true })
  startedAt?: Date;

  @Column({ nullable: true })
  finishedAt?: Date;

  @Column({ default: "" })
  errorCode!: string;

  @Column({ default: "" })
  message!: string;

  @Column({ type: "simple-json", default: "{}" })
  diagnostics!: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;
}
