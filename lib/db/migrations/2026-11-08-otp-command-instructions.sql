ALTER TABLE "sf_operator_otp_policies"
  ADD COLUMN IF NOT EXISTS "otp_command" varchar(40);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sf_operator_otp_policy_otp_command_check'
      AND conrelid = '"sf_operator_otp_policies"'::regclass
  ) THEN
    ALTER TABLE "sf_operator_otp_policies"
      ADD CONSTRAINT "sf_operator_otp_policy_otp_command_check"
      CHECK (
        "otp_command" IS NULL
        OR (
          char_length("otp_command") BETWEEN 3 AND 40
          AND "otp_command" ~ '^[*#][0-9*#]{1,38}#$'
        )
      );
  END IF;
END
$$;

COMMENT ON COLUMN "sf_operator_otp_policies"."otp_command" IS
  'Server-managed USSD instruction to obtain an OTP; not the OTP itself or payment confirmation.';
