# HRMS Frontend

React (Vite, plain JS) frontend for the HRMS & Sponsor Compliance backend.

## Setup

```bash
npm install
cp .env.example .env   # VITE_API_URL, defaults to http://localhost:4000/api
npm run dev             # http://localhost:5173
```

The backend must be running separately (`npm run dev` from the repo root)
with its own Postgres DB already synced/seeded.

## Structure

- `src/api/` — one `request()` wrapper (`client.js`) handling the bearer
  token, JSON parsing, and error messages; `index.js` groups every backend
  resource into a small namespaced API (`employeesApi`, `holidayApi`, …).
- `src/context/AuthContext.jsx` — login/logout, persists the token + user
  in `localStorage`, and reacts to a 401 from any request by dropping back
  to `/login`.
- `src/config/nav.js` — the sidebar's role → visible-links mapping. This
  mirrors the backend's `config/permissions.js` matrix for UX only (hiding
  a link a role would 403 on); the backend remains the actual authority,
  and every page still renders the real API error if a request is denied
  regardless of what the sidebar shows.
- `src/components/` — shared UI: `Layout` (sidebar + content), generic
  `DataTable`, `EmployeePicker` (role-scoped employee `<select>`, reused
  across most create forms), severity/status `Badges`, and `Feedback`
  (loading/error/success/empty states used on every page).
- `src/hooks/useApiData.js` — the `{ data, loading, error, reload }`
  pattern every list/detail page uses instead of hand-rolling three
  `useState` calls per page.
- `src/pages/` — one file per module, matching the backend 1:1.
- `src/components/ImmigrationDetailEditor.jsx` — nationality/visa/right-to-
  work/EU Settlement Scheme status editor, embedded on the Right to Work
  page (not the Employee edit form) since it's gated by the stricter
  `RIGHT_TO_WORK` permission. The Employee detail page shows the same data
  read-only with a link across to edit it.
- Next of kin / emergency contacts live directly on `EmployeeDetailPage.jsx`
  (list + inline edit + add form) rather than a separate page - it's a
  small sub-resource of one employee, not something worth its own nav item.
- `CompaniesPage.jsx` / `UsersPage.jsx` (nav: Companies / Users, Super
  Admin + Employer Admin + HR Manager only) - Super Admin gets a create
  form and sees every tenant; everyone else sees exactly their own company
  and their own company's users, enforced by the backend, not just hidden
  UI. New-user creation surfaces the one-time temporary password in a
  success banner (`user-select: all` so it's easy to copy).
- `ChangePasswordPage.jsx`, linked from the sidebar footer next to Log out.
- `AuditLogPage.jsx`'s "Verify Integrity" button is hidden for non-Super-
  Admin roles - the hash chain is global across every tenant, so checking
  it necessarily reports on the whole platform (see backend README's
  cross-tenant section).

## Notes

- Auth token lives in `localStorage` (acceptable for an internal tool at
  this stage; would want httpOnly cookies + refresh-token rotation before
  this is internet-facing).
- Department/Manager filters in Reports are plain UUID/text inputs since
  the backend has no `/api/departments` list endpoint yet - only
  employee-embedded department data.
- This was verified against a live backend + real Postgres data with a
  headless-browser run (login, every nav link, a report execution, and
  the audit log's Verify Integrity button all exercised against real
  responses) - not just a successful `vite build`.
