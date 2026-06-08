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

  @Column()
  type!: string;

  @Column()
  title!: string;

  @Column()
  filePath!: string;

  @Column({ default: "" })
  contentHash!: string;

  @Column({ type: "simple-json", default: "{}" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;
}
