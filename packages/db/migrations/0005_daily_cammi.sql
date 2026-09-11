ALTER TABLE "participants" ADD COLUMN "recovery_token" text;--> statement-breakpoint
UPDATE "participants" SET "recovery_token" = replace(gen_random_uuid()::text, '-', '') WHERE "recovery_token" IS NULL;--> statement-breakpoint
ALTER TABLE "participants" ALTER COLUMN "recovery_token" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "participants_recovery_token_key" ON "participants" USING btree ("recovery_token");