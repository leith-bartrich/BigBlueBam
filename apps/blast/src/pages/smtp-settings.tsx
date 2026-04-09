import { Server } from 'lucide-react';

export function SmtpSettingsPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">SMTP Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">Configure your outbound SMTP relay for sending campaigns</p>
      </div>

      <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
            <Server className="h-5 w-5 text-zinc-500" />
          </div>
          <div>
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">SMTP Configuration</h3>
            <p className="text-xs text-zinc-500">Set via environment variables on the blast-api service</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">SMTP Host</label>
            <input
              type="text"
              disabled
              placeholder="Set via SMTP_HOST env var"
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-sm text-zinc-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">SMTP Port</label>
            <input
              type="text"
              disabled
              placeholder="587 (default)"
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-sm text-zinc-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">SMTP User</label>
            <input
              type="text"
              disabled
              placeholder="Set via SMTP_USER env var"
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-sm text-zinc-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">SMTP Password</label>
            <input
              type="password"
              disabled
              placeholder="Set via SMTP_PASS env var"
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-sm text-zinc-500 cursor-not-allowed"
            />
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            SMTP settings are configured via environment variables on the blast-api Docker service.
            Supported providers: Amazon SES, Postmark, Mailgun, SendGrid, or any standard SMTP relay.
          </p>
        </div>
      </div>
    </div>
  );
}
