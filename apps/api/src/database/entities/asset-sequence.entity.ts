import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("asset_sequences")
export class AssetSequenceEntity {
  @PrimaryColumn()
  projectId!: string;

  @PrimaryColumn()
  dateKey!: string;

  @PrimaryColumn()
  assetType!: string;

  @Column({ default: 1 })
  nextValue!: number;
}
