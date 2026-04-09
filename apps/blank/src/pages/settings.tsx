interface SettingsPageProps {
  onNavigate: (path: string) => void;
}

export function SettingsPage({ onNavigate }: SettingsPageProps) {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">Configure Blank form defaults and preferences.</p>
      </div>

      <div className="space-y-6">
        {/* Default Settings */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Defaults</h2>
          <div className="space-y-2">
            <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Default Form Type</div>
                  <div className="text-xs text-zinc-500">New forms default to this type.</div>
                </div>
                <span className="text-sm font-mono text-zinc-600 dark:text-zinc-400">public</span>
              </div>
            </div>
            <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Default Theme Color</div>
                  <div className="text-xs text-zinc-500">Brand color applied to new forms.</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-primary-600" />
                  <span className="text-sm font-mono text-zinc-600 dark:text-zinc-400">#3b82f6</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Rate Limiting */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Rate Limiting</h2>
          <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Public Form Rate Limit</div>
                <div className="text-xs text-zinc-500">Max submissions per IP per hour for public forms.</div>
              </div>
              <span className="text-sm font-mono text-zinc-600 dark:text-zinc-400">10 per hour</span>
            </div>
          </div>
        </section>

        {/* Integrations */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Integrations</h2>
          <p className="text-sm text-zinc-500 mb-4">Form submissions emit events that can trigger Bolt automations.</p>
          <div className="space-y-2">
            <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">blank.submission.created</div>
              <div className="text-xs text-zinc-500">Fired when a new submission is received. Route to Bond, Helpdesk, Bam, or Banter via Bolt.</div>
            </div>
            <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">blank.form.published</div>
              <div className="text-xs text-zinc-500">Fired when a form is published.</div>
            </div>
            <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">blank.form.closed</div>
              <div className="text-xs text-zinc-500">Fired when a form is closed.</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
