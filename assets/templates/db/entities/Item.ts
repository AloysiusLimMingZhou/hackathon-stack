import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

/**
 * Example entity — rename/replace it with the hackathon's real domain.
 * Rules (see references/database.md for why):
 *  - explicit table name in @Entity("...")
 *  - explicit `type` on every column
 *  - relations use arrow targets + `Relation<>` wrapper:  @ManyToOne(() => Team) team!: Relation<Team>
 *  - users live in Better Auth's "user" table; reference them by a text `ownerId`, no TypeORM entity for it
 */
@Entity("items")
export class Item {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "text" })
  title!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Index()
  @Column({ type: "text", nullable: true })
  ownerId!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
