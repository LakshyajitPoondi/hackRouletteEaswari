# Google Forms and Google Sheets setup

Google Forms writes registrations directly to its linked response spreadsheet. Tech Roulette reads that spreadsheet at request time; it does not copy registration rows into PostgreSQL.

1. Create a Google Cloud service account and enable the Google Sheets API.
2. Share the response spreadsheet with the service account's `client_email` as Editor. Editor access is needed only if attendance, eligibility, disqualification, or notes are changed in the admin UI.
3. Set `GOOGLE_SHEETS_SPREADSHEET_ID` to the value between `/d/` and `/edit` in the spreadsheet URL.
4. Set `GOOGLE_SHEETS_RANGE` (normally `Form Responses 1!A:Z`).
5. Put the complete service-account JSON object in `GOOGLE_SERVICE_ACCOUNT_JSON` as a single environment value.

The sheet must include `Full Name` (or `Name`) and `Email Address` (or `Email`). `College Name`/`College`, phone, department, year, team, and timestamp are discovered by common header names. If the admin changes operational fields, the app uses or creates these columns: `Attendance Status`, `Certificate Eligible`, `Disqualified`, and `Admin Notes`.

For a read-only public spreadsheet, `GOOGLE_SHEETS_API_KEY` can be used instead of service-account JSON. This is not recommended for participant personally identifiable information.
