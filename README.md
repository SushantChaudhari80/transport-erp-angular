# Transport ERP

An Angular application for transport, fleet, and operations management.

## Product documentation

See the client documentation:

- [Transport ERP user guide](docs/transport-erp-user-guide.md) for employee
  workflows and feature availability.
- [Transport ERP technical guidance](docs/transport-erp-technical-guidance.md)
  for setup, integration, deployment, troubleshooting, and security notes.

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

The login form calls `GET {API_URL}/login/user` with `email` and `pass` query
parameters. The API base URL is currently set in
`src/app/core/services/host.ts`. A successful response navigates to
`/dashboard` when its `message` is `success`; HTTP 401/403 responses are shown
as invalid credentials.

The backend must allow browser requests from the app's origin. The current
administrator console also uses prototype client-side authentication. Before
production use, move credentials to a TLS-protected POST request body, replace
the prototype admin login with server-side authentication and authorization,
and protect all operational APIs.
