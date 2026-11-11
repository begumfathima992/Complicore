# HR & Sponsor Compliance Management System — Backend (Steps 1–14, complete)

Covers every module from the original spec: architecture scaffold, RBAC,
employee database, right-to-work management, change-of-circumstances audit
trail, document management, duty roster, holiday management, sick
leave/absence, granular role/permission management, a central alert engine,
a compliance dashboard, a full reporting/export system, and a tamper-evident
audit log.

## Setup

```bash
npm install
cp .env.example .env      # then fill in DB credentials + JWT secrets
createdb hrms_compliance  # or equivalent in your Postgres client
npm run db:sync           # creates all tables from the models
npm run db:seed           # seeds the 5 roles + a Super Admin login
npm run dev                # starts the API on http://localhost:4000
```

Seeded login: `superadmin@example.com` / `ChangeMe123!` — change immediately.

## What's implemented

- **Architecture**: `src/config`, `src/models`, `src/middleware`,
  `src/controllers`, `src/routes` — a layered Express + Sequelize (Postgres)
  API, multi-tenant (`Company`) so one platform instance can serve many
  sponsor employers, with Super Admin operating across all of them.
- **RBAC** (`src/config/permissions.js`): the exact feature × role matrix you
  specified (Employees, Right-to-work, Documents, Holiday, Sick Leave, Duty
  Roster, Reports, Audit Logs, Role Management), each cell mapped to an
  access level (`full/limited/view/own/approve/request/none`).
  `middleware/authorize.js` turns a role + access level into a concrete
  query scope (all companies / my company / my direct reports / just me),
  so a Manager listing `/api/employees` automatically only sees their team,
  and an Employee only ever sees themself.
