import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Sun, Moon, Monitor, Mic, Volume2, Video, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useDevices } from '@/hooks/use-devices';

interface PreferencesPageProps {
  onNavigate: (path: string) => void;
}

interface UserPreferences {
  notification_sound: boolean;
  desktop_notifications: boolean;
  enter_to_send: boolean;
  show_typing_indicators: boolean;
  compact_mode: boolean;
  auto_mute: boolean;
  auto_camera: boolean;
  noise_suppression: boolean;
  echo_cancellation: boolean;
}

export function PreferencesPage({ onNavigate }: PreferencesPageProps) {
  const user = useAuthStore((s) => s.user);
  const [theme, setTheme] = useState(() => localStorage.getItem('bbam-theme') ?? 'system');
  const [prefs, setPrefs] = useState<UserPreferences>({
    notification_sound: true,
    desktop_notifications: true,
    enter_to_send: true,
    show_typing_indicators: true,
    compact_mode: false,
    auto_mute: false,
    auto_camera: true,
    noise_suppression: true,
    echo_cancellation: true,
  });
  const [saving, setSaving] = useState(false);

  // Device state
  const { audioInputs, audioOutputs, videoInputs, hasPermission, requestPermissions } = useDevices();
  const [selectedMicId, setSelectedMicId] = useState<string>(
    () => localStorage.getItem('banter-mic-device') ?? '',
  );
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>(
    () => localStorage.getItem('banter-speaker-device') ?? '',
  );
  const [selectedCameraId, setSelectedCameraId] = useState<string>(
    () => localStorage.getItem('banter-camera-device') ?? '',
  );
  const [requestingPermissions, setRequestingPermissions] = useState(false);

  // Load preferences from API
  useEffect(() => {
    api
      .get<{ data: UserPreferences }>('/me/preferences')
      .then((res) => setPrefs(res.data))
      .catch(() => {
        // Use defaults
      });
  }, []);

  // Load audio/video toggle prefs from localStorage on mount
  useEffect(() => {
    const autoMute = localStorage.getItem('banter-auto-mute');
    const autoCamera = localStorage.getItem('banter-auto-camera');
    const noiseSuppression = localStorage.getItem('banter-noise-suppression');
    const echoCancellation = localStorage.getItem('banter-echo-cancellation');
    setPrefs((prev) => ({
      ...prev,
      ...(autoMute != null && { auto_mute: autoMute === 'true' }),
      ...(autoCamera != null && { auto_camera: autoCamera === 'true' }),
      ...(noiseSuppression != null && { noise_suppression: noiseSuppression === 'true' }),
      ...(echoCancellation != null && { echo_cancellation: echoCancellation === 'true' }),
    }));
  }, []);

  // Auto-select first available device when lists populate
  useEffect(() => {
    if (!selectedMicId && audioInputs.length > 0) {
      setSelectedMicId(audioInputs[0]!.deviceId);
    }
  }, [audioInputs, selectedMicId]);

  useEffect(() => {
    if (!selectedSpeakerId && audioOutputs.length > 0) {
      setSelectedSpeakerId(audioOutputs[0]!.deviceId);
    }
  }, [audioOutputs, selectedSpeakerId]);

  useEffect(() => {
    if (!selectedCameraId && videoInputs.length > 0) {
      setSelectedCameraId(videoInputs[0]!.deviceId);
    }
  }, [videoInputs, selectedCameraId]);

  const handleSelectMic = useCallback((deviceId: string) => {
    setSelectedMicId(deviceId);
    localStorage.setItem('banter-mic-device', deviceId);
  }, []);

  const handleSelectSpeaker = useCallback((deviceId: string) => {
    setSelectedSpeakerId(deviceId);
    localStorage.setItem('banter-speaker-device', deviceId);
  }, []);

  const handleSelectCamera = useCallback((deviceId: string) => {
    setSelectedCameraId(deviceId);
    localStorage.setItem('banter-camera-device', deviceId);
  }, []);

  const handleRequestPermissions = useCallback(async () => {
    setRequestingPermissions(true);
    try {
      await requestPermissions();
    } finally {
      setRequestingPermissions(false);
    }
  }, [requestPermissions]);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('bbam-theme', newTheme);
    const root = document.documentElement;
    root.classList.remove('dark');
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else if (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Persist audio/video toggles to localStorage
      localStorage.setItem('banter-auto-mute', String(prefs.auto_mute));
      localStorage.setItem('banter-auto-camera', String(prefs.auto_camera));
      localStorage.setItem('banter-noise-suppression', String(prefs.noise_suppression));
      localStorage.setItem('banter-echo-cancellation', String(prefs.echo_cancellation));
      await api.patch('/me/preferences', prefs);
    } catch (err) {
      console.error('Failed to save preferences:', err);
    } finally {
      setSaving(false);
    }
  };

  const updatePref = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-6 h-14 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
        <button
          onClick={() => onNavigate('/channels/general')}
          className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Preferences</h2>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-xl mx-auto px-6 py-8 space-y-8">
          {/* Profile section */}
          <section>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Profile
            </h3>
            <div className="flex items-center gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50">
              <div className="h-12 w-12 rounded-xl bg-primary-600 flex items-center justify-center text-white text-lg font-bold">
                {user?.display_name?.slice(0, 2).toUpperCase() ?? '?'}
              </div>
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {user?.display_name}
                </p>
                <p className="text-sm text-zinc-500">{user?.email}</p>
              </div>
            </div>
          </section>

          {/* Theme */}
          <section>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Theme
            </h3>
            <div className="flex gap-2">
              {[
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
                { value: 'system', label: 'System', icon: Monitor },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => handleThemeChange(value)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors',
                    theme === value
                      ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* Notifications */}
          <section>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Notifications
            </h3>
            <div className="space-y-3">
              <ToggleRow
                label="Desktop notifications"
                description="Show browser notifications for new messages"
                checked={prefs.desktop_notifications}
                onChange={(v) => updatePref('desktop_notifications', v)}
              />
              <ToggleRow
                label="Notification sound"
                description="Play a sound when you receive a message"
                checked={prefs.notification_sound}
                onChange={(v) => updatePref('notification_sound', v)}
              />
            </div>
          </section>

          {/* Messaging */}
          <section>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Messaging
            </h3>
            <div className="space-y-3">
              <ToggleRow
                label="Enter to send"
                description="Press Enter to send messages (Shift+Enter for newline)"
                checked={prefs.enter_to_send}
                onChange={(v) => updatePref('enter_to_send', v)}
              />
              <ToggleRow
                label="Show typing indicators"
                description="See when others are typing"
                checked={prefs.show_typing_indicators}
                onChange={(v) => updatePref('show_typing_indicators', v)}
              />
              <ToggleRow
                label="Compact mode"
                description="Reduce spacing between messages"
                checked={prefs.compact_mode}
                onChange={(v) => updatePref('compact_mode', v)}
              />
            </div>
          </section>

          {/* Audio & Video */}
          <section>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Audio & Video
            </h3>
            <div className="space-y-3">
              {!hasPermission && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                  <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Permissions required
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Grant microphone and camera access to select your devices.
                    </p>
                    <button
                      onClick={handleRequestPermissions}
                      disabled={requestingPermissions}
                      className="mt-3 px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                    >
                      {requestingPermissions ? 'Requesting...' : 'Request Permissions'}
                    </button>
                  </div>
                </div>
              )}
              <SelectRow
                icon={<Mic className="h-4 w-4" />}
                label="Microphone"
                description="Select your audio input device"
                value={selectedMicId}
                onChange={handleSelectMic}
                options={audioInputs.map((d) => ({
                  value: d.deviceId,
                  label: d.label || `Microphone (${d.deviceId.slice(0, 8)}...)`,
                }))}
                disabled={!hasPermission}
                placeholder="No microphones found"
              />
              <SelectRow
                icon={<Volume2 className="h-4 w-4" />}
                label="Speaker"
                description="Select your audio output device"
                value={selectedSpeakerId}
                onChange={handleSelectSpeaker}
                options={audioOutputs.map((d) => ({
                  value: d.deviceId,
                  label: d.label || `Speaker (${d.deviceId.slice(0, 8)}...)`,
                }))}
                disabled={!hasPermission}
                placeholder="No speakers found"
              />
              <SelectRow
                icon={<Video className="h-4 w-4" />}
                label="Camera"
                description="Select your video input device"
                value={selectedCameraId}
                onChange={handleSelectCamera}
                options={videoInputs.map((d) => ({
                  value: d.deviceId,
                  label: d.label || `Camera (${d.deviceId.slice(0, 8)}...)`,
                }))}
                disabled={!hasPermission}
                placeholder="No cameras found"
              />
              <ToggleRow
                label="Auto-join calls muted"
                description="Start calls with your microphone muted"
                checked={prefs.auto_mute}
                onChange={(v) => updatePref('auto_mute', v)}
              />
              <ToggleRow
                label="Auto-enable camera in video calls"
                description="Automatically turn on your camera when joining video calls"
                checked={prefs.auto_camera}
                onChange={(v) => updatePref('auto_camera', v)}
              />
              <ToggleRow
                label="Noise suppression"
                description="Reduce background noise from your microphone"
                checked={prefs.noise_suppression}
                onChange={(v) => updatePref('noise_suppression', v)}
              />
              <ToggleRow
                label="Echo cancellation"
                description="Prevent echo from your speakers feeding back into your microphone"
                checked={prefs.echo_cancellation}
                onChange={(v) => updatePref('echo_cancellation', v)}
              />
            </div>
          </section>

          {/* Save */}
          <div className="pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-primary-600 text-white font-medium text-sm hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50">
      <div>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-10 h-6 rounded-full transition-colors flex-shrink-0',
          checked ? 'bg-primary-600' : 'bg-zinc-300 dark:bg-zinc-600',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-4',
          )}
        />
      </button>
    </div>
  );
}

function SelectRow({
  icon,
  label,
  description,
  value,
  onChange,
  options,
  disabled,
  placeholder,
}: {
  icon?: React.ReactNode;
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50">
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-zinc-400">{icon}</span>}
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
        </div>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || options.length === 0}
        className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-primary-400 dark:focus:border-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {options.length === 0 && (
          <option value="">{placeholder ?? 'No devices found'}</option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
