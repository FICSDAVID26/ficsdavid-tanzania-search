-- FICSDavid service foundation: Wallet, Bundle and Communication
-- Cloudflare D1 / SQLite. Schema only: no money movement or provider delivery is enabled.
CREATE TABLE IF NOT EXISTS service_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferred_language TEXT NOT NULL DEFAULT 'sw' CHECK (preferred_language IN ('sw','en')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Wallet: double-entry ledger foundation. Balances must be derived from posted ledger entries.
-- Do not expose any money-moving API until payment partners, authorization and reconciliation are ready.
CREATE TABLE IF NOT EXISTS wallet_accounts (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  account_type TEXT NOT NULL CHECK (account_type IN ('customer','platform','provider','suspense')),
  currency TEXT NOT NULL DEFAULT 'TZS' CHECK (currency = 'TZS'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','frozen','closed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK ((account_type = 'customer' AND owner_user_id IS NOT NULL) OR
         (account_type <> 'customer' AND owner_user_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_customer_unique
  ON wallet_accounts(owner_user_id, currency) WHERE account_type = 'customer';
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_status ON wallet_accounts(status, created_at);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN
    ('top_up','bundle_purchase','transfer','withdrawal','refund','fee','adjustment')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','failed','reversed')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'TZS' CHECK (currency = 'TZS'),
  description TEXT,
  external_reference TEXT,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  posted_at INTEGER,
  reversed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created
  ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status
  ON wallet_transactions(status, created_at);

CREATE TABLE IF NOT EXISTS wallet_ledger_entries (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES wallet_transactions(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
  entry_side TEXT NOT NULL CHECK (entry_side IN ('debit','credit')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'TZS' CHECK (currency = 'TZS'),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_account_time
  ON wallet_ledger_entries(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_transaction
  ON wallet_ledger_entries(transaction_id);
CREATE TRIGGER IF NOT EXISTS wallet_ledger_no_update
BEFORE UPDATE ON wallet_ledger_entries BEGIN
  SELECT RAISE(ABORT, 'Wallet ledger entries are immutable');
END;
CREATE TRIGGER IF NOT EXISTS wallet_ledger_no_delete
BEFORE DELETE ON wallet_ledger_entries BEGIN
  SELECT RAISE(ABORT, 'Wallet ledger entries are immutable');
END;

-- Bundle catalogue and order records. Recipient phone numbers are stored encrypted by the API,
-- never as raw phone numbers. No provider credentials or live prices belong in this database.
CREATE TABLE IF NOT EXISTS bundle_providers (
  id TEXT PRIMARY KEY,
  provider_code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','paused')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bundle_products (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES bundle_providers(id) ON DELETE RESTRICT,
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  data_amount_mb INTEGER,
  validity_seconds INTEGER,
  price_minor INTEGER CHECK (price_minor IS NULL OR price_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'TZS' CHECK (currency = 'TZS'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','paused','retired')),
  last_verified_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider_id, product_code)
);
CREATE TABLE IF NOT EXISTS bundle_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  product_id TEXT REFERENCES bundle_products(id) ON DELETE RESTRICT,
  provider_id TEXT NOT NULL REFERENCES bundle_providers(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE,
  recipient_phone_ciphertext TEXT NOT NULL,
  recipient_phone_hash TEXT NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('self','other')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'TZS' CHECK (currency = 'TZS'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending','payment_pending','paid','processing','delivered','failed','cancelled','refunded')),
  provider_reference TEXT,
  failure_code TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_bundle_orders_user_time
  ON bundle_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bundle_orders_status
  ON bundle_orders(status, created_at);

-- Communication: one shared account identity, private membership and encrypted message payloads.
CREATE TABLE IF NOT EXISTS communication_contacts (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  display_label TEXT NOT NULL,
  phone_hash TEXT,
  email_hash TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(owner_user_id, contact_user_id)
);
CREATE INDEX IF NOT EXISTS idx_communication_contacts_owner
  ON communication_contacts(owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  conversation_type TEXT NOT NULL CHECK (conversation_type IN ('direct','group')),
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  joined_at INTEGER NOT NULL,
  left_at INTEGER,
  PRIMARY KEY(conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user
  ON conversation_members(user_id, joined_at DESC);

CREATE TABLE IF NOT EXISTS communication_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  client_message_id TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  encryption_version TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  edited_at INTEGER,
  deleted_at INTEGER,
  UNIQUE(sender_user_id, client_message_id)
);
CREATE INDEX IF NOT EXISTS idx_communication_messages_conversation
  ON communication_messages(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS communication_blocks (
  blocker_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(blocker_user_id, blocked_user_id),
  CHECK(blocker_user_id <> blocked_user_id)
);

-- Call records and short-lived signalling envelopes only; real-time media requires WebRTC and TURN.
CREATE TABLE IF NOT EXISTS communication_calls (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  initiator_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  call_type TEXT NOT NULL CHECK (call_type IN ('audio','video')),
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN
    ('initiated','ringing','accepted','declined','missed','ended','failed')),
  started_at INTEGER NOT NULL,
  answered_at INTEGER,
  ended_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_communication_calls_initiator
  ON communication_calls(initiator_user_id, started_at DESC);
CREATE TABLE IF NOT EXISTS communication_signals (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES communication_calls(id) ON DELETE CASCADE,
  sender_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal_ciphertext TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_communication_signals_recipient
  ON communication_signals(recipient_user_id, expires_at);

CREATE TABLE IF NOT EXISTS service_audit_events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL CHECK (service_name IN ('wallet','bundle','communication')),
  event_type TEXT NOT NULL,
  reference_id TEXT,
  created_at INTEGER NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_service_audit_user_time
  ON service_audit_events(user_id, created_at DESC);
