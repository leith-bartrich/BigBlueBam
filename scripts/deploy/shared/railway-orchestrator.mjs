// railway-orchestrator.mjs
//
// High-level "deploy the whole BigBlueBam stack to Railway" logic. This is
// the data-flow layer: it walks the service catalog, computes the env-var
// bundle each service needs, and calls the RailwayClient (railway-api.mjs)
// to provision and configure every service end-to-end. It does NOT make
// any retry decisions, print anything, or block on user input directly —
// all of that is delegated to the caller via the onProgress callback and
// the optional awaitPluginConfirmation callback.
//
// Zero external dependencies.
//
// Re-run safety: every Railway mutation we invoke is idempotent by design
// (RailwayClient.createService returns the existing service by name,
// updateServiceInstance only touches the fields we pass, upsertVariables
// with replace=false merges instead of clobbering). That means if the
// orchestrator aborts halfway through, the caller can simply run it again
// and it will pick up where it left off.

import {
  getRequiredAppServices,
  getSelfHostedInfra,
  JOB_SERVICES,
} from './services.mjs';
import { hintFor } from './env-hints.mjs';

// ─── Plan assembly ────────────────────────────────────────────────────
//
// The deploy plan is a flat, ordered list of services to create. Order
// matters for the progress UI (users see a stable list) but not for
// functional correctness — Railway resolves inter-service references
// lazily at deploy time, so creating bolt-api before its dependency
// mcp-server is fine.

function buildDeployPlan() {
  const appServices = getRequiredAppServices().filter(
    // TODO: voice-agent is optional and depends on whether the user wants
    // voice/video. For now we never include it in the automated deploy —
    // users who want it can add it manually from the Railway dashboard.
    (s) => s.name !== 'voice-agent',
  );
  const selfHostedInfra = getSelfHostedInfra();
  // JOB_SERVICES (currently just `migrate`) get created as regular Railway
  // services with restart policy NEVER — Railway doesn't have a separate
  // "job" primitive, but a service with restart=NEVER runs exactly once
  // per deploy and then stays in the "exited" state, which is what we want.
  return [...appServices, ...selfHostedInfra, ...JOB_SERVICES];
}

// ─── Variable resolution ──────────────────────────────────────────────
//
// For every env var declared in a service's catalog entry, ask env-hints
// what kind of value it is (plugin ref, generated secret, user integration,
// derived internal URL, …) and resolve it to a concrete string — or skip
// it if we can't compute it yet (the user will fill it in later in the
// Railway dashboard). Required vars that can't be resolved are a hard
// error; optional vars that can't be resolved are silently skipped.

/**
 * Build the { KEY: value } object for a single service.
 *
 * Exposed as a named export so the caller (and tests) can inspect the
 * computed bundle without running the full orchestrator.
 */
