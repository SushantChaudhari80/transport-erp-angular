# Transport ERP

An Angular application for transport, fleet, and operations management.

## Requirements

- Node.js and npm versions supported by the installed Angular CLI.

## Set up and run

```bash
npm ci
npm start
```

Open `http://localhost:4200/`. The root URL and unknown routes redirect to the
login page at `/login`.

## Checks and production build

```bash
npm test
npm run build
```

The production build is written to `dist/`. To run the built server-rendered
application locally:

```bash
npm run serve:ssr:transport-app
```

The server listens on port `4000` by default and supports the `PORT` environment
variable.

## Sign-in

The login form calls `GET http://localhost:8081/login/user` with `email` and
`pass` query parameters. A successful HTTP response navigates to `/dashboard`;
HTTP 401/403 responses are shown as invalid credentials.

The API host is configured in `src/app/core/services/host.ts`. The backend must
allow browser requests from the app's origin. Before production use, move
credentials to a TLS-protected POST request body and protect the dashboard with
authentication and authorization.
