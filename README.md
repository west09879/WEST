# WEST (BeFo Bakers)

This repo contains a static frontend and a simple Node.js + Express backend (in `/server`) using SQLite.

Quick start (local dev):

1. Install Node.js (>= 16 LTS)
2. cd server
3. npm install
4. npm run seed
5. npm run dev

- Admin UI: http://localhost:3000/admin
- Admin default credentials (dev): admin / password

Notes:
- The server serves the static frontend and provides simple REST endpoints under `/api`.
- Admin endpoints are under `/admin-api` and protected by HTTP Basic auth.
