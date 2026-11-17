-- FICSDavid Communication Centre: encrypted contact details.
-- Apply only after testing against a non-production D1 database.
ALTER TABLE communication_contacts ADD COLUMN contact_type TEXT;
ALTER TABLE communication_contacts ADD COLUMN phone_ciphertext TEXT;
ALTER TABLE communication_contacts ADD COLUMN email_ciphertext TEXT;

CREATE INDEX IF NOT EXISTS idx_communication_contacts_phone_hash
  ON communication_contacts(owner_user_id, phone_hash);
CREATE INDEX IF NOT EXISTS idx_communication_contacts_email_hash
  ON communication_contacts(owner_user_id, email_hash);
