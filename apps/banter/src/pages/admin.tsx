import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Video,
  MessageSquare,
  Bot,
  Hash,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AdminPageProps {
  onNavigate: (path: string) => void;
}

interface AdminSettings {
  // Voice & Video
  voice_video_enabled: boolean;
  livekit_host: string;
  livekit_api_key: string;
  livekit_api_secret: string;

  // Channel settings
  default_channel: string;
  allow_channel_creation: 'everyone' | 'admins' | 'org_owners';

  // Message settings
  message_retention_days: number;
  max_file_size_mb: number;

  // AI settings
  voice_agent_enabled: boolean;
  stt_provider: string;
  tts_provider: string;
}

const DEFAULT_SETTINGS: AdminSettings = {
  voice_video_enabled: false,
  livekit_host: '',
  livekit_api_key: '',
  livekit_api_secret: '',
  default_channel: 'general',
  allow_channel_creation: 'everyone',
  message_retention_days: 0,
  max_file_size_mb: 25,
  voice_agent_enabled: false,
  stt_provider: 'none',
  tts_provider: 'none',
};

export function AdminPage({ onNavigate }: AdminPageProps) {
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testingLiveKit, setTestingLiveKit] = useState(false);
  const [liveKitStatus, setLiveKitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    api
      .get<{ data: AdminSettings }>('/admin/settings')
      .then((res) => {
        setSettings({ ...DEFAULT_SETTINGS, ...res.data });
      })
      .catch(() => {
        // Use defaults if settings haven't been configured yet
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.patch('/admin/settings', settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestLiveKit = async () => {
    setTestingLiveKit(true);
    setLiveKitStatus('idle');
    try {
      await api.post('/admin/settings/test-livekit', {
        host: settings.livekit_host,
        api_key: settings.livekit_api_key,
        api_secret: settings.livekit_api_secret,
      });
      setLiveKitStatus('success');
    } catch {
      setLiveKitStatus('error');
    } finally {
      setTestingLiveKit(false);
      setTimeout(() => setLiveKitStatus('idle'), 5000);
    }
  };

  const update = <K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 h-14 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
        <button
          onClick={() => onNavigate('/channels/general')}
          className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Banter Administration
        </h2>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
          {/* Voice & Video Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Video className="h-5 w-5 text-zinc-500" />
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Voice & Video
              </h3>
            </div>

            <div className="space-y-4 pl-7">
              <ToggleField
                label="Enable voice & video calls"
                description="Requires a LiveKit server to be configured"
                checked={settings.voice_video_enabled}
                onChange={(v) => update('voice_video_enabled', v)}
              />

              {settings.voice_video_enabled && (
                <>
                  <InputField
                    label="LiveKit Host"
                    placeholder="wss://livekit.example.com"
                    value={settings.livekit_host}
                    onChange={(v) => update('livekit_host', v)}
                  />
                  <InputField
                    label="LiveKit API Key"
                    placeholder="APIxxxxxxxx"
                    value={settings.livekit_api_key}
                    onChange={(v) => update('livekit_api_key', v)}
                  />
                  <InputField
                    label="LiveKit API Secret"
                    placeholder="Enter secret..."
                    value={settings.livekit_api_secret}
                    onChange={(v) => update('livekit_api_secret', v)}
                    type="password"
                  />

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleTestLiveKit}
                      disabled={testingLiveKit || !settings.livekit_host}
                      className={cn(
                        'px-3 py-1.5 text-sm rounded-md font-medium transition-colors',
                        'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
                        'hover:bg-zinc-200 dark:hover:bg-zinc-700',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                    >
                      {testingLiveKit ? (
                        <span className="flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Testing...
                        </span>
                      ) : (
                        'Test Connection'
                      )}
                    </button>
                    {liveKitStatus === 'success' && (
                      <span className="flex items-center gap-1 text-sm text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        Connected
                      </span>
                    )}
                    {liveKitStatus === 'error' && (
                      <span className="flex items-center gap-1 text-sm text-red-600">
                        <AlertCircle className="h-4 w-4" />
                        Connection failed
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>

          <hr className="border-zinc-200 dark:border-zinc-700" />

          {/* Channel Settings */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Hash className="h-5 w-5 text-zinc-500" />
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Channel Settings
              </h3>
            </div>

            <div className="space-y-4 pl-7">
              <InputField
                label="Default Channel"
                placeholder="general"
                value={settings.default_channel}
                onChange={(v) => update('default_channel', v)}
              />

              <SelectField
                label="Who can create channels"
                value={settings.allow_channel_creation}
                onChange={(v) => update('allow_channel_creation', v as AdminSettings['allow_channel_creation'])}
                options={[
                  { value: 'everyone', label: 'Everyone' },
                  { value: 'admins', label: 'Admins only' },
                  { value: 'org_owners', label: 'Organization owners only' },
                ]}
              />
            </div>
          </section>

          <hr className="border-zinc-200 dark:border-zinc-700" />

          {/* Message Settings */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-5 w-5 text-zinc-500" />
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Message Settings
              </h3>
            </div>

            <div className="space-y-4 pl-7">
              <InputField
                label="Message retention (days)"
                description="0 = keep forever"
                placeholder="0"
                value={String(settings.message_retention_days)}
                onChange={(v) => update('message_retention_days', parseInt(v, 10) || 0)}
                type="number"
              />

              <InputField
                label="Max file upload size (MB)"
                placeholder="25"
                value={String(settings.max_file_size_mb)}
                onChange={(v) => update('max_file_size_mb', parseInt(v, 10) || 25)}
                type="number"
              />
            </div>
          </section>

          <hr className="border-zinc-200 dark:border-zinc-700" />

          {/* AI Settings */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Bot className="h-5 w-5 text-zinc-500" />
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                AI & Voice Agent
              </h3>
            </div>

            <div className="space-y-4 pl-7">
              <ToggleField
                label="Enable voice agent"
                description="Allow AI agents to participate in calls with spoken audio"
                checked={settings.voice_agent_enabled}
                onChange={(v) => update('voice_agent_enabled', v)}
              />

              {settings.voice_agent_enabled && (
                <>
                  <SelectField
                    label="Speech-to-Text provider"
                    value={settings.stt_provider}
                    onChange={(v) => update('stt_provider', v)}
                    options={[
                      { value: 'none', label: 'None (text-only mode)' },
                      { value: 'whisper', label: 'Whisper (self-hosted)' },
                      { value: 'deepgram', label: 'Deepgram' },
                      { value: 'google', label: 'Google Cloud STT' },
                      { value: 'openai', label: 'OpenAI Whisper API' },
                    ]}
                  />

                  <SelectField
                    label="Text-to-Speech provider"
                    value={settings.tts_provider}
                    onChange={(v) => update('tts_provider', v)}
                    options={[
                      { value: 'none', label: 'None (text-only mode)' },
                      { value: 'piper', label: 'Piper (self-hosted)' },
                      { value: 'elevenlabs', label: 'ElevenLabs' },
                      { value: 'google', label: 'Google Cloud TTS' },
                      { value: 'openai', label: 'OpenAI TTS' },
                    ]}
                  />
                </>
              )}
            </div>
          </section>

          {/* Save button */}
          <div className="flex items-center gap-3 pt-4 pb-8">
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors',
                'bg-primary-600 text-white hover:bg-primary-700',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? 'Saving...' : 'Save Settings'}
            </button>

            {saved && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                Settings saved
              </span>
            )}

            {error && (
              <span className="flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {error}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable field components
// ---------------------------------------------------------------------------

function InputField({
  label,
  description,
  placeholder,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  description?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
        {label}
      </label>
      {description && (
        <p className="text-xs text-zinc-500 mb-1">{description}</p>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full px-3 py-2 rounded-md text-sm',
          'border border-zinc-300 dark:border-zinc-600',
          'bg-white dark:bg-zinc-800',
          'text-zinc-900 dark:text-zinc-100',
          'placeholder:text-zinc-400',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
        )}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full px-3 py-2 rounded-md text-sm',
          'border border-zinc-300 dark:border-zinc-600',
          'bg-white dark:bg-zinc-800',
          'text-zinc-900 dark:text-zinc-100',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
          checked ? 'bg-primary-600' : 'bg-zinc-300 dark:bg-zinc-600',
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
      <div>
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
        {description && (
          <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}
