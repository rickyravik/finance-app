# Local security checklist

- Keep `.env.local` and `data/` private and off Git/cloud sharing. These are excluded by `.gitignore`.
- Use a long random APP_ACCESS_KEY; no key means no API access. The key stays in browser memory. Lock or close the browser session after use.
- Keep Starling token in server environment, read-only scopes only; revoke it at the provider. The app does not persist it in the ledger or send it to Ollama.
- Run only on `127.0.0.1`. No remote hosting, payment initiation or bank usernames/passwords.
- Protect your Windows profile, use device encryption and encrypt backups. SQLite and `.env.local` are plaintext on disk; app-level encrypted storage is a later milestone.
- Keep downloaded Ollama models local; disable Ollama cloud features independently. Questions and aggregate evidence are visible to the local model. Do not paste tokens into questions.
- API responses never echo credentials, raw bank response bodies or SQL exceptions. Audit records contain action/count only.
- Before making this multi-user or network-accessible, add proper sessions, expiry/rotation, encrypted secret storage, CSRF protections tied to sessions, nonce CSP, rate limits and ownership-scoped queries. The current access key is a local MVP gate.
- No live bank call or real finance import was executed during development. Test fixtures are synthetic.
