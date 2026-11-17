-- FICSDavid ordinary mobile network access and business messaging foundation.
-- This schema does not create a telecom network or activate SMS/calling.
CREATE TABLE IF NOT EXISTS mobile_channel_consents (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  phone_hash TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms','voice')),
  purpose TEXT NOT NULL CHECK (purpose IN ('account_security','service_updates','marketing','customer_support')),
  consent_status TEXT NOT NULL CHECK (consent_status IN ('opted_in','opted_out')),
  consent_source TEXT NOT NULL,
  consented_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mobile_consent_phone_channel
  ON mobile_channel_consents(phone_hash, channel, purpose, consent_status);

CREATE TABLE IF NOT EXISTS mobile_message_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms','voice')),
  direction TEXT NOT NULL CHECK (direction IN ('outbound','inbound')),
  purpose TEXT NOT NULL CHECK (purpose IN ('account_security','service_updates','marketing','customer_support')),
  recipient_phone_ciphertext TEXT,
  recipient_phone_hash TEXT NOT NULL,
  message_ciphertext TEXT,
  template_code TEXT,
  provider_code TEXT,
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','submitted','delivered','failed','rejected','cancelled')),
  failure_code TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  scheduled_at INTEGER,
  submitted_at INTEGER,
  delivered_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mobile_jobs_status_time
  ON mobile_message_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_mobile_jobs_recipient_time
  ON mobile_message_jobs(recipient_phone_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS mobile_provider_webhook_events (
  id TEXT PRIMARY KEY,
  provider_code TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message_job_id TEXT REFERENCES mobile_message_jobs(id) ON DELETE SET NULL,
  received_at INTEGER NOT NULL,
  processed_at INTEGER,
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending','processed','ignored','failed')),
  UNIQUE(provider_code, provider_event_id)
);

CREATE TABLE IF NOT EXISTS mobile_voice_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  provider_code TEXT,
  provider_call_id TEXT,
  caller_phone_hash TEXT,
  recipient_phone_hash TEXT NOT NULL,
  call_mode TEXT NOT NULL CHECK (call_mode IN ('native_dialer','provider_callback','hosted_voice')),
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','ringing','answered','completed','busy','no_answer','failed','cancelled')),
  started_at INTEGER NOT NULL,
  answered_at INTEGER,
  ended_at INTEGER,
  duration_seconds INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mobile_voice_user_time
  ON mobile_voice_sessions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mobile_channel_provider_configs (
  provider_code TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms','voice','sms_voice')),
  integration_mode TEXT NOT NULL CHECK (integration_mode IN ('gateway_api','operator_direct','native_device')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','testing','active','paused')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
