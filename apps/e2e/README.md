# @bigbluebam/e2e

End-to-end testing suite for all BigBlueBam frontend apps. Walks through every UI interaction, verifies API responses, checks UI-API data agreement, captures a screenshot for every test step, and generates a markdown report per run.

## Prerequisites

1. **Docker stack running.** Tests target the live nginx on port 80.
   ```bash
   docker compose up -d
   ```
   Wait until `docker compose ps` shows all services healthy. Global setup will block on `/b3/api/health/ready` until the stack is ready.

2. **Dependencies installed.** From the repo root:
   ```bash
   pnpm install
   ```

3. **Chromium installed** (first time only):
   ```bash
   cd apps/e2e
   npx playwright install chromium
   ```

4. **Test users exist.** Global setup creates them automatically via the API CLI:
   - `e2e-admin@bigbluebam.test` / `E2eTestP@ss123!`
   - `e2e-member@bigbluebam.test` / `E2eTestP@ss123!`

   If signup is disabled in your environment, the setup falls back to calling:
   ```bash
   docker compose exec api node dist/cli.js create-admin --email ... --password ...
   ```
   To override credentials, copy `.env.e2e.example` to `.env.e2e` and adjust.

## Running Tests

All commands below work from either the repo root (via `pnpm --filter @bigbluebam/e2e`) or from `apps/e2e/` directly.

### From the repo root

```bash
pnpm test:e2e              # Run every app suite
pnpm test:e2e:b3           # Only the BigBlueBam (b3) app
pnpm test:e2e:ui           # Playwright UI mode (interactive picker)
pnpm test:e2e:report       # Open the last HTML report
```

### From `apps/e2e/`

```bash
# Full run
npx playwright test

# Single app (uses project names from playwright.config.ts)
npx playwright test --project=b3
npx playwright test --project=banter
npx playwright test --project=beacon
npx playwright test --project=bearing
npx playwright test --project=bench
npx playwright test --project=bill
npx playwright test --project=blank
npx playwright test --project=blast
npx playwright test --project=board
npx playwright test --project=bolt
npx playwright test --project=bond
npx playwright test --project=book
npx playwright test --project=brief
npx playwright test --project=helpdesk

# Single spec file
npx playwright test src/apps/b3/tests/navigation.spec.ts

# Single test case (by line number)
npx playwright test src/apps/b3/tests/navigation.spec.ts:12

# Filter by test title
npx playwright test -g "dashboard loads"

# Serial execution (avoid rate-limit 429s during heavy parallel API calls)
npx playwright test --workers=1

# Interactive UI mode — pick tests to run and watch them live
npx playwright test --ui

# Debug mode — steps through with the Playwright inspector
npx playwright test --debug src/apps/b3/tests/auth.spec.ts

# Keep the browser open on failure for inspection
npx playwright test --headed --workers=1

# Show the last HTML report
npx playwright show-report
```

## Project Structure

Each app is its own Playwright project. They all depend on a `setup` project that logs in once and saves cookies to `.auth/admin.json`, so each app suite starts pre-authenticated.

```
apps/e2e/
├── playwright.config.ts              # 15 projects: setup + 14 app suites
├── .env.e2e.example                  # Credential template
├── .auth/                            # Saved login state (gitignored)
│   ├── admin.json
│   └── member.json
├── reports/                          # Generated per-run reports (gitignored)
│   └── {ISO-timestamp}/
│       ├── report.md                 # Markdown summary with screenshots
│       └── {app}/{test-name}/*.png
└── src/
    ├── auth/                         # Login helpers, test user constants
    ├── api/                          # Direct HTTP client (envelope validator)
    ├── fixtures/                     # Extended test with apiClient + screenshots
    ├── interceptors/                 # Browser request capture + UI-API agreement
    ├── page-objects/                 # Base page (pushState navigation)
    ├── helpers/                      # interactions, drag-drop, keyboard, pagination,
    │                                 # responsive, screenshot, websocket,
    │                                 # markdown-reporter
    ├── registry/                     # AppConfig types + central registry
    ├── global/                       # Global setup/teardown (health check, users)
    └── apps/
        ├── b3/                       # BigBlueBam (Kanban)
        │   ├── b3.config.ts
        │   ├── pages/*.page.ts
        │   └── tests/
        │       ├── auth.spec.ts
        │       ├── navigation.spec.ts
        │       ├── project-crud.spec.ts
        │       ├── board-crud.spec.ts
        │       ├── drag-drop.spec.ts
        │       ├── forms-validation.spec.ts
        │       ├── keyboard-shortcuts.spec.ts
        │       ├── pagination.spec.ts
        │       ├── error-states.spec.ts
        │       ├── responsive.spec.ts
        │       └── ui-api-agreement.spec.ts
        └── {banter,beacon,bearing,bench,bill,blank,blast,
              board,bolt,bond,book,brief,helpdesk}/   # Same shape per app
```

