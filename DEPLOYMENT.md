# Deployment & abuse-protection notes

Target: a VPS / Railway / Render instance with a **persistent disk**. SQLite and
uploaded files both need storage that survives restarts. This will **not** work on
Vercel or any read-only / ephemeral filesystem without first moving to Postgres
and object storage.

See [Railway walkthrough](#0-railway-walkthrough) for step-by-step deployment.

---

## 0. Railway walkthrough

### Why a volume is mandatory

Railway containers have an ephemeral filesystem: anything written outside a
mounted volume is destroyed on every redeploy and every restart. Two things here
write to disk — the SQLite database and uploaded documents — so **both must live
on the volume**, or you will lose all participant accounts and data the first
time you push a change.

### Steps

**1. Create the service**

New Project → Deploy from GitHub repo → pick this repository. The first build
will fail or the app will misbehave until the variables below are set; that is
expected.

**2. Add a volume**

Service → Settings → Volumes → **Add volume**, mount path `/data`. Size 1GB is
ample for a 20–50 participant study.

**3. Set the start command**

Service → Settings → Deploy → Custom Start Command:

```
npm run start:prod
```

This runs `prisma db push` before `next start`. A fresh volume has no database
file, so something has to create the schema on first boot; `db push` is
idempotent, so it is a no-op on subsequent deploys.

**4. Set environment variables**

Service → Variables. Everything in §1 and §2 below, plus these two, which are the
Railway-specific part:

```bash
DATABASE_URL="file:/data/prod.db"   # absolute, on the volume
UPLOAD_DIR="/data/uploads"          # absolute, on the volume
```

> **Use an absolute `DATABASE_URL`.** A relative path is resolved differently by
> the app (`src/lib/prisma.ts`) than by the Prisma CLI (`prisma.config.ts`) — you
> would end up with `db push` migrating one file while the app reads another.
> An absolute path is treated identically by both. The app logs a warning at
> startup in production if you get this wrong.

**5. Generate a domain, then fix `NEXTAUTH_URL`**

Settings → Networking → Generate Domain. Copy the resulting URL and set:

```bash
NEXTAUTH_URL="https://your-app.up.railway.app"
```

This is a chicken-and-egg step: the domain does not exist until after the first
deploy. If `NEXTAUTH_URL` does not exactly match the public URL, sign-in appears
to succeed and then bounces straight back to the login page. Redeploy after
setting it.

**6. Verify**

```bash
curl -I https://your-app.up.railway.app/          # 200
curl -I https://your-app.up.railway.app/dashboard # 307 redirect to /login
```

Then sign up through the UI with your `PARTICIPANT_ACCESS_CODE`, and confirm the
account still exists after triggering a redeploy — that is the real test that the
volume is wired up correctly.

### Things worth knowing

- **`postinstall` runs `prisma generate`.** Railway installs with `npm ci`, which
  does not generate the Prisma client on its own.
- **`better-sqlite3` is a native module** and compiles during install. Node is
  pinned to `>=20 <23` in `engines` so a Railway Node bump can't produce an ABI
  mismatch. Set the `NODE_VERSION` variable if you need to be explicit.
- **Do not run more than one replica.** SQLite is a single-writer file database,
  and the signup/login IP throttle (`src/lib/ipRateLimit.ts`) keeps its counters
  in process memory. Both assume one instance.
- **Back up the database.** `railway run cp /data/prod.db ./backup.db`, or read it
  out via `railway ssh`. For a thesis this is your primary research data — take a
  copy before any risky change, and again at the end of the study.
- **The repo has `prisma/dev.db` committed.** It is not used in production (the
  volume path overrides it), but it contains local test accounts and password
  hashes. Consider `git rm --cached prisma/dev.db` and adding it to
  `.gitignore` before making the repo public for submission.

---

## 1. Required environment variables

```bash
# ── Core ────────────────────────────────────────────────────────────────────
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="https://your-domain.example"   # must be the real public URL
NEXTAUTH_SECRET="<openssl rand -base64 32>"  # the middleware verifies JWTs with this

# ── Registration gate (REQUIRED — signup fails closed without it) ───────────
PARTICIPANT_ACCESS_CODE="<code you hand to participants>"
MAX_ACCOUNTS=60                              # hard ceiling on total accounts

# ── LLM providers ───────────────────────────────────────────────────────────
GEMINI_API_KEY=...                           # primary
OPENAI_API_KEY=...                           # first fallback
ANTHROPIC_API_KEY=...                        # second fallback

# ── Trello (shared researcher account) ──────────────────────────────────────
TRELLO_API_KEY=...
TRELLO_TOKEN=...

# ── Admin dashboard (optional — bootstrap only) ──────────────────────────────
ADMIN_EMAILS="you@example.com"               # comma-separated; promoted on first sign-in
```

`PARTICIPANT_ACCESS_CODE` has no default **on purpose**. If it is unset, every
signup is rejected with a 503 rather than silently allowing open registration.

### Getting admin access

The admin dashboard lives at `/dashboard/admin` and is only linked in the sidebar
for admins. Two ways to become one:

```bash
# Local, or anywhere you have a shell:
npm run db:make-admin -- you@example.com
npm run db:make-admin                        # no argument: list current admins

# Container deployments with no shell: set ADMIN_EMAILS and sign in once.
# The role is written to the database on that first check, after which the env
# var can be removed.
```

Sign up through the normal participant flow first — the script promotes an
existing account, it does not create one. The role is always read from the
database, never from the session cookie, so a promotion takes effect on the next
request without signing out.

## 2. Usage limits (all optional, all have defaults)

Tune these on the server without a code change. Defaults are sized for 20–50
participants.

| Variable | Default | Meaning |
|---|---|---|
| `CHAT_DAILY_LIMIT` | 10 | Chat messages per user per UTC day |
| `CHAT_LIFETIME_LIMIT` | 50 | Chat messages per user for the whole study |
| `DOCUMENT_DAILY_LIMIT` | 3 | Document uploads per user per day |
| `DOCUMENT_LIFETIME_LIMIT` | 10 | Document uploads per user for the study |
| `EXPORT_DAILY_LIMIT` | 5 | AI exports (SRS + Trello) per user per day |
| `EXPORT_LIFETIME_LIMIT` | 20 | AI exports per user for the study |
| `USER_TOTAL_LLM_CALL_LIMIT` | 90 | **Per-user ceiling across all kinds** |
| `GLOBAL_DAILY_LLM_CALL_LIMIT` | 500 | **Deployment-wide daily ceiling.** 0 disables |
| `LLM_DISABLED` | — | Set to `true` as an emergency kill switch |

Setting any daily limit to `0` disables that feature outright.

### Emergency stop

```bash
LLM_DISABLED=true   # restart; every AI endpoint returns 429, no provider is called
```

### Cutting off one participant

Use **Manage → Deactivate account** on `/dashboard/admin`. It records who
deactivated the account, when, and why, and takes effect on the participant's very
next request — their existing session is not honoured, because `requireAuth()` and
the dashboard layout both re-read `blocked` from the database rather than trusting
the JWT. Their data is kept; deactivation is a flag, not a delete.

The same dialog can restore a participant's daily allowance or reset their whole
study allowance, which is the usual answer to "I ran out halfway through the task".

The equivalent by hand, if you only have database access:

```sql
UPDATE users SET blocked = 1 WHERE email = 'someone@example.com';
```

---

## 3. How spend is bounded

Four independent layers. All of them are checked **before** any provider call, so
a rejected request costs nothing.

1. **Registration gate** — access code + `MAX_ACCOUNTS`. Without this, per-user
   limits are meaningless because anyone can register again to reset them.
2. **Per-user quotas** — per-kind daily and lifetime counters, plus a
   kind-agnostic `USER_TOTAL_LLM_CALL_LIMIT` so one account can't spread its
   spend across chat / documents / exports to exceed the intended total.
3. **Deployment-wide daily ceiling** — `GLOBAL_DAILY_LLM_CALL_LIMIT`. The
   backstop if many accounts are somehow created.
4. **Per-request input and output caps** — see `src/lib/limits.ts`. Quotas bound
   *how many* calls happen; these bound *what one call can cost*. Without them a
   single request counting as "one chat" could carry a multi-megabyte prompt.

Counters are consumed with single atomic conditional `UPDATE` statements, so two
concurrent requests can't both pass the same check.

### Seeing what was actually spent

The four layers above bound the *number* of calls. They say nothing about cost, so
every provider request also appends a row to `llm_usage` with the token counts the
provider reported and an indicative USD figure (`src/lib/tokenUsage.ts`). That is
what the admin dashboard's token and cost figures come from, and what
`/api/admin/export` writes to CSV for the write-up.

Two things to know when reading those numbers:

- **Failed attempts are included**, marked `success = false`. A provider that
  errors after reading the prompt has still spent input tokens, and one metered
  "call" can make up to three provider requests as it falls down the chain — so
  `provider_requests` is legitimately higher than `llm_calls_total`.
- **The prices are hardcoded list prices** for the three pinned models. They are
  indicative, not billing data; update the `PRICING` table if a model or its price
  changes. Metering started when this table was added, so accounts that were
  active before then show quota consumed and no tokens — the dashboard says so
  rather than implying they spent nothing.

### The expensive path to know about

`extractTextFromPDF` throws by design, which means **every PDF upload sends the
whole document to a multimodal model**. That is the costliest operation in the
app. It is now gated three ways: the document quota, a 5MB upload limit, and a
separate 2MB ceiling (`MAX_PDF_BYTES_FOR_LLM`) above which the PDF is refused for
analysis rather than sent. Encourage participants to upload `.docx` or `.txt`,
which are extracted locally at no token cost.

---

## 4. Build note — do not re-add `--turbopack`

`package.json`'s `build` script deliberately uses plain `next build`.

Turbopack in Next 15.5.4 **silently discards `config.matcher` in middleware** and
compiles it to `/:path*`. With the previous `next-auth/middleware` re-export that
made the auth guard run on every route including `/login`, which redirected to
the sign-in page — nobody could sign in. `src/middleware.ts` no longer depends on
the matcher for correctness (it checks paths in code), but the production build
should still use the bundler that honours it.

`next dev --turbopack` is fine.

---

## 5. Pre-deploy checklist

- [ ] `NEXTAUTH_SECRET` set to a fresh random value (not the development one).
- [ ] `NEXTAUTH_URL` set to the real public HTTPS URL.
- [ ] `PARTICIPANT_ACCESS_CODE` set, and the code distributed to participants.
- [ ] `npx prisma db push` run against the production database.
- [ ] **Start from a clean database.** `prisma/dev.db` is currently committed to
      git and contains real accounts with password hashes — see below.
- [ ] `uploads/` on persistent storage, and backed up or periodically pruned
      (it grows with every upload and is never cleaned automatically).
- [ ] Reverse proxy sets `X-Forwarded-For`, otherwise the signup and sign-in
      IP throttles see every request as one client.
- [ ] Provider spend alerts configured in the Google / OpenAI / Anthropic
      consoles. The limits here bound request *count*, not currency.

### `prisma/dev.db` is tracked in git

It contains participant accounts and bcrypt password hashes. For a thesis with
human participants that is worth fixing before pushing anywhere public:

```bash
git rm --cached prisma/dev.db
echo "prisma/*.db" >> .gitignore
echo "uploads/" >> .gitignore
git commit -m "Stop tracking the local database and uploads"
```

Note this only stops *future* commits — the file is still in history. If the
repository has already been pushed somewhere others can read, the history needs
rewriting (`git filter-repo`) or the passwords rotating.

---

## 6. Known limitations

- **The IP throttles are in-process** (`src/lib/ipRateLimit.ts`). They reset on
  restart and are not shared between instances. Fine for one VPS process; if the
  app is ever run with more than one instance, this needs to move to the database.
- **The global daily counter is checked before and incremented after** the
  per-user consume, so under heavy concurrency it can overshoot the ceiling by
  roughly the number of in-flight requests. It is a budget backstop, not an
  accounting ledger.
- **A failing provider still costs tokens.** `analyzeDocument` and the chat route
  fall through Gemini → GPT → Claude, and an attempt that errors after sending
  its prompt has already been billed. One request can therefore cost up to three
  calls' worth of input tokens.
- **Uploaded files are never deleted**, including when the parent project is
  deleted (the database row cascades, the file on disk does not).
