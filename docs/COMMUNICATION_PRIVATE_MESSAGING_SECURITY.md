# FICSDavid Private Messaging — Security Design and Release Gates

**Status: design only. Private messaging is not enabled.**

This document defines the security work required before FICSDavid can send or receive private messages. The existing D1 tables are storage foundations only; they are not proof that end-to-end encryption (E2EE), key management, or message authorization has been implemented.

## 1. Current implementation facts

- The shared account API authenticates a user through the `__Host-ficsd_session` cookie and resolves the active account on the server.
- D1 already has `conversations`, `conversation_members`, `communication_messages`, and `communication_blocks`.
- `communication_messages.ciphertext` and `encryption_version` are storage columns only. No private-message API currently creates, reads, or validates these records.
- There is no device identity/public-key registry, pre-key lifecycle, conversation-key envelope store, or client-side E2EE implementation in the current repository.
- Therefore, do not describe Messages as live, E2EE, or ready for private information.

## 2. Required security model

1. **Client-side encryption:** plaintext must be encrypted on the sender's device before a request reaches FICSDavid servers. Decryption must happen only on authorized recipient devices.
2. **No custom cryptography:** select a maintained, independently reviewed E2EE protocol implementation that supports the target browsers and mobile devices. Do not invent a key exchange, ratchet, signature, or cipher format.
3. **Per-device identity:** each device gets its own cryptographic identity and signed key material. A user's devices must be independently revocable.
4. **Forward secrecy and recovery policy:** the chosen protocol must document forward secrecy, post-compromise recovery, device addition/removal, lost-device handling, and backup behavior. Do not silently weaken these properties for multi-device support.
5. **Conversation key distribution:** only active conversation members' verified devices may receive the key material needed to decrypt messages. Group membership changes must trigger the protocol's required key rotation.
6. **Identity verification:** provide a way for users to compare/verify safety numbers or equivalent identity fingerprints. Warn when a contact's identity keys change.
7. **Opaque server storage:** the API stores ciphertext and the minimum routing metadata needed for delivery. It must never accept a plaintext message field or log message bodies, encryption keys, tokens, or decrypted payloads.
8. **Membership enforcement:** every conversation read, send, receipt, and key lookup must verify that the authenticated user is an active member. A supplied conversation ID is never authorization.
9. **Blocking and abuse controls:** enforce block rules in both directions for new direct conversations and sends; add per-user and per-conversation rate limits, payload limits, abuse reporting, and account-level controls.
10. **Transport and browser security:** require HTTPS, strict origin checks for writes, secure session cookies, restrictive Content Security Policy, dependency pinning, and protection against cross-site scripting. E2EE does not protect plaintext from malicious JavaScript running in the page.

## 3. Proposed staged implementation

### Stage A — protocol and threat-model decision
- Choose a maintained E2EE implementation with browser/mobile support and a clear security review history.
- Document the exact protocol version, supported device platforms, key lifecycle, multi-device behavior, and recovery limitations.
- Review dependency provenance, release signing, update policy, and vulnerability response.
- Do not create message endpoints until this decision is approved.

### Stage B — device and key lifecycle
- Add device registration, public identity keys, signed pre-keys/one-time pre-keys (as required by the selected protocol), key versioning, and device revocation.
- Keep private keys on the user's device; never upload private identity keys or conversation plaintext.
- Add authenticated key publication and retrieval with rate limits, key-change notifications, and anti-replay checks.
- Define safe account recovery without silently restoring access to old message history.

### Stage C — conversation and ciphertext transport
- Add authenticated direct/group conversation creation and membership management.
- Add paginated message retrieval and ciphertext-only message submission.
- Validate envelope format, protocol version, ciphertext size, sender/device registration, membership, block state, timestamps, and idempotency.
- Use server-generated IDs/timestamps; treat client timestamps as untrusted.
- Scope every SQL query to the authenticated user and active membership. Use parameterized SQL throughout.
- Keep message bodies out of logs, audit metadata, analytics, support tickets, and error responses.

### Stage D — client interface and independent testing
- Build the message composer only after client-side encryption/decryption is working with test vectors.
- Test two-account and multi-device flows, removed members, blocked users, revoked devices, replayed requests, duplicate submissions, oversized payloads, malformed envelopes, key changes, offline delivery, and account recovery.
- Obtain an independent security review before enabling real users.
- Roll out behind a server-side feature flag and keep it disabled until every release gate passes.

## 4. Minimum API authorization rules

For every future endpoint:
- Resolve the user from the server-side session; never accept a user ID as proof of identity.
- For conversation operations, join `conversation_members` and require `left_at IS NULL`.
- For direct messaging, reject self-conversations and enforce the block table in both directions.
- For message history, apply membership filtering in the SQL query itself, not only in frontend code.
- For message submission, require a registered, non-revoked sender device and a valid ciphertext envelope; enforce idempotency and rate limits.
- For key retrieval, publish only public protocol material and prevent unauthorized enumeration.
- Return generic authorization errors where revealing conversation existence would leak private information.

## 5. Release checklist

Private messaging must remain disabled until all items are complete:

- [ ] E2EE protocol/library selected and reviewed.
- [ ] Browser/mobile compatibility and dependency pinning verified.
- [ ] Device identity and key lifecycle implemented.
- [ ] Client-side encryption/decryption verified with published test vectors.
- [ ] Conversation membership, block enforcement, and authorization tests pass.
- [ ] Ciphertext-only transport, idempotency, rate limits, and pagination tested.
- [ ] XSS/CSP/session security review completed.
- [ ] Multi-device, lost-device, key-change, and recovery behavior documented.
- [ ] Independent security review completed.
- [ ] D1 migrations tested on a non-production database.
- [ ] Cloudflare deployment and end-to-end tests verified.
- [ ] Feature flag explicitly enabled only after founder approval.

## 6. User-facing status

Until the checklist is complete, the Messages button must show a preparation notice and must not accept private content. The current Contacts API and native phone/SMS shortcuts are separate features; they do not make FICSDavid private messaging operational.

---

# Muhtasari wa Kiswahili

Ujumbe binafsi wa FICSDavid bado haujawashwa. Database ina sehemu za kuhifadhi mazungumzo na ujumbe uliosimbwa, lakini bado hatujatekeleza mfumo wa funguo za usimbaji, usimbaji kwenye simu ya mtumaji, au ruhusa za kusoma/kutuma ujumbe.

Kabla ya huduma hii kuanza:
- Tutumie teknolojia ya E2EE iliyojaribiwa na wataalamu; hatutajitengenezea mfumo wa siri wenyewe.
- Funguo binafsi zibaki kwenye vifaa vya watumiaji.
- Kila ombi lithibitishe mtumiaji ni mwanachama halali wa mazungumzo.
- Ujumbe usihifadhiwe au kuonekana kama maandishi ya kawaida kwenye seva.
- Tufanye majaribio ya usalama na ukaguzi huru kabla ya kuwafungulia watumiaji.

**Uamuzi wa sasa:** Messages ibaki kwenye hali ya maandalizi. Usitumie taarifa za siri kwenye sehemu hiyo mpaka huduma itakapokamilika na kuthibitishwa.
