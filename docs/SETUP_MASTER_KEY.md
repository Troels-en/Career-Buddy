# Master-Key Setup — OAuth Token Encryption

The `app.oauth_master_key` Postgres GUC encrypts OAuth refresh
tokens (Gmail / Outlook) at rest. Generate once, set once, store
nowhere else (rotation = re-encrypt every row).

## Step 1 — generate key (or use the one ready-baked below)

```bash
openssl rand -hex 32
```

Output: 64 hex chars.

## Step 2 — apply

Supabase Dashboard → SQL Editor → New query → paste + Run:

```sql
ALTER DATABASE postgres SET app.oauth_master_key TO 'PASTE-64-CHAR-HEX-HERE';
```

Result: `Success. No rows returned.`

## Step 3 — verify

Open a fresh SQL Editor session (so the GUC is read at connect
time) and run:

```sql
SELECT length(current_setting('app.oauth_master_key', true));
```

Expected: `64` (length of the hex string).

## Rotation runbook

Master key compromise → rotate:

1. Generate new key (`openssl rand -hex 32`).
2. Re-encrypt every row in one transaction:
   ```sql
   BEGIN;
   ALTER DATABASE postgres SET app.oauth_master_key TO '<NEW>';
   -- NOTE: needs reconnect for GUC to apply — run in a new session.
   ```
3. In the NEW session:
   ```sql
   UPDATE user_email_accounts
      SET oauth_refresh_token = encrypt_oauth_token(decrypt_oauth_token(oauth_refresh_token))
    WHERE oauth_refresh_token IS NOT NULL;
   ```
   (This decrypts with the new GUC value, but the rows were
   encrypted with the old key. Two-stage rotation: decrypt with
   OLD, re-encrypt with NEW — needs a custom helper. Simpler:
   force-reauth every user by deleting the rows and have them
   reconnect via OAuth.)
4. Audit: ensure no plaintext refresh-tokens leaked into logs /
   backups / dumps during rotation.

## Storage rules

- **NEVER commit the key** to git. Not in code, not in `.env`,
  not in docs/.
- **NEVER share** via Slack / email / chat outside this trusted
  chat thread.
- **Backup** the key in a password manager (1Password / Bitwarden)
  separate from any other Career-Buddy credentials.
- **Rotate annually** OR immediately on suspected compromise.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `app.oauth_master_key not set or too short` | GUC empty or < 32 chars | Re-run Step 2 with a 64-char hex |
| `encrypt_oauth_token` permission denied | Caller isn't `service_role` | Call from edge function with service-role client, not anon |
| `decrypt_oauth_token` returns NULL | Ciphertext encrypted under different key | Re-auth the user via OAuth |
