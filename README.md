# Northstar ATM

A full-stack ATM system demo with a React/Vite interface, Node/Express API, and a Supabase PostgreSQL schema. It models checking and savings accounts, PIN/card authentication with a three-try lockout, balance inquiries, cash withdrawals, cash/check deposits, transfers, operator ATM on/off control and maintenance, and manager reports.

> **Educational demo only.** This project is not connected to a bank or physical ATM and must not be used to hold real customer data or move real money. Demo balances and PINs are fictional. The local demo uses in-memory data that resets when the API restarts.

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`. Leave `DEMO_MODE=true` for a no-credentials demonstration.
3. Install dependencies and start both servers:

   ```sh
   npm install
   npm run dev
   ```

4. Open <http://localhost:5173>.

### Demo sign-ins

| Access | Card / PIN |
|---|---|
| Customer Jordan Lee | `4000000000000002` / `1234` |
| Customer Sam Rivera | `4000000000000010` / `5678` |
| Bank manager | PIN `8642` |
| ATM operator | PIN `2468` |

Customer account numbers for demo transfers: `4821` and `1937`. Three incorrect customer PIN attempts lock the demo card until the API restarts. Operator and manager PINs are demo-only defaults; set different values in `.env` for any shared test environment.

## Supabase setup

1. Create a Supabase project and open its SQL Editor.
2. Run [`supabase/schema.sql`](./supabase/schema.sql) to create the tables, indexes, seed demo records, and transaction/maintenance RPCs.
3. Copy `.env.example` to `.env`; set `DEMO_MODE=false`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. Keep the service-role key exclusively on the server. Never add it to a `VITE_` variable or commit it.
4. Set non-demo `OPERATOR_PIN` / `MANAGER_PIN` values.
5. Restart the API. `GET /api/health` reports whether it is running in demo or Supabase mode.

The database has row-level security enabled without public policies. The Express server uses the service-role key and validates all access. The SQL RPC functions perform account and ATM balance changes and ledger inserts together in a database transaction.

## Deploy to Render

The app can run as one Node web service: Express serves Vite's production build. [`render.yaml`](./render.yaml) is a Render Blueprint for the service.

1. Create a Supabase project and run [`supabase/schema.sql`](./supabase/schema.sql).
2. Push this project to a private Git repository you control.
3. In Render, create a **Blueprint** from that repository and apply `render.yaml`.
4. Enter the Supabase URL and service-role key, plus strong unique operator and manager PINs, in the Render environment settings. Never commit these secrets.
5. Verify the deployed `/api/health` endpoint and test customer, manager, and operator flows using only the seeded fictional data.

If the frontend is hosted separately, set `CLIENT_ORIGIN` to its exact HTTPS origin and configure `/api` to reach the Node service.

Production use would require a proper identity/session provider, durable role-based authentication, audit trails, rate limiting, CSRF/origin policy, hardware integration, regulatory review, secure PIN/key management, and operational monitoring. The in-memory session store and demo PIN mechanism are not production authentication.
