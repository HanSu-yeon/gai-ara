CREATE TABLE "referral_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_link_id" uuid NOT NULL,
	"visitor_participant_id" uuid NOT NULL,
	"nickname" text,
	"status" text NOT NULL,
	"distance" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "referral_visits" ADD CONSTRAINT "referral_visits_referral_link_id_referral_links_id_fk" FOREIGN KEY ("referral_link_id") REFERENCES "public"."referral_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_visits" ADD CONSTRAINT "referral_visits_visitor_participant_id_participants_id_fk" FOREIGN KEY ("visitor_participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "referral_visits_link_visitor_key" ON "referral_visits" USING btree ("referral_link_id","visitor_participant_id");--> statement-breakpoint
ALTER TABLE "referral_links" DROP COLUMN "visit_count";