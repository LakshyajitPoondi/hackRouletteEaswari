# Tech Roulette

Temporary hackathon website and certificate mailer built for Vercel: React/Vite frontend, FastAPI Vercel Function, Google Forms/Sheets registrations, PostgreSQL admin and campaign state, and Resend delivery.

## Architecture

- Google Forms writes directly to Google Sheets.
- Admin participant pages read the sheet on demand. Operational edits update optional columns in the same sheet.
- PostgreSQL stores admin users, certificate/email templates, campaigns, and delivery status—not participant registrations or personalized PDFs.
- A certificate is rendered in memory from the active template using only `participant_name` and `college_name`, attached to the Resend request, then discarded.
- Admins select recipients and click SEND NOW. Certificates are generated and emailed in that request; delivery status is recorded for each recipient.
- There is no Celery, Redis, worker, or always-running backend process.

Historical participant/certificate migrations remain in the Alembic chain so existing deployments can upgrade safely; the latest migration removes those obsolete tables after preserving delivery snapshots.

## Local setup

Requirements: Node 20.19+ or 22+, Python 3.11+, and a managed PostgreSQL database such as Supabase. Docker is not required.

From `backend/`:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
alembic upgrade head
python -m app.db.seed
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Set `DATABASE_URL`, a 32+ character `JWT_SECRET`, `FRONTEND_ORIGIN`, the Google Sheets settings described in [docs/google-sheets.md](docs/google-sheets.md), and initial-admin values before seeding. Passwords use Argon2 and sessions use an HttpOnly JWT cookie.

The initial admin password is configured through `INITIAL_ADMIN_PASSWORD` (the setup default is `roulette@123`) and is never exposed to the frontend. To apply the configured password to an already-seeded initial admin, run `python -m app.db.seed --reset-existing` from `backend/`; the reset is hashed through the same Argon2 flow as user creation.

From `frontend/`:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

`VITE_GOOGLE_FORM_URL` controls the public registration link. Copy `frontend/.env.example` to the Git-ignored `frontend/.env` for local development, then set the real Google Form URL there:

```env
VITE_GOOGLE_FORM_URL=https://forms.gle/...
```

Do not commit the real URL or hardcode it in React source. `VITE_API_URL` defaults to `http://127.0.0.1:8000` in development and same-origin `/api` in production.

## Certificates and email

Admins can upload a PNG, JPG, or single-page PDF template and configure X/Y position, size, alignment, and color separately for participant name and college. Preview and participant downloads render on demand.

Email subjects/bodies support `{{participant_name}}` and `{{college_name}}`. Keep `EMAIL_MODE=development` for simulated sends. For real delivery set `EMAIL_MODE=production`, `RESEND_API_KEY`, and a verified `EMAIL_FROM_ADDRESS`; `EMAIL_REPLY_TO` is optional. Sent delivery records are skipped in later campaigns unless the request explicitly sets `resend`.

Admin selects recipients → SEND NOW → certificates are generated and emailed immediately. Failed deliveries can be retried from the campaign details. The request processes all selected recipients synchronously, so choose a recipient group that fits within the Vercel Function duration configured in `vercel.json`. Each delivery uses an idempotency key.

## Verification

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
cd ..\frontend
npm run build
```

Deploy the repository root to Vercel. Run `alembic upgrade head` against the deployment database first, then seed the initial admin from a trusted shell and remove the seed password.
