# Transport ERP
## Technical guidance for client IT and developers

This document describes the Angular web application in this repository. It
covers local setup, architecture, service integration, deployment, and
operational troubleshooting. The backend/API implementation and the Android
driver application are maintained outside this repository; their internal
configuration and behavior must be confirmed with their owners.

## 1. System overview

The web client is a standalone-component Angular application with Angular
Router, Angular `HttpClient`, and server-side rendering (SSR). Most operational
data is loaded from a separate REST API. The frontend does not contain the
backend database, API implementation, or mobile application source.

| Concern | Current implementation |
| --- | --- |
| Web framework | Angular 21, TypeScript, RxJS |
| UI routing | Lazy-loaded standalone components in `src/app/app.routes.ts` |
| API client | Angular `HttpClient`; services and some page components call the API directly |
| API base URL | `Host.API_URL` in `src/app/core/services/host.ts` |
| Rendering | Angular SSR with browser/client rendering configured per route |
| Static assets | `public/`, copied into the browser build output |
| Netlify integration | `@netlify/angular-runtime`, configured in `netlify.toml` |
| Node SSR entry point | `src/server.ts`; default port 4000, overridable with `PORT` |

### Main code areas

- `src/app/pages/`: login, dashboard, fleet, operations, finance, support, and
  administrator screens.
- `src/app/layout/`: employee workspace shell and administrator shell.
- `src/app/core/services/`: shared authentication, dashboard, incident, and
  chatbot HTTP services, plus the API host constant.
- `src/app/core/guards/`: administrator route guard.
- `src/app/models/`: shared TypeScript data models.
- `src/app/app.routes.ts`: browser application routes and lazy-loaded pages.
- `src/app/app.routes.server.ts`: SSR render-mode configuration.
- `src/server.ts`: Express-based Angular SSR host and static-file server.

## 2. Local setup and development

### Prerequisites

- Node.js and npm versions supported by the Angular CLI version in the
  project's lockfile.
- Network access to the configured backend API for live application data.
- Backend CORS configuration permitting the local development origin.

### Install and run

From the repository root:

```powershell
npm ci
npm start
```

Open `http://localhost:4200/`. The root route redirects to `/login`; unknown
routes also redirect to the login page.

Available project scripts:

| Command | Purpose |
| --- | --- |
| `npm start` | Run the Angular development server |
| `npm test` | Run the Angular unit-test target |
| `npm run build` | Create the production application build |
| `npm run watch` | Rebuild continuously using the development configuration |
| `npm run serve:ssr:transport-app` | Run the built SSR server; uses port 4000 unless `PORT` is set |

The production build is written under `dist/transport-app/`. The browser
assets are under `dist/transport-app/browser/`; the Node SSR entry point is
`dist/transport-app/server/server.mjs`.

## 3. Routing and feature areas

The primary employee routes include `/dashboard`, `/orders`, `/vehicles`,
`/drivers`, `/driver-payment`, `/trips`, `/trips/billed`,
`/trips/unbilled`, `/machine-reading/billed`,
`/machine-reading/unbilled`, `/quotation`, `/diesel`, `/payments`,
`/payment-details`, `/vouchers`, `/invoices`, `/portfolio`, and `/support`.

The administrator routes are `/admin/login`, `/admin/chatbot`, and
`/admin/incidents`. The administrator pages are nested under a client-side
route guard. A client-side guard is navigation control, not a security
boundary; APIs must enforce authorization themselves.

Some routes are configured for client rendering and the remaining routes use
the SSR route configuration in `src/app/app.routes.server.ts`. When changing a
route, verify both browser navigation and direct URL loading on the deployed
SSR host.

## 4. Backend integration

### API origin and CORS

`src/app/core/services/host.ts` currently points to
`https://kalbhairavnath-arthmovers.onrender.com/` using a compile-time
constant. It is not read from an Angular environment file or a runtime
configuration endpoint. To target another API, update that constant, rebuild,
and redeploy. Do not put credentials, private keys, or other secrets in
frontend configuration: values included in a browser bundle are public.

The API must:

- be reachable over HTTPS in production;
- allow the deployed web origin through its CORS policy;
- return the response shapes expected by the TypeScript models and page
  components;
- enforce identity, tenant scoping, and role permissions on the server;
- provide useful HTTP status codes and a consistent error response.

The web client has no shared HTTP interceptor for authentication, retries, or
global API error handling. Page/service behavior handles errors locally.
Coordinate response-contract changes with the frontend before changing API
payloads.

### Confirmed shared-service contracts

The following paths are relative to `Host.API_URL`:

