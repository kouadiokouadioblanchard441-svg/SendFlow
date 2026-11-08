-- Track OTP confirmation without retaining the payer's OTP value.
ALTER TABLE sf_payment_attempts
  ADD COLUMN IF NOT EXISTS otp_confirmed_at timestamptz;
