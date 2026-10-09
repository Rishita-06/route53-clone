# AWS Route 53 Clone

A functional clone of the AWS Route 53 console: hosted zones, DNS records, mocked auth, SQLite persistence.
No real DNS is implemented — the goal is the Route 53 **experience and workflows**.

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 (App Router) + TypeScript + **Cloudscape Design System** (the open-source system the real AWS console is built with, so tables, forms, modals, flashbars, side-nav and top-bar match the original) |
| Backend | FastAPI + SQLAlchemy 2 + Pydantic v2 |
| Database | SQLite |

## Quick start

```bash
# 1. Backend  (http://localhost:8000, docs at /docs)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 2. Frontend (http://localhost:3000)
cd frontend
cp .env.example .env.local        # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

Or: `docker compose up --build`.

**Demo login:** Account ID `123456789012`, IAM user `admin`, password `admin123`.
The database file (`backend/route53.db`) and demo data (14 zones, records of every type) are created on first start.

Tests: `cd backend && pytest`. Type-check frontend: `cd frontend && npm run lint`.

## Features

- **Auth (mocked):** login / logout / persistent session (token in `localStorage`, 7-day server-side session in SQLite; expired or invalid tokens redirect to login).
- **Hosted zones:** list with server-side search, type filter, sorting, pagination, column/page-size preferences; create (public/private, description, tags); edit (description, tags); delete (type-`delete` confirmation; zones with custom records require an explicit "also delete all records" opt-in, mirroring Route 53's rule). New zones get auto-generated NS and SOA records like the real service.
- **DNS records:** view / search / filter by type and routing policy / sort / paginate; create, edit, delete, **bulk delete**. Types: A, AAAA, CNAME, TXT, MX, NS, PTR, SRV, CAA (SOA read-only). Alias records (A/AAAA/CNAME), Simple and Weighted routing. Per-type value validation, duplicate detection, CNAME-coexistence rule, protected apex NS/SOA.
- **Route 53 chrome:** AWS top bar, collapsible side navigation, breadcrumbs, flashbar notifications, confirmation modals, "Info" links, constraint texts and copy from the console.
- **Placeholders:** Dashboard, Health checks, Traffic policies, Profiles, Resolver, Domains, etc. render a "Coming soon" page.
- **Bonus:** BIND zone-file **import** (multi-line parentheses, `$ORIGIN`/`$TTL`, relative names, overwrite option), **export** as JSON or BIND, **dark mode** (top-bar toggle, persisted), bulk operations.

## Architecture

```
frontend/src
  app/login                      sign-in page
  app/(console)/layout.tsx       auth guard + console shell
  app/(console)/hosted-zones/…   list, create, detail (tabs), record create/edit
  app/(console)/[section]        "Coming soon" placeholders
  components/                    ConsoleShell, RecordsTable, RecordForm, ZoneModals, ImportZoneModal, TagsEditor
  lib/                           api client, auth context, notifications, breadcrumbs, nav config

backend/app
  main.py        app, CORS, lifespan (create tables + seed), validation-error shaping
  models.py      SQLAlchemy models        schemas.py   Pydantic I/O models
  auth.py        PBKDF2 hashing, session dependency
  services.py    record validation/normalisation, zone bootstrap (NS/SOA)
  validators.py  per-record-type value rules
  bind.py        BIND parser + exporter
  routers/       auth, zones, records, zone_files
  seed.py        demo user and zones
```

Design notes: thin routers, business rules in `services.py`; all list endpoints paginate and filter server-side;
the frontend keeps one typed API client (`lib/api.ts`), contexts for auth/notifications/breadcrumbs, and one shared form for record create/edit.

## Database schema

```
users          id PK, account_id, username, display_name, password_salt, password_hash   UNIQUE(account_id, username)
sessions       token PK, user_id FK→users (CASCADE), created_at, expires_at
hosted_zones   id PK (e.g. Z0123…), name (idx), comment, is_private, vpc_id, vpc_region,
               tags JSON, created_by, created_at
dns_records    id PK, zone_id FK→hosted_zones (CASCADE), name, type, ttl NULL, values JSON[],
               alias_target JSON NULL, routing_policy, set_identifier, weight NULL, created_at, updated_at
               UNIQUE(zone_id, name, type, set_identifier)   INDEX(zone_id, name)
```

## API overview

All routes except login require `Authorization: Bearer <token>`. Interactive docs: `/docs`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/login` · `/api/auth/logout` | sign in / out |
| GET | `/api/auth/me` | current user (session check) |
| GET | `/api/zones?search&type&sort&order&page&page_size` | list zones |
| POST | `/api/zones` | create zone (auto NS + SOA) |
| GET / PUT / DELETE | `/api/zones/{id}` (`?force=true` on delete) | read / edit / delete |
| GET | `/api/zones/{id}/records?search&type&routing_policy&alias&sort&order&page&page_size` | list records |
| POST | `/api/zones/{id}/records` | create record |
| GET / PUT / DELETE | `/api/zones/{id}/records/{rid}` | read / edit / delete |
| POST | `/api/zones/{id}/records/bulk-delete` | `{ "ids": [..] }` |
| POST | `/api/zones/{id}/import` | `{ "content": "<BIND text>", "overwrite": false }` |
| GET | `/api/zones/{id}/export?format=json\|bind` | download zone |

Errors are `{ "detail": "message", "fields": {…} }` with 400 (validation), 401, 404, 409 (duplicate/conflict), 422.

## Deploying a demo link

- **Backend → Render / Railway / Fly.io:** deploy `backend/` (Dockerfile provided), mount a persistent disk at `/data`
  (`DATABASE_URL=sqlite:////data/route53.db`), set `CORS_ORIGINS=https://<your-frontend-url>`.
- **Frontend → Vercel:** import the repo, root directory `frontend`, env var `NEXT_PUBLIC_API_URL=https://<your-backend-url>`.

## Known limitations

Mocked IAM/Organizations/Billing; only Simple and Weighted routing (other policies are shown disabled); Route 53 "Test record", DNSSEC and query logging are placeholders.