| Feature | Method and path | Purpose |
| --- | --- | --- |
| Employee sign-in | `GET /login/user?email=…&pass=…` | Sign in; the frontend expects a response containing `message: "success"` |
| Dashboard summary | `GET /api/customers/dashboard/utilitis` | Load dashboard statistics |
| Account profile | `GET /api/customers/get` | Load account information for the profile menu |
| Incidents | `GET, POST /api/incidents` | List and create incidents |
| Incident detail | `GET /api/incidents/{id}` | Load one incident |
| Incident status | `PATCH /api/incidents/{id}/status` | Update status (`Open`, `In_Progress`, or `Resolved`) |
| Incident comments | `GET, POST /api/incidents/{id}/comments` | Load or add comments |
| Chat sessions | `GET /api/rag/chat/sessions` | List recorded assistant sessions |
| Chat history | `GET, DELETE /api/rag/chat/history/{sessionId}` | Load or clear a session's history |
| Chat message | `POST /api/rag/chat` | Send a message; body includes `sessionId` and `message` |
| Knowledge documents | `GET, POST /api/rag/documents` | List or upload assistant knowledge documents |
| Knowledge document | `DELETE /api/rag/documents/{documentName}` | Remove a knowledge document |

Other operational pages call module APIs directly from their components. Their
endpoint paths and request/response mappings are implemented alongside those
pages; they are not consolidated into a versioned API specification in this
repository. Treat the backend API's maintained contract as authoritative.

### Sign-in and session behavior

Employee sign-in sends the username and password as query parameters on a GET
request. On success, the browser navigates to the dashboard. The frontend does
not persist an employee access token or independently guard employee routes.
This is not a production-ready authentication/session design. Query-string
credentials can be exposed through logs, browser history, proxies, and
monitoring systems; replace this flow with a TLS-protected POST and a
server-validated session/token before production use.

Administrator authentication is currently a hard-coded credential check in
the Angular client. A successful check sets a `sessionStorage` flag, which the
route guard reads. Because browser code and storage are user-controlled, this
does not provide real authentication or authorization. Do not publish this
console for sensitive production use until it is replaced by a proper
identity-provider flow and server-side access control. Do not treat the
administrator route guard as protection for backend endpoints.

## 5. Build and deployment

The Angular production build is configured in `angular.json` and emits both
browser assets and an SSR server bundle. `netlify.toml` runs `npm run build`,
publishes `dist/transport-app/browser`, and enables the Angular Netlify
runtime. For a Node deployment, start the built server with:

```powershell
npm run serve:ssr:transport-app
```

Set `PORT` in the hosting environment when the default port 4000 is unsuitable.
Ensure the host supports the configured Angular SSR runtime and that deep links
are routed through the application server. The API base URL is embedded at
build time; build a separate artifact for each API environment.

Suggested release checks:

1. Confirm the target API URL and backend CORS allow-list.
2. Run `npm ci`, `npm test`, and `npm run build`.
3. Deploy to a staging environment and verify direct loads of employee and
   administrator URLs.
4. Test login failure/success, API-backed lists, record creation, invoice
   generation, chatbot interactions, document management, and incident status
   updates against staging data.
5. Confirm logs, monitoring, HTTPS, and API authorization with the backend
   owner before production release.

## 6. Troubleshooting

| Symptom | Checks |
| --- | --- |
| Sign-in says it cannot reach the service | Confirm `Host.API_URL`, API availability, TLS certificate, and CORS policy for the browser origin. |
| Sign-in rejects valid-looking credentials | Confirm the API's expected `email`/`pass` query names and response `message` value; check API logs without logging passwords. |
| Lists or profile data fail to load | Check browser Network/Console output, API health, endpoint response shape, CORS, and current filters. Use the page's refresh/retry action where available. |
| An action fails while lists still load | Inspect the failing request method, URL, payload, and HTTP response; confirm the matching API permission and request contract. |
| Chat or document indexing fails | Check the `/api/rag` service, document-processing dependencies and API logs. The web client displays a service error when a request fails. |
| Admin access returns to the login page | The browser session flag may be absent or expired; sign in again. This client-side check is not a security control. |
| A deployed deep link returns 404 | Verify SSR/rewrite configuration and that the deployment is serving the Angular runtime rather than static files alone. |
| SSR server does not start | Confirm a successful production build, Node compatibility, correct server bundle path, and the configured `PORT`. |

Avoid adding credentials, personal information, or payment/driver data to
browser console output, screenshots, issue trackers, or deployment logs.

## 7. Operational and security readiness

Before using this application with production users or sensitive records, the
client's application and backend owners should jointly:

- replace both client-side sign-in approaches with an approved identity
  provider and server-enforced authentication/authorization;
- replace employee GET-based credential submission with an authenticated
  TLS-protected flow that never places passwords in URLs;
- enforce authorization and tenant/customer data isolation on every API
  endpoint, including chatbot document and history operations;
- confirm secure session expiry, logout invalidation, CSRF protections where
  applicable, and secure handling of uploaded knowledge documents;
- define API versioning, backups/retention, audit logging, monitoring, and
  incident-response ownership;
- verify that uploaded chatbot documents and chat history are appropriate for
  the model/service provider and the client's data-retention policy;
- review accessibility, browser support, privacy notices, and any financial
  report calculations before client sign-off.

This checklist records implementation limitations visible in the web client;
it is not a substitute for a backend security assessment or client-specific
deployment review.