export function buildServiceVariables(service, context) {
  const { generatedSecrets = {}, publicUrl = null, userIntegrations = {} } = context ?? {};
  const out = {};

  const required = service?.env?.required ?? [];
  const optional = service?.env?.optional ?? [];

  // Resolve a single variable. Returns either a string (the value to set)
  // or the sentinel symbol SKIP meaning "we can't compute this now, leave
  // it unset on Railway and let the user fill it in later".
  const SKIP = Symbol('skip');
  const resolve = (name) => {
    const hint = hintFor(name);
    switch (hint.kind) {
      case 'plugin':
      case 'reference':
      case 'computed':
      case 'literal':
        // These are all literal strings in the hint — Railway itself
        // resolves plugin/reference syntax at runtime (${{Postgres...}}),
        // and computed/literal values are already concrete.
        return hint.value;

      case 'secret': {
        // Generated locally and passed in via context. If the caller
        // didn't generate this secret, we have no way to conjure one —
        // skip. (If this was a required var, the caller validates later.)
        const v = generatedSecrets[name];
        return v !== undefined && v !== null && v !== '' ? v : SKIP;
      }

      case 'public': {
        // Needs the frontend's public URL. On the first deploy we don't
        // know it yet (Railway assigns a domain after the service exists),
        // so we skip and let the user set it in the dashboard on round 2.
        if (!publicUrl) return SKIP;
        // Strip trailing slash before substituting so hints like
        // `<frontend-public-url>/b3` produce `https://host.up.railway.app/b3`
        // not `https://host.up.railway.app//b3`.
        const base = publicUrl.replace(/\/+$/, '');
        const template = String(hint.value);
        return template.replace('<frontend-public-url>', base);
      }

      case 'user': {
        // OAuth / SMTP / etc. — comes from outside. Empty string means
        // "the user chose to skip this integration"; treat as SKIP.
        const v = userIntegrations[name];
        return v !== undefined && v !== null && v !== '' ? v : SKIP;
      }

      case 'note':
      case 'unknown':
      default:
        // `note` hints are documentation only (e.g. HTTP_PORT explaining
        // that Railway assigns the port automatically), and `unknown`
        // means env-hints has no idea what to do. Either way, skip.
        return SKIP;
    }
  };

  // Edge case: MinIO and LiveKit generated secrets are SET on those
  // services themselves, not just referenced from app services. Their
  // catalog entries declare MINIO_ROOT_USER etc. as required, and the
  // generic `secret` branch above already handles that because the
  // generatedSecrets context contains these keys. No special-casing
  // needed here as long as the caller passes them through.

  for (const name of required) {
    const v = resolve(name);
    if (v === SKIP) {
      // Required vars MUST be resolvable. If we hit this it means either
      // (a) the caller forgot to pass a generated secret, (b) a required
      // var is marked `user` or `public` in env-hints (that's a bug in
      // the hints or in the catalog), or (c) env-hints has no entry at all.
      throw new Error(
        `Cannot resolve required variable "${name}" for service "${service.name}". ` +
          `Check generatedSecrets, userIntegrations, publicUrl, and env-hints.mjs.`,
      );
    }
    out[name] = v;
  }

  for (const name of optional) {
    const v = resolve(name);
    if (v !== SKIP) out[name] = v;
  }

  // Sort keys for stable output — makes diffs readable and the variable
  // upsert payloads deterministic between runs.
  const sorted = {};
  for (const k of Object.keys(out).sort()) sorted[k] = out[k];
  return sorted;
}

// ─── Orchestrator ─────────────────────────────────────────────────────

export class RailwayOrchestrator {
  constructor(client, options = {}) {
    if (!client) throw new Error('RailwayOrchestrator requires a RailwayClient instance');
    this.client = client;

    const {
      projectName,
      workspaceId = null,
      githubRepo,
      branch,
      generatedSecrets = {},
      publicUrl = null,
      userIntegrations = {},
      onProgress = () => {},
      awaitPluginConfirmation = null,
    } = options;

    if (!projectName || typeof projectName !== 'string') {
      throw new Error('RailwayOrchestrator requires options.projectName');
    }
    if (!githubRepo || typeof githubRepo !== 'string') {
      throw new Error('RailwayOrchestrator requires options.githubRepo (e.g. "user/repo")');
    }
    if (!branch || typeof branch !== 'string') {
      throw new Error('RailwayOrchestrator requires options.branch');
    }

    this.projectName = projectName;
    this.workspaceId = workspaceId;
    this.githubRepo = githubRepo;
    this.branch = branch;
    this.generatedSecrets = generatedSecrets;
    this.publicUrl = publicUrl;
    this.userIntegrations = userIntegrations;
    this.onProgress = onProgress;
    this.awaitPluginConfirmation = awaitPluginConfirmation;

    // Filled in by _phaseProject().
    this.projectId = null;
    this.defaultEnvironmentId = null;

    // Filled in by _phaseServices(). Map<serviceName, serviceId>.
    this.serviceIds = new Map();

    // Filled in by _buildPlan() during run().
    this.plan = [];

    // Step counter — increments as we emit progress. We precompute the
    // total in run() once we know the plan length.
    this.step = 0;
    this.total = 0;
  }

  // Emit a progress event. Swallows any error from the callback itself so
  // a buggy UI can't bring down the deploy.
  _emit(event) {
    try {
      this.onProgress(event);
    } catch {
      // ignore — progress reporting is best-effort
    }
  }

  // Convenience: emit a "starting" event and a "finished" event around an
  // async operation, with ok/error set appropriately. Re-throws on error
  // so the caller of _step() still sees the failure.
  async _step(phase, message, fn, extra = {}) {
    this.step += 1;
    const base = { phase, step: this.step, total: this.total, message, ...extra };
    this._emit({ ...base });
    try {
      const result = await fn();
      this._emit({ ...base, ok: true });
      return result;
    } catch (err) {
      this._emit({ ...base, ok: false, error: err });
      throw err;
    }
  }

