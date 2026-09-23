# Current architecture

The Vite SPA and FastAPI Vercel Function share one Vercel project. FastAPI is stateless between requests except for PostgreSQL records.

Google Sheets is the participant source of truth. `services/google_sheets.py` maps form headers, supplies participant lists, and writes the optional operations columns used by the existing admin UI. PostgreSQL is limited to authentication/RBAC, template assets, campaign definitions, and immutable delivery snapshots/status.

The Alembic history retains the old participant-table migrations for upgrade continuity. The current head drops those tables after delivery rows have been converted to self-contained participant snapshots.

The certificate template contains all static artwork and wording. `services/certificates.py` overlays participant name and college into a one-page PDF in memory. Campaign processing builds that PDF immediately before the Resend call and does not persist it.

Send-now and the protected cron route both call the same bounded synchronous processor. Database row locking, a unique campaign/participant key, global sent-history checks, and Resend idempotency keys prevent accidental duplicates. No queue broker or persistent worker is required.
