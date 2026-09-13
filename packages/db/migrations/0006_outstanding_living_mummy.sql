CREATE TABLE "acquaintance_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid NOT NULL,
	"confirmer_participant_id" uuid NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "acquaintance_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"owner_participant_id" uuid NOT NULL,
	"max_uses" integer DEFAULT 50 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "acquaintance_confirmations" ADD CONSTRAINT "acquaintance_confirmations_link_id_acquaintance_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."acquaintance_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acquaintance_confirmations" ADD CONSTRAINT "acquaintance_confirmations_confirmer_participant_id_participants_id_fk" FOREIGN KEY ("confirmer_participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acquaintance_links" ADD CONSTRAINT "acquaintance_links_owner_participant_id_participants_id_fk" FOREIGN KEY ("owner_participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "acquaintance_confirmations_link_confirmer_key" ON "acquaintance_confirmations" USING btree ("link_id","confirmer_participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "acquaintance_links_token_key" ON "acquaintance_links" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_accounts_provider_account_key" ON "oauth_accounts" USING btree ("provider","provider_account_id");