  // ─── Phase 1: validate ──────────────────────────────────────────────
  async _phaseValidate() {
    await this._step('project', 'Checking Railway API schema compatibility', async () => {
      const compat = await this.client.assertSchemaCompatibility();
      if (!compat.ok) {
        // Naming every missing mutation gives the user enough to search
        // Railway's docs or changelog for a rename.
        throw new Error(
          `Railway GraphQL schema is missing required mutations: ${compat.missing.join(', ')}. ` +
            `This usually means Railway renamed a mutation — check https://docs.railway.com/reference/public-api ` +
            `and update scripts/deploy/shared/railway-api.mjs.`,
        );
      }
    });

    await this._step('project', 'Verifying Railway API token', async () => {
      const me = await this.client.whoami();
      // Pass the identity through so the UI can display a "logged in as
      // foo@bar.com" confirmation before we start burning user quota.
      this._emit({
        phase: 'project',
        step: this.step,
        total: this.total,
        message: `Authenticated as ${me.email ?? me.name ?? 'unknown user'}`,
        ok: true,
        identity: me,
      });
    });
  }

  // ─── Phase 2: project ───────────────────────────────────────────────
  async _phaseProject() {
    await this._step('project', `Resolving Railway project "${this.projectName}"`, async () => {
      // Prefer an existing project with this name so repeated runs reuse
      // the same project instead of creating duplicates.
      const existing = await this.client.findProjectByName(this.projectName);
      if (existing) {
        this.projectId = existing.id;
        // We still need the environment ID — findProjectByName only
        // returns {id, name}.
        const env = await this.client.getDefaultEnvironment(this.projectId);
        if (!env) {
          throw new Error(
            `Project "${this.projectName}" exists but has no environments — create one in the Railway dashboard.`,
          );
        }
        this.defaultEnvironmentId = env.id;
        return;
      }
      const created = await this.client.createProject({
        name: this.projectName,
        workspaceId: this.workspaceId ?? undefined,
      });
      this.projectId = created.id;
      this.defaultEnvironmentId = created.defaultEnvironmentId;
      if (!this.defaultEnvironmentId) {
        throw new Error(
          `Created project "${this.projectName}" but could not resolve a default environment.`,
        );
      }
    });
  }

  // ─── Phase 3: plugin prompt (Postgres + Redis) ──────────────────────
  async _phasePluginPrompt() {
    // The Railway public API does NOT expose plugin creation (they're a
    // dashboard-only product as of this writing), so we can't add the
    // Postgres and Redis plugins ourselves. Instead we emit a prompt event
    // and, if the caller wired one, await their confirmation callback.
    this.step += 1;
    this._emit({
      phase: 'plugin-prompt',
      step: this.step,
      total: this.total,
      message:
        'Add the Postgres and Redis plugins in the Railway dashboard (Project → New → Database), ' +
        'then confirm to continue.',
    });
    if (typeof this.awaitPluginConfirmation === 'function') {
      // Caller-supplied async gate — typically a `confirm()` CLI prompt.
      await this.awaitPluginConfirmation();
    }
    // If no confirmation callback was provided we assume the caller has
    // already added the plugins (or is running in an automated context
    // where the plugins are pre-provisioned).
    this._emit({
      phase: 'plugin-prompt',
      step: this.step,
      total: this.total,
      message: 'Plugins confirmed',
      ok: true,
    });
  }

