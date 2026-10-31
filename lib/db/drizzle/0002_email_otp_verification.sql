ALTER TABLE "sf_phone_otp_challenges" DROP CONSTRAINT "sf_phone_otp_verified_check";--> statement-breakpoint
ALTER TABLE "sf_phone_otp_challenges" ADD COLUMN "email_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "sf_phone_otp_challenges" ADD COLUMN "code_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "sf_phone_otp_challenges" ADD COLUMN "provider_message_id" varchar(255);--> statement-breakpoint
ALTER TABLE "sf_phone_otp_challenges" ADD COLUMN "delivery_channel" varchar(8) DEFAULT 'sms' NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_phone_otp_challenges" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_registration_settings" ADD COLUMN "email_verification_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_users" ADD COLUMN "email_lookup_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "sf_users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "sf_phone_otp_email_created_idx" ON "sf_phone_otp_challenges" USING btree ("email_hash","created_at");--> statement-breakpoint
CREATE INDEX "sf_phone_otp_email_purpose_idx" ON "sf_phone_otp_challenges" USING btree ("email_hash","purpose","status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_users_email_lookup_hash_uq" ON "sf_users" USING btree ("email_lookup_hash");--> statement-breakpoint
ALTER TABLE "sf_phone_otp_challenges" ADD CONSTRAINT "sf_phone_otp_delivery_channel_check" CHECK ("sf_phone_otp_challenges"."delivery_channel" in ('sms', 'email'));--> statement-breakpoint
ALTER TABLE "sf_phone_otp_challenges" ADD CONSTRAINT "sf_phone_otp_email_challenge_check" CHECK ("sf_phone_otp_challenges"."delivery_channel" <> 'email' or "sf_phone_otp_challenges"."email_hash" is not null);--> statement-breakpoint
ALTER TABLE "sf_phone_otp_challenges" ADD CONSTRAINT "sf_phone_otp_email_code_check" CHECK ("sf_phone_otp_challenges"."delivery_channel" <> 'email' or "sf_phone_otp_challenges"."status" not in ('starting', 'pending') or "sf_phone_otp_challenges"."code_hash" is not null);--> statement-breakpoint
ALTER TABLE "sf_phone_otp_challenges" ADD CONSTRAINT "sf_phone_otp_email_verified_check" CHECK ("sf_phone_otp_challenges"."email_verified" = ("sf_phone_otp_challenges"."delivery_channel" = 'email' and "sf_phone_otp_challenges"."status" = 'verified' and "sf_phone_otp_challenges"."verified_at" is not null));--> statement-breakpoint
ALTER TABLE "sf_phone_otp_challenges" ADD CONSTRAINT "sf_phone_otp_verified_check" CHECK ("sf_phone_otp_challenges"."phone_verified" = ("sf_phone_otp_challenges"."delivery_channel" = 'sms' and "sf_phone_otp_challenges"."status" = 'verified' and "sf_phone_otp_challenges"."verified_at" is not null));