## What Each Test Category Covers

| File | What it verifies |
|---|---|
| `auth.spec.ts` | Login form renders, valid creds redirect to dashboard, invalid creds show error, unauthenticated access redirects to login, logout clears session |
| `navigation.spec.ts` | Every route in the AppConfig is reachable, pushState routing works, browser back/forward works, deep links load correctly |
| `*-crud.spec.ts` | Create/read/update/delete for each entity; after each UI action, verifies the same state via a direct API call |
| `forms-validation.spec.ts` | Required fields, Zod errors rendered in the UI, server-side API errors render correctly |
| `drag-drop.spec.ts` | dnd-kit drag between containers and reorder within a list (b3, bond, board) |
| `keyboard-shortcuts.spec.ts` | Cmd+K command palette, per-app shortcuts, shortcut suppression in input fields |
| `pagination.spec.ts` | Cursor-based pagination, infinite scroll, no duplicate items |
| `realtime.spec.ts` | WebSocket connection established, two-tab sync (banter, board) |
| `error-states.spec.ts` | API 500/404/409 handling via `page.route()` mocks, network offline |
| `responsive.spec.ts` | Mobile (375px), tablet (768px), desktop (1280px) viewports |
| `ui-api-agreement.spec.ts` | Fetch entity list via the direct API client, verify every item is rendered in the DOM |

## Screenshots and Markdown Report

Every test step captures a screenshot via `screenshots.capture(page, 'step-name')`. They're saved with meaningful filenames and timestamps:

```
reports/
└── 2026-04-10T00-09-08/
    ├── report.md
    └── b3/
        ├── dashboard-loads-after-login/
        │   ├── 01-dashboard-loaded_2026-04-10T00-09-14.png
        │   └── 02-dashboard-content-visible_2026-04-10T00-09-14.png
        └── browser-back-forward-works-with-pushstate-routing/
            ├── 01-start-at-dashboard_2026-04-10T00-09-31.png
            ├── 02-navigated-to-my-work_2026-04-10T00-09-32.png
            ├── 03-navigated-to-settings_2026-04-10T00-09-32.png
            ├── 04-after-back-button_2026-04-10T00-09-33.png
            └── 05-after-forward-button_2026-04-10T00-09-33.png
```

After every run, `reports/{timestamp}/report.md` is generated by the custom `MarkdownReporter`. It includes:

- Run timestamp, overall status, total duration
- Per-app summary table (passed / failed / skipped / duration)
- Every test with its pass/fail icon, duration, error message, and inline screenshot links

Open `report.md` in any markdown viewer (or GitHub) to see the full run with inline screenshots.

## Playwright's Built-in Reports

In addition to the markdown report, Playwright's standard HTML report is written to `apps/e2e/playwright-report/`. Open it with:

```bash
npx playwright show-report
```

It includes trace files (`trace.zip`) for any failed tests, which you can open in [trace.playwright.dev](https://trace.playwright.dev/) to step through the exact browser state at each action.

## Adding Tests for a New App

1. Create `src/apps/{appName}/{appName}.config.ts` that exports an `AppConfig` with `basePath`, `apiBasePath`, `pages[]`, and `entities[]`.
2. Create `src/apps/{appName}/pages/*.page.ts` page objects extending `BasePage`.
3. Create `src/apps/{appName}/tests/*.spec.ts` using `test, expect` from `../../../fixtures/base.fixture`.
4. Register the config in `src/registry/app-registry.ts`.
5. Add a project entry in `playwright.config.ts`:
   ```ts
   appProject('{appName}'),
   ```
6. Add a script shortcut in `package.json`:
   ```json
   "test:{appName}": "playwright test --project={appName}"
   ```

Every test must call `screenshots.capture(page, 'descriptive-step-name')` at key moments — the markdown reporter correlates these to the test results.

## Troubleshooting

**`Login API returned 401`** — The test user doesn't exist. Either run `docker compose up -d` (setup creates them) or manually create via:
```bash
docker compose exec api node dist/cli.js create-admin \
  --email "e2e-admin@bigbluebam.test" --password "E2eTestP@ss123!" \
  --name "E2E Admin" --org "E2E Test Organization"
```

**`Stack did not become healthy after 60s`** — Docker services aren't up. Run `docker compose ps` and check for restarting services.

**Many 429 rate-limit failures** — Reduce parallel workers: `--workers=1`. The default (4) hammers the API faster than the rate limiter allows.

**Saved auth is stale** — Delete `.auth/` and rerun. The setup project will re-login and save fresh cookies.

**Report.md not generated** — Don't pass `--reporter=list` on the command line; it overrides the config's reporter array. Use `--reporter=list,./src/helpers/markdown-reporter.ts` or just omit the flag.

**Tests pass locally but fail in CI** — CI runs with `workers: 1` and `retries: 2` automatically (see `playwright.config.ts`).
