CREATE TABLE "sf_email_campaign_recipients" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider_message_id" varchar(255),
	"last_error_class" varchar(32),
	"last_error_status" integer,
	"next_attempt_at" timestamp with time zone,
	"processing_started_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_email_campaign_recipient_attempts_check" CHECK ("sf_email_campaign_recipients"."attempts" >= 0),
	CONSTRAINT "sf_email_campaign_recipient_status_check" CHECK ("sf_email_campaign_recipients"."status" in ('draft', 'queued', 'sending', 'accepted', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "sf_email_campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"subject" varchar(200) NOT NULL,
	"body_text" text NOT NULL,
	"audience_mode" varchar(16) NOT NULL,
	"status" varchar(24) DEFAULT 'draft' NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"unverified_recipient_count" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"queued_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "sf_email_campaign_subject_nonblank" CHECK (length(btrim("sf_email_campaigns"."subject")) > 0),
	CONSTRAINT "sf_email_campaign_audience_check" CHECK ("sf_email_campaigns"."audience_mode" in ('all', 'selected')),
	CONSTRAINT "sf_email_campaign_status_check" CHECK ("sf_email_campaigns"."status" in ('draft', 'queued', 'sending', 'completed', 'completed_with_errors', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "sf_email_campaign_recipients" ADD CONSTRAINT "sf_email_campaign_recipients_campaign_id_sf_email_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."sf_email_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_email_campaign_recipients" ADD CONSTRAINT "sf_email_campaign_recipients_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_email_campaigns" ADD CONSTRAINT "sf_email_campaigns_created_by_sf_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."sf_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sf_email_campaign_recipient_uq" ON "sf_email_campaign_recipients" USING btree ("campaign_id","user_id");--> statement-breakpoint
CREATE INDEX "sf_email_campaign_recipient_queue_idx" ON "sf_email_campaign_recipients" USING btree ("status","next_attempt_at","created_at");--> statement-breakpoint
CREATE INDEX "sf_email_campaign_recipient_campaign_status_idx" ON "sf_email_campaign_recipients" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX "sf_email_campaign_created_idx" ON "sf_email_campaigns" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sf_email_campaign_status_idx" ON "sf_email_campaigns" USING btree ("status","queued_at");