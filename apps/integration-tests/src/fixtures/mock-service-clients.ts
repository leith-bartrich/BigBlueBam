// ---------------------------------------------------------------------------
// In-process mock service clients
// ---------------------------------------------------------------------------
//
// Wave 3 scaffold: these clients are NOT real HTTP clients. They simulate the
// Bam / Bond / Bolt / Beacon service surface area well enough to drive a
// smoke test that walks a multi-hop event chain end-to-end without requiring
// a live docker compose stack.
//
// When Wave 4 wires up a real integration stack, swap each `Mock*Client`
// with a thin fetch wrapper pointed at the compose-provided internal URL
// (BAM_API_INTERNAL_URL, BOND_API_INTERNAL_URL, etc.) and keep the
// interface contracts identical so the tests do not need to change.

export interface BoltEventIngest {
  event_type: string;
  source: string;
  payload: Record<string, unknown>;
  organization_id: string;
  actor_id?: string;
  actor_type?: 'user' | 'agent' | 'system';
  timestamp: string;
}

export interface BoltAutomation {
  id: string;
  organization_id: string;
  trigger_event: string;
  trigger_source: string;
  enabled: boolean;
  actions: {
    mcp_tool: string;
    parameters: Record<string, unknown>;
  }[];
}

export interface BoltExecution {
  id: string;
  automation_id: string;
  event: BoltEventIngest;
  matched: boolean;
  actions_run: string[];
  status: 'success' | 'failure' | 'skipped';
}

export class MockBoltClient {
  private readonly automations: BoltAutomation[] = [];
  private readonly executions: BoltExecution[] = [];
  private idCounter = 0;

  registerAutomation(
    automation: Omit<BoltAutomation, 'id' | 'enabled'> & { enabled?: boolean },
  ): BoltAutomation {
    this.idCounter += 1;
    const id = `aut_${this.idCounter}`;
    const row: BoltAutomation = {
      id,
      enabled: automation.enabled ?? true,
      organization_id: automation.organization_id,
      trigger_event: automation.trigger_event,
      trigger_source: automation.trigger_source,
      actions: automation.actions,
    };
    this.automations.push(row);
    return row;
  }

  /**
   * Simulate POST /v1/events/ingest: match the event against enabled
   * automations and execute their actions against the provided action
   * dispatcher. Returns the execution record for assertion.
   */
  async ingest(
    event: BoltEventIngest,
    dispatchAction: (tool: string, params: Record<string, unknown>) => Promise<void>,
  ): Promise<BoltExecution[]> {
    const matched = this.automations.filter(
      (a) =>
        a.enabled &&
        a.organization_id === event.organization_id &&
        a.trigger_event === event.event_type &&
        a.trigger_source === event.source,
    );

    const results: BoltExecution[] = [];
    for (const automation of matched) {
      this.idCounter += 1;
      const execId = `exe_${this.idCounter}`;
      const actionsRun: string[] = [];
      let status: BoltExecution['status'] = 'success';
      try {
        for (const action of automation.actions) {
          await dispatchAction(action.mcp_tool, action.parameters);
          actionsRun.push(action.mcp_tool);
        }
      } catch {
        status = 'failure';
      }
      const exec: BoltExecution = {
        id: execId,
        automation_id: automation.id,
        event,
        matched: true,
        actions_run: actionsRun,
        status,
      };
      this.executions.push(exec);
      results.push(exec);
    }
    return results;
  }

  listExecutions(): readonly BoltExecution[] {
    return this.executions;
  }
}

export interface BamTask {
  id: string;
  organization_id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
  created_by: string;
}

export class MockBamClient {
  private readonly tasks: BamTask[] = [];
  private idCounter = 0;
  constructor(private readonly onEvent: (event: BoltEventIngest) => Promise<void>) {}

  async createTask(input: {
    organization_id: string;
    title: string;
    created_by: string;
  }): Promise<BamTask> {
    this.idCounter += 1;
    const task: BamTask = {
      id: `tsk_${this.idCounter}`,
      organization_id: input.organization_id,
      title: input.title,
      status: 'todo',
      created_by: input.created_by,
    };
    this.tasks.push(task);
    await this.onEvent({
      event_type: 'task.created',
      source: 'bam',
      payload: {
        'task.id': task.id,
        'task.title': task.title,
        'task.created_by': task.created_by,
      },
      organization_id: task.organization_id,
      actor_id: task.created_by,
      actor_type: 'user',
      timestamp: new Date().toISOString(),
    });
    return task;
  }
}

export interface BondActivity {
  id: string;
  organization_id: string;
  kind: string;
  subject_task_id: string;
  actor_id: string;
}

export class MockBondClient {
  private readonly activities: BondActivity[] = [];
  private idCounter = 0;
  constructor(private readonly onEvent: (event: BoltEventIngest) => Promise<void>) {}

  async logActivityForTask(input: {
    organization_id: string;
    task_id: string;
    actor_id: string;
  }): Promise<BondActivity> {
    this.idCounter += 1;
    const activity: BondActivity = {
      id: `act_${this.idCounter}`,
      organization_id: input.organization_id,
      kind: 'task_reference',
      subject_task_id: input.task_id,
      actor_id: input.actor_id,
    };
    this.activities.push(activity);
    await this.onEvent({
      event_type: 'activity.logged',
      source: 'bond',
      payload: {
        'activity.id': activity.id,
        'activity.kind': activity.kind,
        'activity.subject_task_id': activity.subject_task_id,
      },
      organization_id: activity.organization_id,
      actor_id: activity.actor_id,
      actor_type: 'user',
      timestamp: new Date().toISOString(),
    });
    return activity;
  }

  listActivities(): readonly BondActivity[] {
    return this.activities;
  }
}

export interface BeaconEntry {
  id: string;
  organization_id: string;
  title: string;
  body: string;
  created_by: string;
}

export class MockBeaconClient {
  private readonly entries: BeaconEntry[] = [];
  private idCounter = 0;

  async createEntry(input: {
    organization_id: string;
    title: string;
    body: string;
    created_by: string;
  }): Promise<BeaconEntry> {
    this.idCounter += 1;
    const entry: BeaconEntry = {
      id: `bcn_${this.idCounter}`,
      organization_id: input.organization_id,
      title: input.title,
      body: input.body,
      created_by: input.created_by,
    };
    this.entries.push(entry);
    return entry;
  }

  listEntries(): readonly BeaconEntry[] {
    return this.entries;
  }
}
