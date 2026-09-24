# Current architecture

The Vite SPA and FastAPI Vercel Function share one Vercel project. FastAPI is stateless between requests except for PostgreSQL records.

Google Sheets is the participant source of truth. `services/google_sheets.py` maps form headers, supplies participant lists, and writes the optional operations columns used by the existing admin UI. PostgreSQL is limited to authentication/RBAC, template assets, campaign definitions, and immutable delivery snapshots/status.

The current PostgreSQL schema is defined in `supabase_schema.sql` and applied through the Supabase SQL Editor. Participant registrations and personalized certificate PDFs are not stored in PostgreSQL.

The certificate template contains all static artwork and wording. `services/certificates.py` overlays participant name and college into a one-page PDF in memory. Campaign processing builds that PDF immediately before the Brevo call and does not persist it.

Admin selects recipients → SEND NOW → certificates are generated and emailed immediately. The same synchronous processor handles explicit retry of failed deliveries. Database row locking, a unique campaign/participant key, scoped sent-history checks, and Brevo idempotency keys prevent accidental duplicates. The admin should choose a recipient group that fits within the Vercel Function duration. No queue broker or persistent worker is required.