  // ─── Phase 4: services (create + configure + set vars) ─────────────
  async _phaseServices() {
    // Shared context for buildServiceVariables — built once up front so
    // every service sees the same snapshot of secrets and integrations.
    const varContext = {
      generatedSecrets: this.generatedSecrets,
      publicUrl: this.publicUrl,
      userIntegrations: this.userIntegrations,
    };

    for (const svc of this.plan) {
      // ── Create
      const created = await this._step(
        'service-create',
        `Creating service "${svc.name}"`,
        async () => {
          // Source: if the service has a Dockerfile we build from the
          // GitHub repo (all our services use this branch because even
          // the infra services have a passthrough Dockerfile). If it has
          // an `image` but no `dockerfile`, fall back to image source —
          // this branch isn't hit by the current catalog but is kept as
          // a safety net for future infra entries.
          const source = svc.dockerfile
            ? { repo: this.githubRepo }
            : svc.image
              ? { image: svc.image }
              : null;
          if (!source) {
            throw new Error(`Service "${svc.name}" has neither a dockerfile nor an image.`);
          }
          return this.client.createService({
            projectId: this.projectId,
            name: svc.name,
            source,
            // Only pass branch for repo-based services; image-based
            // services don't have a branch concept.
            branch: svc.dockerfile ? this.branch : undefined,
          });
        },
        { service: svc.name },
      );
      this.serviceIds.set(svc.name, created.id);

      // ── Configure (dockerfile path, start command, healthcheck, restart)
      await this._step(
        'service-config',
        `Configuring service "${svc.name}"`,
        async () => {
          const isJob = JOB_SERVICES.includes(svc);
          await this.client.updateServiceInstance({
            serviceId: created.id,
            environmentId: this.defaultEnvironmentId,
            // All our Dockerfiles expect the monorepo root as the build
            // context (they COPY apps/<name>/... and packages/shared/...),
            // so rootDirectory is always '.' regardless of service.
            rootDirectory: '.',
            dockerfilePath: svc.dockerfile ?? undefined,
            startCommand: svc.start_command ?? undefined,
            healthcheckPath: svc.healthcheck ?? undefined,
            // Jobs run once and exit on purpose — don't restart them.
            // App services get the same ON_FAILURE policy as the
            // generated railway/*.json configs.
            restartPolicyType: isJob ? 'NEVER' : 'ON_FAILURE',
            restartPolicyMaxRetries: isJob ? undefined : 10,
          });
        },
        { service: svc.name },
      );

      // ── Variables
      await this._step(
        'service-vars',
        `Setting variables for "${svc.name}"`,
        async () => {
          const variables = buildServiceVariables(svc, varContext);
          if (Object.keys(variables).length === 0) {
            // Nothing to set — frontend/site/voice-agent fall in this
            // bucket. Skip the API call entirely.
            return;
          }
          await this.client.upsertVariables({
            projectId: this.projectId,
            environmentId: this.defaultEnvironmentId,
            serviceId: created.id,
            variables,
            // skipDeploys=true (default in the client) because we trigger
            // exactly one deploy per service at the end of the run.
            skipDeploys: true,
          });
        },
        { service: svc.name },
      );
    }
  }

  // ─── Phase 5: trigger deploys ──────────────────────────────────────
  async _phaseDeploy() {
    for (const svc of this.plan) {
      const serviceId = this.serviceIds.get(svc.name);
      if (!serviceId) continue; // shouldn't happen, but be defensive
      await this._step(
        'deploy-trigger',
        `Triggering deploy for "${svc.name}"`,
        async () => {
          await this.client.triggerDeploy({
            projectId: this.projectId,
            environmentId: this.defaultEnvironmentId,
            serviceId,
          });
        },
        { service: svc.name },
      );
    }
  }

  // ─── Public entry point ────────────────────────────────────────────
  async run() {
    // Build the plan once so _phaseServices and _phaseDeploy iterate the
    // exact same list in the exact same order.
    this.plan = buildDeployPlan();

    // Total progress steps = 2 (validate: compat + whoami)
    //                      + 1 (project)
    //                      + 1 (plugin prompt)
    //                      + 3 * plan.length (create + config + vars per service)
    //                      + plan.length (deploy trigger per service)
    //                      + 1 (done).
    // The caller uses these for a progress bar; the exact number doesn't
    // need to match Railway's own internals, it just needs to be stable.
    this.total = 2 + 1 + 1 + 4 * this.plan.length + 1;
    this.step = 0;

    await this._phaseValidate();
    await this._phaseProject();
    await this._phasePluginPrompt();
    await this._phaseServices();
    await this._phaseDeploy();

    const summary = {
      projectId: this.projectId,
      environmentId: this.defaultEnvironmentId,
      servicesCreated: this.serviceIds.size,
      servicesConfigured: this.serviceIds.size,
      servicesDeployed: this.serviceIds.size,
    };

    this.step += 1;
    this._emit({
      phase: 'done',
      step: this.step,
      total: this.total,
      message: `Deployed ${summary.servicesCreated} services to project ${this.projectId}`,
      ok: true,
      summary,
    });

    return summary;
  }
}
