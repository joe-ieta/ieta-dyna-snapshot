import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("assets")
export class AssetEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  assetCode!: string;

  @Column()
  projectId!: string;

  @Column()
  runId!: string;

  @Column({ default: "" })
  planId!: string;

  @Column({ default: "" })
  stepId!: string;

  @Column()
  type!: string;

  @Column()
  title!: string;

  @Column()
  filePath!: string;

  @Column({ default: "application/octet-stream" })
  contentType!: string;

  @Column({ default: "" })
  contentHash!: string;

  @Column({ default: "" })
  sourceUrl!: string;

  @Column({ type: "simple-json", default: "{}" })
  selectorSnapshot!: Record<string, unknown>;

  @Column({ type: "simple-json", default: "{}" })
  parameterSnapshot!: Record<string, unknown>;

  @Column({ type: "simple-json", default: "{}" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;
}
