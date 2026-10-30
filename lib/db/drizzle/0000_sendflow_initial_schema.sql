CREATE TYPE "public"."sf_transaction_kind" AS ENUM('inter-network', 'deposit', 'international');--> statement-breakpoint
CREATE TYPE "public"."sf_transaction_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."sf_user_account_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."sf_wallet_status" AS ENUM('active', 'locked', 'closed');--> statement-breakpoint
CREATE TYPE "public"."sf_wallet_ledger_direction" AS ENUM('credit', 'debit');--> statement-breakpoint
CREATE TABLE "sf_admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" varchar(255) NOT NULL,
	"action" varchar(64) NOT NULL,
	"resource_type" varchar(32) NOT NULL,
	"resource_id" text NOT NULL,
	"reason" varchar(500),
	"amount_minor" bigint,
	"currency" varchar(3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_admin_grants" (
	"user_id" text PRIMARY KEY NOT NULL,
	"can_mutate" boolean DEFAULT false NOT NULL,
	"pin_hash" text NOT NULL,
	"authorization_version" uuid DEFAULT gen_random_uuid() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"authorization_version" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"pin_verified_until" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sf_admin_sessions_expiry_check" CHECK ("sf_admin_sessions"."expires_at" > "sf_admin_sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "sf_ip_blocklist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"reason" varchar(500) NOT NULL,
	"blocked_by" text NOT NULL,
	"blocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_by" text,
	"revoked_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "sf_ip_blocklist_ip_address_unique" UNIQUE("ip_address"),
	CONSTRAINT "sf_ip_blocklist_positive_version" CHECK ("sf_ip_blocklist"."version" > 0),
	CONSTRAINT "sf_ip_blocklist_revocation_pair" CHECK (("sf_ip_blocklist"."revoked_at" IS NULL) = ("sf_ip_blocklist"."revoked_by" IS NULL)),
	CONSTRAINT "sf_ip_blocklist_host" CHECK ("sf_ip_blocklist"."ip_address" = host("sf_ip_blocklist"."ip_address"::inet) AND masklen("sf_ip_blocklist"."ip_address"::inet) = CASE family("sf_ip_blocklist"."ip_address"::inet) WHEN 4 THEN 32 ELSE 128 END)
);
--> statement-breakpoint
CREATE TABLE "sf_network_defense_allowlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"reason" varchar(500) NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_by" text,
	"revoked_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "sf_network_defense_allowlist_ip_address_unique" UNIQUE("ip_address"),
	CONSTRAINT "sf_network_defense_allowlist_reason_check" CHECK (length(trim("sf_network_defense_allowlist"."reason")) BETWEEN 3 AND 500),
	CONSTRAINT "sf_network_defense_allowlist_version_check" CHECK ("sf_network_defense_allowlist"."version">0),
	CONSTRAINT "sf_network_defense_allowlist_check" CHECK (("sf_network_defense_allowlist"."revoked_at" IS NULL)=("sf_network_defense_allowlist"."revoked_by" IS NULL)),
	CONSTRAINT "sf_network_defense_allowlist_ip_address_check" CHECK ("sf_network_defense_allowlist"."ip_address"=host("sf_network_defense_allowlist"."ip_address"::inet))
);
--> statement-breakpoint
CREATE TABLE "sf_network_defense_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"action" varchar(32) NOT NULL,
	"rule" varchar(32) NOT NULL,
	"blocked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_network_defense_events_action_check" CHECK ("sf_network_defense_events"."action" IN ('automatic_block','admin_release'))
);
--> statement-breakpoint
CREATE TABLE "sf_network_defense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"request_window_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"probe_window_at" timestamp with time zone DEFAULT now() NOT NULL,
	"probe_count" integer DEFAULT 0 NOT NULL,
	"blocked_until" timestamp with time zone,
	"blocked_at" timestamp with time zone,
	"ban_count" integer DEFAULT 0 NOT NULL,
	"rule" varchar(32),
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_network_defense_ip_address_unique" UNIQUE("ip_address"),
	CONSTRAINT "sf_network_defense_request_count_check" CHECK ("sf_network_defense"."request_count">=0),
	CONSTRAINT "sf_network_defense_probe_count_check" CHECK ("sf_network_defense"."probe_count">=0),
	CONSTRAINT "sf_network_defense_ban_count_check" CHECK ("sf_network_defense"."ban_count">=0),
	CONSTRAINT "sf_network_defense_version_check" CHECK ("sf_network_defense"."version">0),
	CONSTRAINT "sf_network_defense_ip_address_check" CHECK ("sf_network_defense"."ip_address"=host("sf_network_defense"."ip_address"::inet))
);
--> statement-breakpoint
CREATE TABLE "sf_api_request_limits" (
	"bucket_hash" varchar(64) PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"request_count" integer NOT NULL,
	CONSTRAINT "sf_api_request_limits_count_check" CHECK ("sf_api_request_limits"."request_count" between 1 and 60)
);
--> statement-breakpoint
CREATE TABLE "sf_banners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(120) NOT NULL,
	"description" text,
	"image_url" text NOT NULL,
	"mobile_image_url" text,
	"image_alt" varchar(180) NOT NULL,
	"cta_label" varchar(48),
	"target_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_by" varchar(255) NOT NULL,
	"updated_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"label" varchar(512) NOT NULL,
	"phone" varchar(512) NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"operator" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_countries" (
	"country_code" varchar(2) PRIMARY KEY NOT NULL,
	"country_name" varchar(120) NOT NULL,
	"phone_prefix" varchar(8) NOT NULL,
	"min_phone_digits" integer NOT NULL,
	"max_phone_digits" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"deposit_enabled" boolean DEFAULT false NOT NULL,
	"inter_network_enabled" boolean DEFAULT false NOT NULL,
	"international_enabled" boolean DEFAULT false NOT NULL,
	"ussd_code" varchar(32),
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_countries_code_format_check" CHECK ("sf_countries"."country_code" ~ '^[a-z]{2}$'),
	CONSTRAINT "sf_countries_phone_prefix_format_check" CHECK ("sf_countries"."phone_prefix" ~ '^\+[1-9][0-9]{0,3}$'),
	CONSTRAINT "sf_countries_phone_digits_range_check" CHECK ("sf_countries"."min_phone_digits" BETWEEN 4 AND 15 AND "sf_countries"."max_phone_digits" BETWEEN "sf_countries"."min_phone_digits" AND 15 AND "sf_countries"."max_phone_digits" + length("sf_countries"."phone_prefix") - 1 <= 15),
	CONSTRAINT "sf_countries_ussd_code_format_check" CHECK ("sf_countries"."ussd_code" IS NULL OR ("sf_countries"."ussd_code" ~ '^[*][0-9]+([*][0-9]+)*#$' AND length("sf_countries"."ussd_code") <= 32))
);
--> statement-breakpoint
CREATE TABLE "sf_customer_auth_attempts" (
	"bucket_hash" varchar(64) PRIMARY KEY NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"blocked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_customer_auth_attempts_count_check" CHECK ("sf_customer_auth_attempts"."failure_count" between 0 and 20)
);
--> statement-breakpoint
CREATE TABLE "sf_customer_biometric_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"session_id" uuid NOT NULL,
	"challenge" text NOT NULL,
	"purpose" varchar(20) NOT NULL,
	"expected_origin" text NOT NULL,
	"rp_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_customer_biometric_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"rp_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"transports" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sf_customer_credentials" (
	"user_id" text PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"pin_hash" text,
	"privacy_accepted_at" timestamp with time zone NOT NULL,
	"privacy_policy_version" varchar(100) NOT NULL,
	"password_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pin_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_customer_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"pin_verified_until" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sf_identity_verification_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'creating' NOT NULL,
	"provider_session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_identity_verification_attempts_provider_session_id_unique" UNIQUE("provider_session_id"),
	CONSTRAINT "sf_identity_verification_attempts_status_check" CHECK ("sf_identity_verification_attempts"."status" in ('creating', 'completed', 'failed', 'abandoned'))
);
--> statement-breakpoint
CREATE TABLE "sf_identity_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider_session_id" text NOT NULL,
	"vendor_data" text NOT NULL,
	"verification_url" text NOT NULL,
	"status" text DEFAULT 'Not Started' NOT NULL,
	"sandbox_scenario" text,
	"last_webhook_event_id" text,
	"last_webhook_type" text,
	"last_provider_event_at" timestamp with time zone,
	"reconciliation_required" boolean DEFAULT false NOT NULL,
	"reconciliation_version" integer DEFAULT 0 NOT NULL,
	"reconciliation_requested_at" timestamp with time zone,
	"reconciled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_identity_verifications_provider_session_id_unique" UNIQUE("provider_session_id")
);
--> statement-breakpoint
CREATE TABLE "sf_identity_webhook_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"provider_session_id" text NOT NULL,
	"event_type" text NOT NULL,
	"matched_verification" boolean DEFAULT false NOT NULL,
	"payload_digest" text,
	"encrypted_payload" text,
	"status" text,
	"status_applied" boolean,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_login_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"city" varchar(120),
	"region" varchar(120),
	"country_code" varchar(2),
	"country_name" varchar(120),
	"location_source" varchar(32),
	"device_type" varchar(24) NOT NULL,
	"browser" varchar(80) NOT NULL,
	"operating_system" varchar(80) NOT NULL,
	"user_agent" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_operator_otp_policies" (
	"country_code" varchar(2) NOT NULL,
	"operator_id" varchar(40) NOT NULL,
	"requires_otp" boolean NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_operator_catalog" (
	"operator_id" varchar(60) PRIMARY KEY NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"name" varchar(120) NOT NULL,
	"short_name" varchar(30) NOT NULL,
	"initials" varchar(8) NOT NULL,
	"brand" varchar(16) NOT NULL,
	"logo_data" "bytea",
	"logo_content_type" varchar(32),
	"enabled" boolean DEFAULT false NOT NULL,
	"deposit_enabled" boolean DEFAULT false NOT NULL,
	"inter_network_enabled" boolean DEFAULT false NOT NULL,
	"international_enabled" boolean DEFAULT false NOT NULL,
	"ussd_code_override" varchar(32),
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_operator_catalog_logo_pair_check" CHECK (("sf_operator_catalog"."logo_data" IS NULL) = ("sf_operator_catalog"."logo_content_type" IS NULL)),
	CONSTRAINT "sf_operator_catalog_logo_size_check" CHECK ("sf_operator_catalog"."logo_data" IS NULL OR octet_length("sf_operator_catalog"."logo_data") BETWEEN 1 AND 524288),
	CONSTRAINT "sf_operator_catalog_logo_type_check" CHECK ("sf_operator_catalog"."logo_content_type" IS NULL OR "sf_operator_catalog"."logo_content_type" IN ('image/png', 'image/jpeg', 'image/webp')),
	CONSTRAINT "sf_operator_catalog_ussd_code_override_format_check" CHECK ("sf_operator_catalog"."ussd_code_override" IS NULL OR ("sf_operator_catalog"."ussd_code_override" ~ '^[*][0-9]+([*][0-9]+)*#$' AND length("sf_operator_catalog"."ussd_code_override") <= 32))
);
--> statement-breakpoint
CREATE TABLE "sf_operator_pricing_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_id" varchar(60) NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"category_id" varchar(30) NOT NULL,
	"fee_percent" numeric(7, 4),
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_phone_otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_hash" varchar(64) NOT NULL,
	"requester_hash" varchar(64) NOT NULL,
	"purpose" varchar(24) DEFAULT 'signup' NOT NULL,
	"provider_verification_id" varchar(255),
	"status" varchar(16) DEFAULT 'starting' NOT NULL,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"check_attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"resend_after" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "sf_phone_otp_status_check" CHECK ("sf_phone_otp_challenges"."status" in ('starting', 'pending', 'verified', 'failed', 'expired', 'superseded', 'locked')),
	CONSTRAINT "sf_phone_otp_purpose_check" CHECK ("sf_phone_otp_challenges"."purpose" in ('signup', 'password_reset', 'pin_reset', 'admin_login')),
	CONSTRAINT "sf_phone_otp_attempts_check" CHECK ("sf_phone_otp_challenges"."check_attempts" between 0 and 5),
	CONSTRAINT "sf_phone_otp_consumed_check" CHECK ("sf_phone_otp_challenges"."consumed_at" is null or "sf_phone_otp_challenges"."status" = 'verified'),
	CONSTRAINT "sf_phone_otp_verified_check" CHECK ("sf_phone_otp_challenges"."phone_verified" = ("sf_phone_otp_challenges"."status" = 'verified' and "sf_phone_otp_challenges"."verified_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "sf_phone_otp_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid,
	"event_type" varchar(16) NOT NULL,
	"outcome" varchar(32) NOT NULL,
	"provider_http_status" integer,
	"diagnostic_message" varchar(300),
	"attempt_number" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "sf_phone_otp_event_type_check" CHECK ("sf_phone_otp_events"."event_type" in ('send', 'verify')),
	CONSTRAINT "sf_phone_otp_event_outcome_check" CHECK ("sf_phone_otp_events"."outcome" in (
        'requested',
        'rate_limited',
        'configuration_error',
        'reservation_error',
        'provider_accepted',
        'provider_rejected',
        'provider_error',
        'provider_rate_limited',
        'challenge_inactive',
        'challenge_expired',
        'challenge_locked',
        'already_verified',
        'not_approved',
        'verified',
        'state_conflict',
        'storage_error'
      )),
	CONSTRAINT "sf_phone_otp_event_provider_status_check" CHECK ("sf_phone_otp_events"."provider_http_status" is null or "sf_phone_otp_events"."provider_http_status" between 100 and 599),
	CONSTRAINT "sf_phone_otp_event_attempt_check" CHECK ("sf_phone_otp_events"."attempt_number" is null or "sf_phone_otp_events"."attempt_number" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "sf_payment_aggregator_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_type" varchar(16) NOT NULL,
	"scope_key" varchar(100) NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"operator_id" varchar(60),
	"aggregator_code" varchar(60),
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_operation_aggregator_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_type" varchar(16) NOT NULL,
	"scope_key" varchar(100) NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"operator_id" varchar(60),
	"operation" varchar(24) NOT NULL,
	"aggregator_code" varchar(60),
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_operation_aggregator_routes_operation_check" CHECK ("sf_operation_aggregator_routes"."operation" IN ('deposit', 'inter-network', 'international'))
);
--> statement-breakpoint
CREATE TABLE "sf_payment_aggregators" (
	"code" varchar(60) PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"updated_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_registration_settings" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"sms_verification_enabled" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" varchar(255) DEFAULT 'system' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_payment_limits" (
	"id" varchar(16) PRIMARY KEY NOT NULL,
	"minimum_deposit_minor" integer DEFAULT 200 NOT NULL,
	"minimum_payout_minor" integer DEFAULT 200 NOT NULL,
	"minimum_inter_network_minor" integer DEFAULT 1 NOT NULL,
	"maximum_transfer_minor" integer DEFAULT 10000000 NOT NULL,
	"maximum_payin_minor" integer DEFAULT 2000000 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_payment_limits_singleton_check" CHECK ("sf_payment_limits"."id" = 'global'),
	CONSTRAINT "sf_payment_limits_deposit_check" CHECK ("sf_payment_limits"."minimum_deposit_minor" BETWEEN 200 AND 2000000),
	CONSTRAINT "sf_payment_limits_payout_check" CHECK ("sf_payment_limits"."minimum_payout_minor" BETWEEN 200 AND 2000000),
	CONSTRAINT "sf_payment_limits_inter_network_check" CHECK ("sf_payment_limits"."minimum_inter_network_minor" BETWEEN 1 AND 10000000),
	CONSTRAINT "sf_payment_limits_transfer_max_check" CHECK ("sf_payment_limits"."maximum_transfer_minor" BETWEEN 1 AND 10000000),
	CONSTRAINT "sf_payment_limits_payin_max_check" CHECK ("sf_payment_limits"."maximum_payin_minor" BETWEEN 200 AND 2000000),
	CONSTRAINT "sf_payment_limits_deposit_transfer_order_check" CHECK ("sf_payment_limits"."minimum_deposit_minor" <= "sf_payment_limits"."maximum_transfer_minor"),
	CONSTRAINT "sf_payment_limits_payout_transfer_order_check" CHECK ("sf_payment_limits"."minimum_payout_minor" <= "sf_payment_limits"."maximum_transfer_minor"),
	CONSTRAINT "sf_payment_limits_inter_network_transfer_order_check" CHECK ("sf_payment_limits"."minimum_inter_network_minor" <= "sf_payment_limits"."maximum_transfer_minor"),
	CONSTRAINT "sf_payment_limits_deposit_payin_order_check" CHECK ("sf_payment_limits"."minimum_deposit_minor" <= "sf_payment_limits"."maximum_payin_minor"),
	CONSTRAINT "sf_payment_limits_version_check" CHECK ("sf_payment_limits"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "sf_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" "sf_transaction_kind" NOT NULL,
	"status" "sf_transaction_status" DEFAULT 'pending' NOT NULL,
	"from_operator" varchar(32),
	"to_operator" varchar(32),
	"sender_phone" varchar(512) NOT NULL,
	"sender_phone_lookup_hash" varchar(64),
	"recipient_phone" varchar(512) NOT NULL,
	"recipient_phone_lookup_hash" varchar(64),
	"currency" text DEFAULT 'XOF' NOT NULL,
	"amount_minor" bigint NOT NULL,
	"fee_minor" bigint DEFAULT 0 NOT NULL,
	"reference" varchar(64) NOT NULL,
	"provider_reference" varchar(512),
	"provider_reference_lookup_hash" varchar(64),
	"idempotency_key" varchar(128) NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255),
	"deletion_reason" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_transactions_reference_unique" UNIQUE("reference"),
	CONSTRAINT "sf_transactions_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "sf_transactions_amount_minor_positive_check" CHECK ("sf_transactions"."amount_minor" > 0),
	CONSTRAINT "sf_transactions_amount_minor_safe_integer_check" CHECK ("sf_transactions"."amount_minor" <= 9007199254740991),
	CONSTRAINT "sf_transactions_fee_minor_nonnegative_check" CHECK ("sf_transactions"."fee_minor" >= 0),
	CONSTRAINT "sf_transactions_fee_minor_safe_integer_check" CHECK ("sf_transactions"."fee_minor" <= 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "sf_users" (
	"id" text PRIMARY KEY NOT NULL,
	"phone" varchar(512),
	"phone_lookup_hash" varchar(64),
	"phone_verified_at" timestamp with time zone,
	"display_name" varchar(512),
	"display_name_lookup_hash" varchar(64),
	"country_code" varchar(2),
	"birth_date" date,
	"birth_date_encrypted" text,
	"status" "sf_user_account_status" DEFAULT 'active' NOT NULL,
	"suspended_at" timestamp with time zone,
	"suspended_by" varchar(255),
	"suspension_reason" varchar(500),
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255),
	"deletion_reason" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "sf_users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "sf_users_phone_lookup_hash_uq" UNIQUE("phone_lookup_hash")
);
--> statement-breakpoint
CREATE TABLE "sf_preview_access" (
	"slot" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sf_preview_access_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "sf_preview_access_single_viewer" CHECK ("sf_preview_access"."slot" = 1),
	CONSTRAINT "sf_preview_access_valid_expiry" CHECK ("sf_preview_access"."expires_at" > "sf_preview_access"."created_at")
);
--> statement-breakpoint
CREATE TABLE "sf_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"currency" text DEFAULT 'XOF' NOT NULL,
	"balance_minor" bigint DEFAULT 0 NOT NULL,
	"status" "sf_wallet_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_wallets_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "sf_wallets_balance_minor_nonnegative_check" CHECK ("sf_wallets"."balance_minor" >= 0),
	CONSTRAINT "sf_wallets_balance_minor_safe_integer_check" CHECK ("sf_wallets"."balance_minor" <= 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "sf_wallet_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"direction" "sf_wallet_ledger_direction" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"balance_before_minor" bigint NOT NULL,
	"balance_after_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"reason" varchar(500) NOT NULL,
	"admin_user_id" varchar(255) NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_wallet_ledger_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "sf_wallet_ledger_amount_minor_positive_check" CHECK ("sf_wallet_ledger"."amount_minor" > 0),
	CONSTRAINT "sf_wallet_ledger_amount_minor_safe_integer_check" CHECK ("sf_wallet_ledger"."amount_minor" <= 9007199254740991),
	CONSTRAINT "sf_wallet_ledger_balance_before_safe_range_check" CHECK ("sf_wallet_ledger"."balance_before_minor" >= 0 and "sf_wallet_ledger"."balance_before_minor" <= 9007199254740991),
	CONSTRAINT "sf_wallet_ledger_balance_after_safe_range_check" CHECK ("sf_wallet_ledger"."balance_after_minor" >= 0 and "sf_wallet_ledger"."balance_after_minor" <= 9007199254740991),
	CONSTRAINT "sf_wallet_ledger_balance_reconciles_check" CHECK (("sf_wallet_ledger"."direction" = 'credit' and "sf_wallet_ledger"."balance_after_minor" = "sf_wallet_ledger"."balance_before_minor" + "sf_wallet_ledger"."amount_minor") or ("sf_wallet_ledger"."direction" = 'debit' and "sf_wallet_ledger"."balance_before_minor" = "sf_wallet_ledger"."balance_after_minor" + "sf_wallet_ledger"."amount_minor"))
);
--> statement-breakpoint
CREATE TABLE "sf_payment_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"provider_code" varchar(60) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"kind" varchar(24) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"fee_minor" bigint NOT NULL,
	"fee_payer" varchar(12) NOT NULL,
	"sender_total_minor" bigint NOT NULL,
	"recipient_total_minor" bigint NOT NULL,
	"state" varchar(32) DEFAULT 'created' NOT NULL,
	"ledger_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_payment_intents_transaction_id_unique" UNIQUE("transaction_id"),
	CONSTRAINT "sf_payment_intents_ledger_entry_id_unique" UNIQUE("ledger_entry_id"),
	CONSTRAINT "sf_payment_intents_request_hash_check" CHECK ("sf_payment_intents"."request_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "sf_payment_intents_kind_check" CHECK ("sf_payment_intents"."kind" in ('deposit','inter-network','international')),
	CONSTRAINT "sf_payment_intents_currency_check" CHECK ("sf_payment_intents"."currency" in ('XOF','XAF')),
	CONSTRAINT "sf_payment_intents_amount_minor_check" CHECK ("sf_payment_intents"."amount_minor" between 1 and 9007199254740991),
	CONSTRAINT "sf_payment_intents_fee_minor_check" CHECK ("sf_payment_intents"."fee_minor" between 0 and 9007199254740991),
	CONSTRAINT "sf_payment_intents_sender_total_minor_check" CHECK ("sf_payment_intents"."sender_total_minor" between 1 and 9007199254740991),
	CONSTRAINT "sf_payment_intents_recipient_total_minor_check" CHECK ("sf_payment_intents"."recipient_total_minor" between 1 and 9007199254740991),
	CONSTRAINT "sf_payment_intents_fee_payer_check" CHECK ("sf_payment_intents"."fee_payer" in ('sender','recipient')),
	CONSTRAINT "sf_payment_intents_state_check" CHECK ("sf_payment_intents"."state" in ('created','collecting','funded','paying','succeeded','failed','uncertain','refund_due')),
	CONSTRAINT "sf_payment_intent_fee_math" CHECK (("sf_payment_intents"."fee_payer"='sender' and "sf_payment_intents"."sender_total_minor"="sf_payment_intents"."amount_minor"+"sf_payment_intents"."fee_minor" and "sf_payment_intents"."recipient_total_minor"="sf_payment_intents"."amount_minor") or ("sf_payment_intents"."fee_payer"='recipient' and "sf_payment_intents"."sender_total_minor"="sf_payment_intents"."amount_minor" and "sf_payment_intents"."recipient_total_minor"="sf_payment_intents"."amount_minor"-"sf_payment_intents"."fee_minor"))
);
--> statement-breakpoint
CREATE TABLE "sf_payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intent_id" uuid NOT NULL,
	"direction" varchar(12) NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"channel_id" varchar(80) NOT NULL,
	"operation_reference" varchar(30) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar(20) DEFAULT 'prepared' NOT NULL,
	"provider_reference" text,
	"provider_reference_hash" varchar(64),
	"final_confirmation_id" uuid,
	"dispatched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_payment_attempts_operation_reference_unique" UNIQUE("operation_reference"),
	CONSTRAINT "sf_payment_attempts_provider_reference_hash_unique" UNIQUE("provider_reference_hash"),
	CONSTRAINT "sf_payment_attempt_leg_unique" UNIQUE("intent_id","direction"),
	CONSTRAINT "sf_payment_attempts_direction_check" CHECK ("sf_payment_attempts"."direction" in ('payin','payout')),
	CONSTRAINT "sf_payment_attempts_channel_id_check" CHECK (length("sf_payment_attempts"."channel_id")>0),
	CONSTRAINT "sf_payment_attempts_operation_reference_check" CHECK ("sf_payment_attempts"."operation_reference" ~ '^[A-Z0-9]{12,30}$'),
	CONSTRAINT "sf_payment_attempts_amount_minor_check" CHECK ("sf_payment_attempts"."amount_minor" between 1 and 9007199254740991),
	CONSTRAINT "sf_payment_attempts_currency_check" CHECK ("sf_payment_attempts"."currency" in ('XOF','XAF')),
	CONSTRAINT "sf_payment_attempts_status_check" CHECK ("sf_payment_attempts"."status" in ('prepared','dispatching','pending','uncertain','succeeded','failed')),
	CONSTRAINT "sf_payment_attempt_reference_pair" CHECK (("sf_payment_attempts"."provider_reference" is null and "sf_payment_attempts"."provider_reference_hash" is null) or ("sf_payment_attempts"."provider_reference" is not null and "sf_payment_attempts"."provider_reference_hash" is not null and "sf_payment_attempts"."provider_reference" ~ '^sfenc-v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$' and octet_length("sf_payment_attempts"."provider_reference")<=4096 and "sf_payment_attempts"."provider_reference_hash" ~ '^[a-f0-9]{64}$')),
	CONSTRAINT "sf_payment_attempt_confirmable_reference" CHECK ("sf_payment_attempts"."status" not in ('pending','succeeded') or "sf_payment_attempts"."provider_reference_hash" is not null)
);
--> statement-breakpoint
CREATE TABLE "sf_payment_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"event_fingerprint" varchar(64) NOT NULL,
	"source" varchar(24) NOT NULL,
	"provider_status" varchar(12) NOT NULL,
	"provider_reference_hash" varchar(64) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"encrypted_payload" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_payment_confirmations_event_fingerprint_unique" UNIQUE("event_fingerprint"),
	CONSTRAINT "sf_payment_confirmations_event_fingerprint_check" CHECK ("sf_payment_confirmations"."event_fingerprint" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "sf_payment_confirmations_source_check" CHECK ("sf_payment_confirmations"."source" in ('provider_status','verified_webhook')),
	CONSTRAINT "sf_payment_confirmations_provider_status_check" CHECK ("sf_payment_confirmations"."provider_status" in ('pending','succeeded','failed')),
	CONSTRAINT "sf_payment_confirmations_provider_reference_hash_check" CHECK ("sf_payment_confirmations"."provider_reference_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "sf_payment_confirmations_amount_minor_check" CHECK ("sf_payment_confirmations"."amount_minor" between 1 and 9007199254740991),
	CONSTRAINT "sf_payment_confirmations_currency_check" CHECK ("sf_payment_confirmations"."currency" in ('XOF','XAF')),
	CONSTRAINT "sf_payment_confirmations_encrypted_payload_check" CHECK ("sf_payment_confirmations"."encrypted_payload" ~ '^sfenc-v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$' and octet_length("sf_payment_confirmations"."encrypted_payload")<=131072)
);
--> statement-breakpoint
CREATE TABLE "sf_wallet_payment_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intent_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"state" varchar(12) DEFAULT 'active' NOT NULL,
	"confirmation_id" uuid,
	"ledger_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_wallet_payment_reservations_intent_id_unique" UNIQUE("intent_id"),
	CONSTRAINT "sf_wallet_payment_reservations_ledger_entry_id_unique" UNIQUE("ledger_entry_id"),
	CONSTRAINT "sf_wallet_payment_reservations_amount_minor_check" CHECK ("sf_wallet_payment_reservations"."amount_minor" between 1 and 9007199254740991),
	CONSTRAINT "sf_wallet_payment_reservations_currency_check" CHECK ("sf_wallet_payment_reservations"."currency" in ('XOF','XAF')),
	CONSTRAINT "sf_wallet_payment_reservations_state_check" CHECK ("sf_wallet_payment_reservations"."state" in ('active','consumed','released'))
);
--> statement-breakpoint
CREATE TABLE "sf_customer_payment_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"public_token" varchar(43) NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"link_name" varchar(120),
	"description" varchar(240) NOT NULL,
	"payment_method" varchar(20) NOT NULL,
	"source" varchar(12) DEFAULT 'linkflow' NOT NULL,
	"expires_at" timestamp with time zone,
	"maximum_uses" integer,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"return_url" varchar(2048),
	"custom_suffix" varchar(32),
	"status" varchar(24) DEFAULT 'draft' NOT NULL,
	"image_data" "bytea",
	"image_size_bytes" integer,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_customer_payment_links_token_check" CHECK ("sf_customer_payment_links"."public_token" ~ '^[A-Za-z0-9_-]{43}$'),
	CONSTRAINT "sf_customer_payment_links_request_hash_check" CHECK ("sf_customer_payment_links"."request_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "sf_customer_payment_links_currency_check" CHECK ("sf_customer_payment_links"."currency" in ('XOF','XAF','CHF','NGN','EUR','USD','CAD')),
	CONSTRAINT "sf_customer_payment_links_amount_check" CHECK (("sf_customer_payment_links"."currency" = 'XOF' and "sf_customer_payment_links"."amount_minor" between 0 and 9007199254740991)
      or ("sf_customer_payment_links"."currency" = 'XAF' and "sf_customer_payment_links"."amount_minor" between 10 and 9007199254740991)
      or ("sf_customer_payment_links"."currency" in ('CHF','NGN','EUR','USD','CAD') and "sf_customer_payment_links"."amount_minor" between 1000 and 9007199254740991)),
	CONSTRAINT "sf_customer_payment_links_description_check" CHECK (length(btrim("sf_customer_payment_links"."description")) between 0 and 240),
	CONSTRAINT "sf_customer_payment_links_link_name_check" CHECK ("sf_customer_payment_links"."link_name" is null or length(btrim("sf_customer_payment_links"."link_name")) between 2 and 120),
	CONSTRAINT "sf_customer_payment_links_payment_method_check" CHECK ("sf_customer_payment_links"."payment_method" in ('mobile_money','card','all')),
	CONSTRAINT "sf_customer_payment_links_source_check" CHECK ("sf_customer_payment_links"."source" in ('linkflow','api')),
	CONSTRAINT "sf_customer_payment_links_maximum_uses_check" CHECK ("sf_customer_payment_links"."maximum_uses" is null or "sf_customer_payment_links"."maximum_uses" between 1 and 999999),
	CONSTRAINT "sf_customer_payment_links_usage_count_check" CHECK ("sf_customer_payment_links"."usage_count" between 0 and 999999 and ("sf_customer_payment_links"."maximum_uses" is null or "sf_customer_payment_links"."usage_count" <= "sf_customer_payment_links"."maximum_uses")),
	CONSTRAINT "sf_customer_payment_links_suffix_check" CHECK ("sf_customer_payment_links"."custom_suffix" is null or "sf_customer_payment_links"."custom_suffix" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "sf_customer_payment_links_return_url_check" CHECK ("sf_customer_payment_links"."return_url" is null or "sf_customer_payment_links"."return_url" ~ '^https://'),
	CONSTRAINT "sf_customer_payment_links_status_check" CHECK ("sf_customer_payment_links"."status" in ('draft','active','paused','expired','exhausted')),
	CONSTRAINT "sf_customer_payment_links_image_data_check" CHECK (("sf_customer_payment_links"."image_data" is null and "sf_customer_payment_links"."image_size_bytes" is null)
      or ("sf_customer_payment_links"."image_data" is not null and "sf_customer_payment_links"."image_size_bytes" between 1 and 5242880
        and octet_length("sf_customer_payment_links"."image_data") = "sf_customer_payment_links"."image_size_bytes"))
);
--> statement-breakpoint
CREATE TABLE "sf_customer_payment_link_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_link_id" uuid NOT NULL,
	"intent_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"poll_token_hash" varchar(64) NOT NULL,
	"merchant_name" varchar(120) NOT NULL,
	"payer_first_name_encrypted" varchar(512) NOT NULL,
	"payer_last_name_encrypted" varchar(512) NOT NULL,
	"ussd_code" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_customer_payment_link_payments_poll_token_hash_unique" UNIQUE("poll_token_hash"),
	CONSTRAINT "sf_customer_link_payment_idempotency_uq" UNIQUE("payment_link_id","idempotency_key"),
	CONSTRAINT "sf_customer_link_payment_intent_uq" UNIQUE("intent_id"),
	CONSTRAINT "sf_customer_link_payment_request_hash_check" CHECK ("sf_customer_payment_link_payments"."request_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "sf_customer_link_payment_poll_token_hash_check" CHECK ("sf_customer_payment_link_payments"."poll_token_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "sf_customer_link_payment_merchant_name_check" CHECK (length(btrim("sf_customer_payment_link_payments"."merchant_name")) between 1 and 120),
	CONSTRAINT "sf_customer_link_payment_first_name_cipher_check" CHECK ("sf_customer_payment_link_payments"."payer_first_name_encrypted" like 'sfenc-v1.%'),
	CONSTRAINT "sf_customer_link_payment_last_name_cipher_check" CHECK ("sf_customer_payment_link_payments"."payer_last_name_encrypted" like 'sfenc-v1.%'),
	CONSTRAINT "sf_customer_link_payment_ussd_code_check" CHECK ("sf_customer_payment_link_payments"."ussd_code" is null or ("sf_customer_payment_link_payments"."ussd_code" ~ '^[*][0-9]+([*][0-9]+)*#$' and length("sf_customer_payment_link_payments"."ussd_code") <= 32))
);
--> statement-breakpoint
CREATE TABLE "sf_developer_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"label" varchar(80) NOT NULL,
	"public_key" varchar(80) NOT NULL,
	"public_key_prefix" varchar(32) NOT NULL,
	"public_key_hash" varchar(64) NOT NULL,
	"secret_key_prefix" varchar(32) NOT NULL,
	"secret_key_hash" varchar(64) NOT NULL,
	"status" varchar(12) DEFAULT 'active' NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_developer_api_keys_public_key_unique" UNIQUE("public_key"),
	CONSTRAINT "sf_developer_api_keys_public_key_hash_unique" UNIQUE("public_key_hash"),
	CONSTRAINT "sf_developer_api_keys_secret_key_hash_unique" UNIQUE("secret_key_hash"),
	CONSTRAINT "sf_developer_api_keys_status_check" CHECK ("sf_developer_api_keys"."status" in ('active','revoked')),
	CONSTRAINT "sf_developer_api_keys_label_check" CHECK (length(btrim("sf_developer_api_keys"."label")) between 1 and 80),
	CONSTRAINT "sf_developer_api_keys_public_prefix_check" CHECK ("sf_developer_api_keys"."public_key_prefix" ~ '^sfpk_[A-Za-z0-9_-]{8,24}$'),
	CONSTRAINT "sf_developer_api_keys_public_hash_check" CHECK ("sf_developer_api_keys"."public_key_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "sf_developer_api_keys_public_key_check" CHECK ("sf_developer_api_keys"."public_key" ~ '^sfpk_(live|test)_[A-Za-z0-9_-]{43}$'),
	CONSTRAINT "sf_developer_api_keys_secret_prefix_check" CHECK ("sf_developer_api_keys"."secret_key_prefix" ~ '^sfsk_[A-Za-z0-9_-]{8,24}$'),
	CONSTRAINT "sf_developer_api_keys_secret_hash_check" CHECK ("sf_developer_api_keys"."secret_key_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "sf_developer_api_keys_revoke_pair_check" CHECK (("sf_developer_api_keys"."status"='active' and "sf_developer_api_keys"."revoked_at" is null) or ("sf_developer_api_keys"."status"='revoked' and "sf_developer_api_keys"."revoked_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "sf_developer_payment_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"api_key_id" uuid NOT NULL,
	"payment_link_id" uuid NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"merchant_reference" varchar(128) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"client_token_hash" varchar(64) NOT NULL,
	"client_token_encrypted" text NOT NULL,
	"mode" varchar(12) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"metadata_encrypted" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_developer_payment_sessions_payment_link_id_unique" UNIQUE("payment_link_id"),
	CONSTRAINT "sf_developer_payment_sessions_client_token_hash_unique" UNIQUE("client_token_hash"),
	CONSTRAINT "sf_developer_payment_sessions_owner_idempotency_uq" UNIQUE("user_id","idempotency_key"),
	CONSTRAINT "sf_developer_payment_sessions_owner_reference_uq" UNIQUE("user_id","merchant_reference"),
	CONSTRAINT "sf_developer_payment_sessions_request_hash_check" CHECK ("sf_developer_payment_sessions"."request_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "sf_developer_payment_sessions_client_token_hash_check" CHECK ("sf_developer_payment_sessions"."client_token_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "sf_developer_payment_sessions_client_token_cipher_check" CHECK ("sf_developer_payment_sessions"."client_token_encrypted" ~ '^sfenc-v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'),
	CONSTRAINT "sf_developer_payment_sessions_mode_check" CHECK ("sf_developer_payment_sessions"."mode" in ('hosted','direct')),
	CONSTRAINT "sf_developer_payment_sessions_amount_check" CHECK ("sf_developer_payment_sessions"."amount_minor" between 200 and 2000000),
	CONSTRAINT "sf_developer_payment_sessions_currency_check" CHECK ("sf_developer_payment_sessions"."currency"='XOF'),
	CONSTRAINT "sf_developer_payment_sessions_idempotency_check" CHECK (length(btrim("sf_developer_payment_sessions"."idempotency_key")) between 8 and 128),
	CONSTRAINT "sf_developer_payment_sessions_reference_check" CHECK (length(btrim("sf_developer_payment_sessions"."merchant_reference")) between 1 and 128),
	CONSTRAINT "sf_developer_payment_sessions_metadata_cipher_check" CHECK ("sf_developer_payment_sessions"."metadata_encrypted" ~ '^sfenc-v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$')
);
--> statement-breakpoint
CREATE TABLE "sf_developer_webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"payment_session_id" uuid NOT NULL,
	"event_type" varchar(40) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(12) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_http_status" varchar(3),
	"last_error_class" varchar(40),
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_developer_webhook_deliveries_event_uq" UNIQUE("endpoint_id","payment_session_id","event_type"),
	CONSTRAINT "sf_developer_webhook_deliveries_payload_check" CHECK (octet_length("sf_developer_webhook_deliveries"."payload"::text) <= 16384),
	CONSTRAINT "sf_developer_webhook_deliveries_event_check" CHECK ("sf_developer_webhook_deliveries"."event_type" in ('payment.succeeded','payment.failed')),
	CONSTRAINT "sf_developer_webhook_deliveries_status_check" CHECK ("sf_developer_webhook_deliveries"."status" in ('pending','delivering','delivered','failed')),
	CONSTRAINT "sf_developer_webhook_deliveries_attempts_check" CHECK ("sf_developer_webhook_deliveries"."attempts" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "sf_developer_webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"label" varchar(80) NOT NULL,
	"url_encrypted" text NOT NULL,
	"events" text[] NOT NULL,
	"signing_secret_encrypted" text NOT NULL,
	"status" varchar(12) DEFAULT 'active' NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_developer_webhook_endpoints_url_cipher_check" CHECK ("sf_developer_webhook_endpoints"."url_encrypted" ~ '^sfenc-v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'),
	CONSTRAINT "sf_developer_webhook_endpoints_events_check" CHECK (cardinality("sf_developer_webhook_endpoints"."events") between 1 and 2 and "sf_developer_webhook_endpoints"."events" <@ ARRAY['payment.succeeded','payment.failed']::text[]),
	CONSTRAINT "sf_developer_webhook_endpoints_secret_cipher_check" CHECK ("sf_developer_webhook_endpoints"."signing_secret_encrypted" ~ '^sfenc-v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'),
	CONSTRAINT "sf_developer_webhook_endpoints_status_check" CHECK ("sf_developer_webhook_endpoints"."status" in ('active','revoked')),
	CONSTRAINT "sf_developer_webhook_endpoints_revoke_pair_check" CHECK (("sf_developer_webhook_endpoints"."status"='active' and "sf_developer_webhook_endpoints"."revoked_at" is null) or ("sf_developer_webhook_endpoints"."status"='revoked' and "sf_developer_webhook_endpoints"."revoked_at" is not null)),
	CONSTRAINT "sf_developer_webhook_endpoints_label_check" CHECK (length(btrim("sf_developer_webhook_endpoints"."label")) between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "sf_replit_payment_test_access" (
	"user_id" text PRIMARY KEY NOT NULL,
	"state" varchar(12) DEFAULT 'active' NOT NULL,
	"granted_by" varchar(120) NOT NULL,
	"reason" varchar(500) NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_by" varchar(120),
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sf_replit_payment_test_access_state_check" CHECK (
    ("sf_replit_payment_test_access"."state"='active' AND "sf_replit_payment_test_access"."revoked_at" IS NULL AND "sf_replit_payment_test_access"."revoked_by" IS NULL)
    OR ("sf_replit_payment_test_access"."state"='revoked' AND "sf_replit_payment_test_access"."revoked_at" IS NOT NULL AND "sf_replit_payment_test_access"."revoked_by" IS NOT NULL)
  ),
	CONSTRAINT "sf_replit_payment_test_access_reason_check" CHECK (length("sf_replit_payment_test_access"."reason") BETWEEN 10 AND 500)
);
--> statement-breakpoint
ALTER TABLE "sf_admin_grants" ADD CONSTRAINT "sf_admin_grants_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_admin_sessions" ADD CONSTRAINT "sf_admin_sessions_user_id_sf_admin_grants_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_admin_grants"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_contacts" ADD CONSTRAINT "sf_contacts_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_customer_biometric_challenges" ADD CONSTRAINT "sf_customer_biometric_challenges_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_customer_biometric_challenges" ADD CONSTRAINT "sf_customer_biometric_challenges_session_id_sf_customer_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sf_customer_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_customer_biometric_credentials" ADD CONSTRAINT "sf_customer_biometric_credentials_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_customer_credentials" ADD CONSTRAINT "sf_customer_credentials_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_customer_sessions" ADD CONSTRAINT "sf_customer_sessions_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_identity_verification_attempts" ADD CONSTRAINT "sf_identity_verification_attempts_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_identity_verifications" ADD CONSTRAINT "sf_identity_verifications_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_login_events" ADD CONSTRAINT "sf_login_events_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_operator_pricing_rates" ADD CONSTRAINT "sf_operator_pricing_rates_operator_id_sf_operator_catalog_operator_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."sf_operator_catalog"("operator_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_phone_otp_events" ADD CONSTRAINT "sf_phone_otp_events_challenge_id_sf_phone_otp_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."sf_phone_otp_challenges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_transactions" ADD CONSTRAINT "sf_transactions_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_preview_access" ADD CONSTRAINT "sf_preview_access_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_wallets" ADD CONSTRAINT "sf_wallets_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_wallet_ledger" ADD CONSTRAINT "sf_wallet_ledger_wallet_id_sf_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."sf_wallets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_wallet_ledger" ADD CONSTRAINT "sf_wallet_ledger_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_payment_intents" ADD CONSTRAINT "sf_payment_intents_transaction_id_sf_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."sf_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_payment_intents" ADD CONSTRAINT "sf_payment_intents_provider_code_sf_payment_aggregators_code_fk" FOREIGN KEY ("provider_code") REFERENCES "public"."sf_payment_aggregators"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_payment_intents" ADD CONSTRAINT "sf_payment_intents_ledger_entry_id_sf_wallet_ledger_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."sf_wallet_ledger"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_payment_attempts" ADD CONSTRAINT "sf_payment_attempts_intent_id_sf_payment_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."sf_payment_intents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_payment_attempts" ADD CONSTRAINT "sf_payment_attempts_country_code_sf_countries_country_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."sf_countries"("country_code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_payment_attempts" ADD CONSTRAINT "sf_payment_attempts_final_confirmation_id_sf_payment_confirmations_id_fk" FOREIGN KEY ("final_confirmation_id") REFERENCES "public"."sf_payment_confirmations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_payment_confirmations" ADD CONSTRAINT "sf_payment_confirmations_attempt_id_sf_payment_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."sf_payment_attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_wallet_payment_reservations" ADD CONSTRAINT "sf_wallet_payment_reservations_intent_id_sf_payment_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."sf_payment_intents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_wallet_payment_reservations" ADD CONSTRAINT "sf_wallet_payment_reservations_wallet_id_sf_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."sf_wallets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_wallet_payment_reservations" ADD CONSTRAINT "sf_wallet_payment_reservations_confirmation_id_sf_payment_confirmations_id_fk" FOREIGN KEY ("confirmation_id") REFERENCES "public"."sf_payment_confirmations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_wallet_payment_reservations" ADD CONSTRAINT "sf_wallet_payment_reservations_ledger_entry_id_sf_wallet_ledger_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."sf_wallet_ledger"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_customer_payment_links" ADD CONSTRAINT "sf_customer_payment_links_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_customer_payment_link_payments" ADD CONSTRAINT "sf_customer_payment_link_payments_payment_link_id_sf_customer_payment_links_id_fk" FOREIGN KEY ("payment_link_id") REFERENCES "public"."sf_customer_payment_links"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_customer_payment_link_payments" ADD CONSTRAINT "sf_customer_payment_link_payments_intent_id_sf_payment_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."sf_payment_intents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_developer_api_keys" ADD CONSTRAINT "sf_developer_api_keys_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_developer_payment_sessions" ADD CONSTRAINT "sf_developer_payment_sessions_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_developer_payment_sessions" ADD CONSTRAINT "sf_developer_payment_sessions_api_key_id_sf_developer_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."sf_developer_api_keys"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_developer_payment_sessions" ADD CONSTRAINT "sf_developer_payment_sessions_payment_link_id_sf_customer_payment_links_id_fk" FOREIGN KEY ("payment_link_id") REFERENCES "public"."sf_customer_payment_links"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_developer_webhook_deliveries" ADD CONSTRAINT "sf_developer_webhook_deliveries_endpoint_id_sf_developer_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."sf_developer_webhook_endpoints"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_developer_webhook_deliveries" ADD CONSTRAINT "sf_developer_webhook_deliveries_payment_session_id_sf_developer_payment_sessions_id_fk" FOREIGN KEY ("payment_session_id") REFERENCES "public"."sf_developer_payment_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_developer_webhook_endpoints" ADD CONSTRAINT "sf_developer_webhook_endpoints_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_replit_payment_test_access" ADD CONSTRAINT "sf_replit_payment_test_access_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sf_admin_audit_admin_created_idx" ON "sf_admin_audit_logs" USING btree ("admin_user_id","created_at");--> statement-breakpoint
CREATE INDEX "sf_admin_audit_resource_created_idx" ON "sf_admin_audit_logs" USING btree ("resource_type","resource_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_admin_sessions_token_uq" ON "sf_admin_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sf_admin_sessions_user_expiry_idx" ON "sf_admin_sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "sf_network_defense_events_created_idx" ON "sf_network_defense_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sf_network_defense_expiry_idx" ON "sf_network_defense" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "sf_banners_active_order_idx" ON "sf_banners" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "sf_banners_schedule_idx" ON "sf_banners" USING btree ("starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "sf_contacts_user_id_idx" ON "sf_contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sf_customer_biometric_challenge_session_expiry_idx" ON "sf_customer_biometric_challenges" USING btree ("session_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_customer_biometric_credential_id_uq" ON "sf_customer_biometric_credentials" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "sf_customer_biometric_user_created_idx" ON "sf_customer_biometric_credentials" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "sf_customer_biometric_user_rp_idx" ON "sf_customer_biometric_credentials" USING btree ("user_id","rp_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_customer_sessions_token_hash_uq" ON "sf_customer_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sf_customer_sessions_user_expiry_idx" ON "sf_customer_sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "sf_identity_verification_attempts_user_created_idx" ON "sf_identity_verification_attempts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "sf_login_events_user_created_idx" ON "sf_login_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "sf_login_events_created_idx" ON "sf_login_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_login_events_user_session_unique" ON "sf_login_events" USING btree ("user_id","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_operator_otp_policy_country_operator_uq" ON "sf_operator_otp_policies" USING btree ("country_code","operator_id");--> statement-breakpoint
CREATE INDEX "sf_operator_catalog_country_idx" ON "sf_operator_catalog" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "sf_operator_catalog_enabled_idx" ON "sf_operator_catalog" USING btree ("enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_operator_pricing_rates_operator_category_uq" ON "sf_operator_pricing_rates" USING btree ("operator_id","category_id");--> statement-breakpoint
CREATE INDEX "sf_operator_pricing_rates_country_category_idx" ON "sf_operator_pricing_rates" USING btree ("country_code","category_id");--> statement-breakpoint
CREATE INDEX "sf_phone_otp_phone_created_idx" ON "sf_phone_otp_challenges" USING btree ("phone_hash","created_at");--> statement-breakpoint
CREATE INDEX "sf_phone_otp_phone_purpose_idx" ON "sf_phone_otp_challenges" USING btree ("phone_hash","purpose","status","expires_at");--> statement-breakpoint
CREATE INDEX "sf_phone_otp_requester_created_idx" ON "sf_phone_otp_challenges" USING btree ("requester_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_phone_otp_provider_verification_uq" ON "sf_phone_otp_challenges" USING btree ("provider_verification_id");--> statement-breakpoint
CREATE INDEX "sf_phone_otp_events_created_idx" ON "sf_phone_otp_events" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sf_phone_otp_events_challenge_created_idx" ON "sf_phone_otp_events" USING btree ("challenge_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sf_phone_otp_events_outcome_created_idx" ON "sf_phone_otp_events" USING btree ("outcome","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sf_phone_otp_events_type_created_idx" ON "sf_phone_otp_events" USING btree ("event_type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "sf_payment_aggregator_routes_scope_uq" ON "sf_payment_aggregator_routes" USING btree ("scope_type","scope_key");--> statement-breakpoint
CREATE INDEX "sf_payment_aggregator_routes_country_idx" ON "sf_payment_aggregator_routes" USING btree ("country_code");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_operation_aggregator_routes_scope_operation_uq" ON "sf_operation_aggregator_routes" USING btree ("scope_type","scope_key","operation");--> statement-breakpoint
CREATE INDEX "sf_operation_aggregator_routes_country_idx" ON "sf_operation_aggregator_routes" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "sf_payment_aggregators_enabled_idx" ON "sf_payment_aggregators" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "sf_transactions_user_created_idx" ON "sf_transactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "sf_transactions_sender_phone_hash_idx" ON "sf_transactions" USING btree ("sender_phone_lookup_hash");--> statement-breakpoint
CREATE INDEX "sf_transactions_recipient_phone_hash_idx" ON "sf_transactions" USING btree ("recipient_phone_lookup_hash");--> statement-breakpoint
CREATE INDEX "sf_transactions_provider_ref_hash_idx" ON "sf_transactions" USING btree ("provider_reference_lookup_hash");--> statement-breakpoint
CREATE INDEX "sf_users_display_name_lookup_hash_idx" ON "sf_users" USING btree ("display_name_lookup_hash");--> statement-breakpoint
CREATE INDEX "sf_wallet_ledger_wallet_created_idx" ON "sf_wallet_ledger" USING btree ("wallet_id","created_at");--> statement-breakpoint
CREATE INDEX "sf_wallet_ledger_user_created_idx" ON "sf_wallet_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "sf_payment_intents_state_idx" ON "sf_payment_intents" USING btree ("state","created_at");--> statement-breakpoint
CREATE INDEX "sf_payment_attempts_reconcile_idx" ON "sf_payment_attempts" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "sf_wallet_payment_reservations_active_idx" ON "sf_wallet_payment_reservations" USING btree ("wallet_id") WHERE "sf_wallet_payment_reservations"."state"='active';--> statement-breakpoint
CREATE INDEX "sf_customer_payment_links_owner_created_idx" ON "sf_customer_payment_links" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_customer_payment_links_public_token_uq" ON "sf_customer_payment_links" USING btree ("public_token");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_customer_payment_links_owner_idempotency_uq" ON "sf_customer_payment_links" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "sf_customer_link_payment_link_created_idx" ON "sf_customer_payment_link_payments" USING btree ("payment_link_id","created_at","id");--> statement-breakpoint
CREATE INDEX "sf_developer_api_keys_owner_created_idx" ON "sf_developer_api_keys" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "sf_developer_payment_sessions_owner_created_idx" ON "sf_developer_payment_sessions" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "sf_developer_webhook_deliveries_due_idx" ON "sf_developer_webhook_deliveries" USING btree ("status","next_attempt_at","created_at");--> statement-breakpoint
CREATE INDEX "sf_developer_webhook_endpoints_owner_created_idx" ON "sf_developer_webhook_endpoints" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_replit_payment_test_access_one_active_uq" ON "sf_replit_payment_test_access" USING btree ("state") WHERE "sf_replit_payment_test_access"."state"='active';