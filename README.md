# Tech Roulette

Temporary hackathon website and certificate mailer built for Vercel: React/Vite frontend, FastAPI Vercel Function, Google Forms/Sheets registrations, PostgreSQL admin and campaign state, and Brevo delivery.

## Architecture

- Google Forms writes directly to Google Sheets.
- Admin participant pages read the sheet on demand. Operational edits update optional columns in the same sheet.
- PostgreSQL stores admin users, certificate/email templates, campaigns, and delivery status—not participant registrations or personalized PDFs.
- A certificate is rendered in memory from the active template using only `participant_name` and `college_name`, attached to the Brevo request, then discarded.
- Admins select recipients and click SEND NOW. Certificates are generated during small, consecutive requests started by that click; delivery status is recorded for each recipient. An interrupted send can be resumed from Campaigns.
- There is no Celery, Redis, worker, or always-running backend process.

The PostgreSQL schema is maintained in [supabase_schema.sql](supabase_schema.sql). Participant registrations remain in Google Sheets.

## Local setup

Requirements: Node 20.19+ or 22+, Python 3.11+, and a Supabase Postgres project. Docker is not required.

1. Create or open the Supabase project.
2. Open its SQL Editor and run [supabase_schema.sql](supabase_schema.sql). For an existing database, this also adds the current `allow_resend` column while preserving campaign rows. Review any older schema differences before running the app; `CREATE TABLE IF NOT EXISTS` does not change other existing columns.
3. Set `DATABASE_URL` to the Supabase Postgres connection string in `backend/.env` for local use or in Vercel's backend environment settings for deployment.
4. Seed the initial admin from a trusted shell, then start or deploy the application.

From `backend/`:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
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

Do not commit the real URL or hardcode it in React source. For local development, set `VITE_API_URL=http://127.0.0.1:8000` in the ignored `frontend/.env.development.local`. In production, leave `VITE_API_URL` unset to call same-origin `/api` routes. Remove any `VITE_API_URL=http://127.0.0.1:8000` value from Vercel project settings; Vite embeds that value in the production bundle. A configured URL ending in `/api` is also accepted without doubling the path.

## Certificates and email

Admins can upload a PNG, JPG, or single-page PDF template and configure X/Y position, size, alignment, and color separately for participant name and college. Preview and participant downloads render on demand.

Email subjects/bodies support `{{participant_name}}` and `{{college_name}}`. Keep `EMAIL_MODE=development` for simulated sends. For real delivery set `EMAIL_MODE=production`, `BREVO_API_KEY`, and a verified `EMAIL_FROM`; `EMAIL_FROM_NAME` defaults to `Tech Roulette` and `EMAIL_REPLY_TO` is optional. The admin can override the display name and reply-to per campaign. Keep the API key in backend/Vercel server settings, never in a `VITE_` variable.

The default **Only participants not already sent** option checks successful certificate deliveries across certificate campaigns, or successful plain-email deliveries with the same campaign name. **All selected participants** still skips prior successful recipients unless the admin checks **RESEND**. Retry Failed only processes failed rows. Brevo acceptance is recorded as `SENT` with its `messageId`; a failed request is recorded as `FAILED` with a reason. A `SKIPPED` row can appear if another campaign sent to that participant after this campaign was created.

Admin selects recipients → SEND NOW → certificates are generated and emailed in foreground batches of 10. Failed deliveries can be retried from campaign details; interrupted sends can be continued there. Brevo requests use a per-attempt idempotency key. No batch runs without an admin action. Verify the first real delivery with **SEND TEST EMAIL**; its optional participant selection attaches a sample certificate.

## Verification

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
cd ..\frontend
npm run build
```

Deploy the repository root to Vercel after running [supabase_schema.sql](supabase_schema.sql) in the Supabase SQL Editor. Configure `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `FRONTEND_ORIGIN` (the deployed site origin), and `COOKIE_SECURE=true`. For real delivery, add `BREVO_API_KEY`, verified `EMAIL_FROM`, optional `EMAIL_FROM_NAME` and `EMAIL_REPLY_TO`, and `EMAIL_MODE=production`. Seed the initial admin from a trusted shell and remove the seed password.
