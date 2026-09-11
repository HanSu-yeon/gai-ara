CREATE TABLE "follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_participant_id" uuid NOT NULL,
	"followee_identity_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pair_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"inviter_participant_id" uuid NOT NULL,
	"recipient_participant_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pair_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pair_invite_id" uuid NOT NULL,
	"distance" integer,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"participant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_participant_id_participants_id_fk" FOREIGN KEY ("follower_participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_invites" ADD CONSTRAINT "pair_invites_inviter_participant_id_participants_id_fk" FOREIGN KEY ("inviter_participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_invites" ADD CONSTRAINT "pair_invites_recipient_participant_id_participants_id_fk" FOREIGN KEY ("recipient_participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pair_results" ADD CONSTRAINT "pair_results_pair_invite_id_pair_invites_id_fk" FOREIGN KEY ("pair_invite_id") REFERENCES "public"."pair_invites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "follows_pair_key" ON "follows" USING btree ("follower_participant_id","followee_identity_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "pair_invites_token_key" ON "pair_invites" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "pair_results_pair_invite_key" ON "pair_results" USING btree ("pair_invite_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_identity_hash_key" ON "participants" USING btree ("identity_hash");