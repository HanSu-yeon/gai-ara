DROP INDEX "target_challenges_target_hash_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "target_challenges_target_hash_key" ON "target_challenges" USING btree ("target_instagram_username_hash");