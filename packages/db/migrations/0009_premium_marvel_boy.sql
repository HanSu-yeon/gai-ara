CREATE TABLE "target_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"display_name" text NOT NULL,
	"target_instagram_username_hash" text NOT NULL,
	"creator_participant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "target_challenges" ADD CONSTRAINT "target_challenges_creator_participant_id_participants_id_fk" FOREIGN KEY ("creator_participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "target_challenges_token_key" ON "target_challenges" USING btree ("token");--> statement-breakpoint
CREATE INDEX "target_challenges_target_hash_idx" ON "target_challenges" USING btree ("target_instagram_username_hash");