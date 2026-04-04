import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mic, Volume2, Video, Settings, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeviceSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  // Device lists from useDevices hook
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  // Current selections
  selectedMicId: string | null;
  selectedSpeakerId: string | null;
  selectedCameraId: string | null;
  // Callbacks
  onSelectMic: (deviceId: string) => void;
  onSelectSpeaker: (deviceId: string) => void;
  onSelectCamera: (deviceId: string) => void;
  onRequestPermissions: () => Promise<boolean>;
  hasPermission: boolean;
}

export function DeviceSettingsDialog({
  open,
  onClose,
  audioInputs,
  audioOutputs,
  videoInputs,
  selectedMicId,
  selectedSpeakerId,
  selectedCameraId,
  onSelectMic,
  onSelectSpeaker,
  onSelectCamera,
  onRequestPermissions,
  hasPermission,
}: DeviceSettingsDialogProps) {
  const [micLevel, setMicLevel] = useState(0);
  const [testingSound, setTestingSound] = useState(false);
  const [requestingPermissions, setRequestingPermissions] = useState(false);

  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micAnimFrameRef = useRef<number | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);

  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Clean up all streams and audio contexts
  const cleanupMic = useCallback(() => {
    if (micAnimFrameRef.current != null) {
      cancelAnimationFrame(micAnimFrameRef.current);
      micAnimFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (micAudioCtxRef.current && micAudioCtxRef.current.state !== 'closed') {
      micAudioCtxRef.current.close().catch(() => {});
      micAudioCtxRef.current = null;
    }
    micAnalyserRef.current = null;
    setMicLevel(0);
  }, []);

  const cleanupCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start mic level monitoring
  useEffect(() => {
    if (!open || !hasPermission || !selectedMicId) {
      cleanupMic();
      return;
    }

    let cancelled = false;

    async function startMicMonitor() {
      cleanupMic();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: selectedMicId! } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        micStreamRef.current = stream;

        const audioCtx = new AudioContext();
        micAudioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        micAnalyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        function tick() {
          if (cancelled || !micAnalyserRef.current) return;
          micAnalyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i]!;
          }
          const avg = sum / dataArray.length;
          setMicLevel(Math.min(avg / 128, 1));
          micAnimFrameRef.current = requestAnimationFrame(tick);
        }

        tick();
      } catch (err) {
        console.warn('Failed to open mic for level monitoring:', err);
      }
    }

    startMicMonitor();

    return () => {
      cancelled = true;
      cleanupMic();
    };
  }, [open, hasPermission, selectedMicId, cleanupMic]);

  // Start camera preview
  useEffect(() => {
    if (!open || !hasPermission || !selectedCameraId) {
      cleanupCamera();
      return;
    }

    let cancelled = false;

    async function startCamera() {
      cleanupCamera();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: selectedCameraId! } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn('Failed to open camera for preview:', err);
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      cleanupCamera();
    };
  }, [open, hasPermission, selectedCameraId, cleanupCamera]);

  // Clean everything on close
  useEffect(() => {
    if (!open) {
      cleanupMic();
      cleanupCamera();
    }
  }, [open, cleanupMic, cleanupCamera]);

  const handleTestSpeaker = async () => {
    if (testingSound) return;
    setTestingSound(true);
    try {
      const ctx = new AudioContext();
      // Attempt to route to selected speaker
      if (selectedSpeakerId && 'setSinkId' in ctx) {
        try {
          await (ctx as any).setSinkId(selectedSpeakerId);
        } catch {
          // setSinkId not supported or failed; fall through to default output
        }
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
      await new Promise((resolve) => setTimeout(resolve, 600));
      ctx.close().catch(() => {});
    } catch (err) {
      console.warn('Failed to play test tone:', err);
    } finally {
      setTestingSound(false);
    }
  };

  const handleRequestPermissions = async () => {
    setRequestingPermissions(true);
    try {
      await onRequestPermissions();
    } finally {
      setRequestingPermissions(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-zinc-400" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Device Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Permission request */}
          {!hasPermission && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
              <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Permissions required
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Grant microphone and camera access to configure your devices.
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

          {/* Microphone */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              <Mic className="h-4 w-4 text-zinc-400" />
              Microphone
            </label>
            <select
              value={selectedMicId ?? ''}
              onChange={(e) => onSelectMic(e.target.value)}
              disabled={!hasPermission || audioInputs.length === 0}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-primary-400 dark:focus:border-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {audioInputs.length === 0 && (
                <option value="">No microphones found</option>
              )}
              {audioInputs.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone (${device.deviceId.slice(0, 8)}...)`}
                </option>
              ))}
            </select>
            {/* Mic level bar */}
            {hasPermission && selectedMicId && (
              <div className="mt-2 h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-[width] duration-75"
                  style={{ width: `${micLevel * 100}%` }}
                />
              </div>
            )}
          </div>

          {/* Speaker */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              <Volume2 className="h-4 w-4 text-zinc-400" />
              Speaker
            </label>
            <div className="flex gap-2">
              <select
                value={selectedSpeakerId ?? ''}
                onChange={(e) => onSelectSpeaker(e.target.value)}
                disabled={!hasPermission || audioOutputs.length === 0}
                className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-primary-400 dark:focus:border-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {audioOutputs.length === 0 && (
                  <option value="">No speakers found</option>
                )}
                {audioOutputs.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Speaker (${device.deviceId.slice(0, 8)}...)`}
                  </option>
                ))}
              </select>
              <button
                onClick={handleTestSpeaker}
                disabled={!hasPermission || testingSound}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  'border border-zinc-200 dark:border-zinc-700',
                  'text-zinc-700 dark:text-zinc-300',
                  'hover:bg-zinc-50 dark:hover:bg-zinc-800',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {testingSound ? 'Playing...' : 'Test'}
              </button>
            </div>
          </div>

          {/* Camera */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              <Video className="h-4 w-4 text-zinc-400" />
              Camera
            </label>
            <select
              value={selectedCameraId ?? ''}
              onChange={(e) => onSelectCamera(e.target.value)}
              disabled={!hasPermission || videoInputs.length === 0}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-primary-400 dark:focus:border-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {videoInputs.length === 0 && (
                <option value="">No cameras found</option>
              )}
              {videoInputs.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera (${device.deviceId.slice(0, 8)}...)`}
                </option>
              ))}
            </select>
            {/* Camera preview */}
            {hasPermission && selectedCameraId && (
              <div className="mt-2 rounded-lg overflow-hidden bg-black aspect-video max-h-48">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
