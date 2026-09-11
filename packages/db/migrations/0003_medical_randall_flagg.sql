CREATE TABLE "referral_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_participant_id" uuid NOT NULL,
	"token" text NOT NULL,
	"nickname" text,
	"visit_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "referral_links" ADD CONSTRAINT "referral_links_owner_participant_id_participants_id_fk" FOREIGN KEY ("owner_participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "referral_links_token_key" ON "referral_links" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_links_owner_key" ON "referral_links" USING btree ("owner_participant_id");