- **Employee database** (`src/models`): `Employee` (personal + employment
  fields), `ImmigrationDetail` (right-to-work/visa/sponsorship — gated
  separately by the Right-to-work permission, so a Manager can see an
  employee's job title but not their visa status), `EmergencyContact`,
  `Department`, `Company`, `Role`, `User` (auth identity, bcrypt-hashed
  password, JWT access + refresh tokens).

- **Right to work** (`src/models/RightToWorkCheck.js`, `src/services/alertService.js`):
  a log of checks per employee (not a single status field, since anyone with
  time-limited permission needs repeat follow-up checks). `status` is always
  set by the person performing the check - never inferred from dates; dates
  only drive Alert records (see module 11 below), and an alert firing is
  never treated as proof of compliance - HR still has to perform and record
  the actual check.
- **Change of circumstances** (`src/models/ChangeOfCircumstance.js`):
  append-only audit log (old value / new value / effective date / changed by
  / reason / supporting document). No update or delete route exists for it
  on purpose - once written, an entry cannot be edited.
- **Documents** (`src/models/Document.js`): metadata registry over object
  storage (`fileUrl` is wherever the file actually lives, e.g. an S3 key -
  this API doesn't handle the upload bytes). Re-uploading a document of the
  same type for an employee creates a new version and marks the previous one
  `isCurrent: false` instead of overwriting it, so old evidence is never
  lost. Status/expiry edits are HR-only - an employee can upload their own
  documents but can't self-certify their status.
- Endpoints added: `/api/right-to-work-checks`, `/api/documents`,
  `/api/change-of-circumstances`.

- **Duty roster** (`src/models/Shift.js`, `src/services/rosterService.js`):
  shifts are stored with derived `startsAt`/`endsAt` timestamps (handling
  overnight shifts like 16:00-00:00 correctly) alongside display-friendly
  `shiftDate`/`startTime`/`endTime`. Creating or editing a shift runs
  `detectConflicts()` - overlapping shifts, approved holiday, or an open
  absence on that date - and returns `409` with the conflict list unless
  `?force=true`. Employees only ever see their own *published* shifts
  (drafts stay manager-only) even though Manager/HR access is company-wide,
  per your example of a shared team roster. `ShiftChangeRequest` handles
  swap/time-change/cancellation requests; a manager's approval is what
  actually mutates the shift. `GET /api/shifts/availability?date=` and
  `GET /api/shifts/export` (CSV) round out the module.
- **Holiday management** (`src/models/HolidayRequest.js`,
  `src/services/holidayService.js`): implements the exact pipeline -
  `pending_manager` → `pending_hr` → `approved`, with a distinct permission
  gate at each stage (`approve` for the manager step, the higher `update`
  for HR confirmation, so a Manager literally cannot also perform the HR
  sign-off). The dashboard numbers (allowance/used/pending/remaining) are
  computed from `HolidayRequest` rows on read rather than stored, so they
  can never drift out of sync. "Calendar Updated" is realised by the roster
  conflict checker reading approved requests directly.
- **Sick leave / absence** (`src/models/Absence.js`): covers Sickness,
  Unauthorised, Family Leave, Other, and Long-term Absence (Holiday is
  rejected here with a pointer to the Holiday module, since it has its own
  workflow/balance). `reasonCategory` is a closed set of operational
  categories (illness/injury/mental health/appointment/bereavement/other) -
  deliberately not a diagnosis field - and `notes` is documented as
  logistics-only, per "don't collect more medical information than the
  organisation actually needs."
- **Role management** (`src/config/permissionKeys.js`,
  `src/models/RolePermissionRestriction.js`,
  `src/services/permissionService.js`): materialises the access-level
  matrix into the granular permission strings from your example
  (`employee.view`, `documents.upload`, `holiday.approve`,
  `compliance.manage`, ...) via `GET /api/roles` /
  `GET /api/roles/:roleKey/permissions`. `PATCH /api/roles/:roleKey/permissions`
  lets a company admin **revoke** a specific permission from a role within
  their company - deny-only, so a tenant can narrow a role but never grant
  it something outside the platform's built-in ceiling, and a role can only
  manage roles strictly below its own seniority. `middleware/authorize.js`
  actually enforces these restrictions on every request, not just displays
  them - this is the "safer than `user.role === 'admin'`" piece.
- Endpoints added: `/api/shifts` (+ `/availability`, `/export`,
  `/change-requests`), `/api/holiday` (`/balance`, `/requests`,
  `/requests/:id/manager-approve`, `/requests/:id/hr-confirm`,
  `/requests/:id/cancel`), `/api/absences` (+ `/:id/approve`), `/api/roles`.

- **Alert engine** (`src/models/Alert.js`, `src/services/alertService.js`):
  one table covers every alert type in the spec (right-to-work/visa/
  document/training expiry, missing document, holiday/sick-leave requests
  needing review, absence threshold, probation ending, contract ending, and
  ad-hoc `compliance_task` alerts HR raises directly via `POST /api/alerts`).
  Severity is `info/low/medium/high/critical`; expiry-driven alerts use a
  configurable day-threshold classifier (right-to-work is stricter than a
  training certificate, for example) and auto-resolve once a later-dated
  record supersedes them - never because time alone passed. `sourceId` is a
  plain string, not a UUID FK, since composite per-employee alerts (missing
  document, probation/contract ending, absence threshold) key by
  `<employeeId>:<type>` so each sub-case gets its own row. `npm run
  alerts:sync` runs the full sweep; it also fires automatically after every
  right-to-work/document write.
- **Compliance dashboard** (`src/services/dashboardService.js`,
  `GET /api/dashboard/compliance`): the tile numbers from your mockup, plus
  an `internalComplianceScore`. Per your instruction, every response also
  carries a `disclaimer` field spelling out that this is an internal
  management indicator only, not an official Home Office rating - so no
  frontend built on this API can present it as one without deliberately
  dropping that field.
- **Reporting system** (`src/services/reportService.js`,
  `src/services/exportService.js`): all 19 reports from your list, registered
  by key with `GET /api/reports` (available list) and `GET
  /api/reports/:reportKey?format=json|csv|excel|pdf` plus filters (`from`,
  `to`, `departmentId`, `employeeId`, `status`, `location`, `managerId`).
  CSV/Excel (`exceljs`)/PDF (`pdfkit`) all stream from the same
  `{columns, rows}` shape a report generator returns, so adding a new report
  never touches the export code. Nationality lives on `ImmigrationDetail`,
  not `Employee` (see that model's comment), and the `nationality` report
  additionally requires the `right_to_work.view` permission key on top of
  ordinary Reports access - "only where legitimately needed" is enforced,
  not just a docstring.
- **Full audit log** (`src/models/AuditLog.js`, `src/services/auditService.js`):
  WHO (`performedByUserId`/`performedByRoleKey`) / WHAT (`entityType`,
  `fieldName`, `oldValue`, `newValue`) / WHEN (`createdAt`) / WHERE
  (`ipAddress`, `userAgent`) / OLD / NEW, one row per changed field.
  Instrumented on Employee, RightToWorkCheck, Document, HolidayRequest,
  Absence, and RolePermissionRestriction writes. Tamper-resistance has two
  layers: every row is chained to the previous one via a SHA-256 hash
  (`GET /api/audit-logs/verify` recomputes the whole chain and reports
  exactly where it breaks), and no update/delete route exists for this
  model at all - entries only ever get created through
  `services/auditService.js`. `scripts/lockAuditLog.sql` documents the
  production hardening step (REVOKE UPDATE/DELETE from the app's DB role)
  that makes tampering impossible even for a compromised app process, not
  just detectable.
- Endpoints added: `/api/alerts` (+ `POST` to raise one, `/sync`,
  `/:id/acknowledge`, `/:id/resolve`), `/api/dashboard/compliance`,
  `/api/reports` (+ `/:reportKey`), `/api/audit-logs` (+ `/:id`, `/verify`).

## Try it

```bash
curl -X POST localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"superadmin@example.com","password":"ChangeMe123!"}'

curl localhost:4000/api/employees \
  -H "Authorization: Bearer <accessToken>"
```

## EU Settlement Scheme status + Next of Kin (added post-launch)

Two gaps closed after the initial build:

- **EU Settlement Scheme status**: `ImmigrationDetail.settlementStatus`
  (`settled` / `pre_settled` / `not_applicable`, default `not_applicable`) -
  a distinct UK immigration category from general right-to-work status.
  Editable via `GET`/`PATCH /api/right-to-work-checks/immigration-detail/:employeeId`,
  gated by the same `RIGHT_TO_WORK` permission as the rest of that module
  (Manager: view-only, HR/Employer/Super: can edit) - the frontend's
  `ImmigrationDetailEditor` lives on the Right to Work page, not the general
  Employee edit form, because it needs that stricter gate. Reportable via
  a dedicated `settlement_status` report and as a column on
  `visa_monitoring`, both gated by the `right_to_work.view` permission key
  like the existing `nationality` report.
- **Next of Kin / Emergency Contacts**: `EmergencyContact` (built in Step 3
  but never wired up) now has a full controller/routes
  (`/api/emergency-contacts`) and a UI section on the Employee detail page.
  Decision: an employee gets full self-service CRUD on their own next-of-kin
  entries (a new `self_full` access level - read/create/update/delete,
  scoped to self, with no audit/versioning need since this isn't compliance
  data) rather than this being HR-only, mirroring the existing "employee
  edits own contact fields" pattern. HR/Employer/Super get full CRUD across
  their company; Manager gets create/read/update but not delete.

**A critical authorization bug was found and fixed while testing this
work.** `{ ...scopeToEmployeeWhere(scope), id: targetId }` - used in
`employeeController.js` since Step 1, and copied into several controllers
added since - is broken: `scopeToEmployeeWhere('own')` returns `{ id:
callerEmployeeId }`, and the literal `id: targetId` in the same object
literal silently overwrites it (last key wins), rather than constraining
it further. In practice this meant an `EMPLOYEE`-role user could view,
edit, or (depending on the endpoint) act on **any other employee's
record** simply by changing the `:id` in the URL - the scope check was a
no-op whenever it needed to intersect with a caller-supplied id. It was
never caught earlier because every prior live test happened to use an
employee's own id. Live-testing the next-of-kin feature (Eddie
successfully creating a contact on Olga's record) surfaced it. Fixed by
adding `scopeToEmployeeWhereById(scope, targetId)` (uses `Op.and` instead
of object-spread) in `utils/scopeToWhere.js` and switching every call site
- 13 in total across `employeeController`, `documentController`,
`holidayController`, `rightToWorkController`, `shiftController`,
`alertController`, `changeOfCircumstanceController`, and
`emergencyContactController` - to use it. Re-verified live afterward: the
exact cross-employee attack that succeeded before now correctly 404s, and
an employee viewing/editing their own record still works.

## Multi-tenant SaaS: company/user management + cross-tenant isolation

The product is sold as multi-tenant SaaS - each `Company` is a separate
customer (tenant). Onboarding is sales-assisted, not public self-signup:
only Super Admin creates a company.

- **Company management** (`companyController.js`, `/api/companies`): Super
  Admin creates/lists/updates any company. Employer Admin can view/update
  only their own (`FEATURES.COMPANIES` uses `OWN`'s action set - read+update,
  no create - though the scoping itself is bespoke `req.user.companyId`
  logic, not the generic employee-scope machinery, since a Company isn't
  employee-scoped at all). HR Manager gets view-only. A non-Super-Admin
  hitting another company's id gets a **404, not 403** - confirming even
  the existence of another tenant is exactly what "never see or list other
  companies" rules out. `isActive` is excluded from tenant-editable fields;
  only Super Admin can toggle a company's own active status.
- **User management** (`userController.js`, `/api/users`): Super Admin
  manages users in any company (must specify `companyId` - they have none
  of their own); Employer Admin and HR Manager manage users within their
  own company only (decision: HR Manager included, since account
  provisioning is routine HR work, and `canManageRole()` - reused as-is
  from Role Management - already stops HR Manager from creating/editing
  anyone at or above their own seniority). New users get a random temporary
  password (`utils/generatePassword.js`), returned once in the create
  response - no email-sending flow yet.
- **Password self-service**: `POST /api/auth/change-password` - any
  authenticated user, any role, changes their own password given their
  current one.
- **Cross-tenant isolation test suite**: a second tenant ("Rival Sponsor
  Inc", with its own Employer Admin/HR Manager/Employee and real records
  across every module) was seeded, then Company A's Employer Admin and HR
  Manager were run against **every module** using Company B's real record
  ids - direct fetches, writes, list endpoints with no explicit filter, all
  20 reports, the audit log, companies, and users. 60 direct-access checks
  and 68 no-leak checks, all passing (404/403, or empty/scoped results)
  - full matrix is in the session transcript, not reproduced here since
  it's a one-time verification artifact, not living documentation.

**Two real bugs were found and fixed via this testing, not by code review:**

1. **`sponsorType` 500 on company create/update.** It's a Postgres ENUM
   (`A-rated`/`B-rated`, nullable); the frontend's unselected `<select>`
   sends `''`, which Postgres rejects outright (neither a valid enum value
   nor `NULL`). Fixed by normalizing `''` to `null` in
   `companyController.js` before every `Company.create`/`.update()` call.
2. **`GET /api/audit-logs/verify` had no tenant boundary at all.** The hash
   chain is a single global sequence across every tenant (by original
   design - see `auditService.js`), but the endpoint was open to any
   EMPLOYER_ADMIN/HR_MANAGER, who would then learn the *platform-wide* row
   count and, if the chain were ever broken, another tenant's row id. This
   wasn't caught by the direct-access/leak-checks above (which target
   specific *content*, and today's one broken row happens to belong to
   Company A) - it surfaced from asking "does this endpoint have any
   per-company boundary at all," which it didn't. Fixed by restricting
   `checkIntegrity()` to Super Admin only (a true per-company sub-chain
   would need a deeper redesign - noted as a follow-up, not attempted here).
   `listAuditLogs`/`getAuditLog` were already correctly company-scoped and
   are unaffected.

## Note on schema changes in this module (historical - superseded below)

This note described `npm run db:sync` (Sequelize `alter: true`) as the only
way to apply schema changes, with no real migrations system. That's no
longer true - see **Production deployment** below for the versioned
`sequelize-cli` migrations now used for Neon/production. `db:sync`/`db:seed`
remain as the quick local-dev path (plain discrete `DB_*` vars, no
`DATABASE_URL`/`DIRECT_URL` set) and are guarded against accidentally
targeting Neon.

## Production deployment (Render + Neon + Cloudflare R2)

### Environment variables

All variables are documented with placeholder values in `.env.example`
(backend) and `frontend/.env.example`. Nothing here is a real secret - fill
these in via Render's dashboard, never commit a filled-in `.env`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string - used by the running app |
| `DIRECT_URL` | Neon **unpooled** connection string - used only for running migrations |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing secrets (two, not one - there's no single `JWT_SECRET` in this app) |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Token lifetimes, e.g. `15m` / `7d` |
| `SITE_ORIGIN` | The deployed frontend's origin - restricts CORS to it in production |
| `R2_ENDPOINT` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` | Cloudflare R2 (S3-compatible) object storage for documents |
| `RESEND_API_KEY` / `MAIL_FROM` | Daily expiry-alert digest emails (Resend) - leave `RESEND_API_KEY` empty to disable sending (nothing is marked as sent, so emails resume cleanly once set) |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | Used once by `npm run db:seed:prod` to create the one production Super Admin |
| `VITE_API_URL` (frontend) | The deployed API's base URL, e.g. `https://hrms-api.onrender.com/api` |

### Migrations

`npm run migrate` (`sequelize-cli db:migrate`) runs every migration in
`migrations/` against `DIRECT_URL`. This is wired as part of `hrms-api`'s
Render build command (see `render.yaml`), so every deploy applies any new
migrations before the new code starts serving traffic. Migrations are
written from the already-associated Sequelize models (`migrations/_helpers/fromModel.js`)
so the schema has one source of truth, with defensive `describeTable()`
checks wherever a later migration alters a column an earlier one might
already have created correctly.

### Cloudflare R2 bucket CORS

The frontend uploads/downloads documents via pre-signed URLs issued by the
API, but the browser still talks directly to R2 for the actual bytes - so
the bucket needs a CORS policy allowing your frontend's origin. Apply this
in the Cloudflare dashboard (R2 → your bucket → Settings → CORS Policy →
Add CORS policy) or via `aws s3api put-bucket-cors` against the R2
S3-compatible endpoint:

```json
[
  {
    "AllowedOrigins": ["https://hrms-web.onrender.com"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Replace `AllowedOrigins` with your actual `SITE_ORIGIN` (add
`http://localhost:5173` too if you also want local dev to upload directly
against the same bucket).

### Render entry checklist

1. Push this repo to GitHub/GitLab and create a Render **Blueprint** from
   `render.yaml` (or create the two services manually using it as a
   reference).
2. On `hrms-api`, fill in every `sync: false` env var in `render.yaml`
   (Neon `DATABASE_URL`/`DIRECT_URL`, JWT secrets, R2 credentials, Resend
   key, `SITE_ORIGIN`, `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD`).
3. On `hrms-web`, set `VITE_API_URL` to `hrms-api`'s public URL + `/api`.
4. Deploy `hrms-api` first - the build step runs migrations against Neon.
5. Open a shell on `hrms-api` (Render dashboard → Shell) and run
   `npm run db:seed:prod` **once** to create the single production Super
   Admin. Re-running it later is harmless (idempotent `findOrCreate`).
6. Apply the R2 bucket CORS policy above with your real `hrms-web` URL.
7. Deploy `hrms-web`.
8. Log in as the seeded Super Admin, change the password immediately, and
   create the first real company/Employer Admin from there.
9. Confirm the daily expiry-alert email job: it's scheduled automatically
   inside `hrms-api` at 07:00 Europe/London once `RESEND_API_KEY` is set -
   no extra Render cron job needed. `npm run alerts:email` runs it on
   demand (e.g. via the Render shell) if you want to verify it immediately
   rather than waiting for 07:00.

## Tests

```bash
createdb hrms_test                 # once, a separate throwaway DB - never Neon
TEST_DB_USER=yourpguser TEST_DB_PASSWORD=yourpgpassword npm test
```

Jest + Supertest against the real Express app (`src/app.js`) and a
dedicated local Postgres database (`tests/globalSetup.js` wipes and
recreates it before each run - `DATABASE_URL`/`DIRECT_URL` are forced
blank in `tests/setupEnv.js` so a test run can never touch Neon). Covers
the three regressions this round of work specifically fixed or added:

- `tests/userManagement.test.js` - duplicate email returns 409 with the
  exact message, including case-insensitively (not the original 500).
- `tests/documentsCrossTenant.test.js` - a company B user gets 404, not a
  pre-signed URL, for company A's document view/download link.
- `tests/expiryAlertJob.test.js` - the expiry-alert job sends exactly one
  email the first time an item crosses a threshold, then zero on an
  identical same-day rerun.

## Next

Every module from the original spec is implemented, plus a React frontend
(`frontend/`), the production deployment path above (Neon migrations,
Cloudflare R2 document storage, Render, daily expiry-alert emails), and a
starter automated test suite (see **Tests**) covering the regressions this
round of work found or fixed. Worth growing from here: broader test
coverage (most of this project was still verified by live-testing rather
than an automated suite), and a real transactional email flow for new-user
temporary passwords instead of returning them once in the API response.
