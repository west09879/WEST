# WEST Server

Local Node/Express server for the WEST static site.

Quick start:

1. cd server
2. npm install
3. npm run seed
4. npm run dev

Default admin credentials (for local dev):
- username: admin
- password: password

 
 - Worker UI: http://localhost:3000/worker/worker.html (uses `x-worker-token` header or query param `?token=`)

Admin API: http://localhost:3000/admin-api (protected via HTTP Basic)
