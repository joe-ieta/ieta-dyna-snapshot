import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("capture_runs")
export class CaptureRunEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  projectId!: string;

  @Column({ default: "pending" })
  status!: string;

  @Column({ type: "simple-json", default: "[]" })
  requestedPlanIds!: string[];

  @Column({ type: "simple-json", default: "{}" })
  inputSnapshot!: Record<string, unknown>;

  @Column({ default: "manual" })
  source!: string;

  @Column({ default: "" })
  errorMessage!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
