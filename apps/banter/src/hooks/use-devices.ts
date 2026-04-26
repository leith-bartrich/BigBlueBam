import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEYS = {
  mic: "banter-mic-device",
  speaker: "banter-speaker-device",
  camera: "banter-camera-device",
} as const;

interface UseDevicesReturn {
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  selectedMicId: string | null;
  selectedSpeakerId: string | null;
  selectedCameraId: string | null;
  setSelectedMic: (deviceId: string) => void;
  setSelectedSpeaker: (deviceId: string) => void;
  setSelectedCamera: (deviceId: string) => void;
  requestPermissions: () => Promise<boolean>;
  hasPermission: boolean;
}

function loadStoredDevice(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storeDevice(key: string, deviceId: string): void {
  try {
    localStorage.setItem(key, deviceId);
  } catch {
    // localStorage may be unavailable (e.g., private browsing quota exceeded)
  }
}

export function useDevices(): UseDevicesReturn {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [hasPermission, setHasPermission] = useState(false);

  const [selectedMicId, setSelectedMicId] = useState<string | null>(
    () => loadStoredDevice(STORAGE_KEYS.mic),
  );
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string | null>(
    () => loadStoredDevice(STORAGE_KEYS.speaker),
  );
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(
    () => loadStoredDevice(STORAGE_KEYS.camera),
  );

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const enumerateDevices = useCallback(async () => {
    // navigator.mediaDevices is `undefined` in non-secure contexts (plain
    // HTTP on iPad Safari, Android Chrome, etc). Calling .enumerateDevices()
    // on that throws "undefined is not an object" and unmounts the React
    // root via our error boundary. Bail cleanly on those browsers.
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      if (!mountedRef.current) return;

      const mics = devices.filter((d) => d.kind === "audioinput");
      const speakers = devices.filter((d) => d.kind === "audiooutput");
      const cameras = devices.filter((d) => d.kind === "videoinput");

      setAudioInputs(mics);
      setAudioOutputs(speakers);
      setVideoInputs(cameras);

      // If any device has a non-empty label, permissions have been granted
      const granted = devices.some((d) => d.label !== "");
      setHasPermission(granted);
    } catch (err) {
      console.error("[useDevices] Failed to enumerate devices:", err);
    }
  }, []);

  // Initial enumeration and devicechange listener
  useEffect(() => {
    enumerateDevices();

    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : null;
    if (!md || typeof md.addEventListener !== "function") {
      return;
    }

    const handleDeviceChange = () => {
      enumerateDevices();
    };

    md.addEventListener("devicechange", handleDeviceChange);

    return () => {
      md.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [enumerateDevices]);

  const setSelectedMic = useCallback((deviceId: string) => {
    setSelectedMicId(deviceId);
    storeDevice(STORAGE_KEYS.mic, deviceId);
  }, []);

  const setSelectedSpeaker = useCallback((deviceId: string) => {
    setSelectedSpeakerId(deviceId);
    storeDevice(STORAGE_KEYS.speaker, deviceId);
  }, []);

  const setSelectedCamera = useCallback((deviceId: string) => {
    setSelectedCameraId(deviceId);
    storeDevice(STORAGE_KEYS.camera, deviceId);
  }, []);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      // Insecure context (plain HTTP) or feature-locked browser. The caller
      // is the call-join UI; surface the missing-permission state instead
      // of throwing.
      if (mountedRef.current) setHasPermission(false);
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      // Stop all tracks immediately; we only needed the permission prompt
      for (const track of stream.getTracks()) {
        track.stop();
      }

      if (!mountedRef.current) return true;

      setHasPermission(true);

      // Re-enumerate to get device labels now that permission is granted
      await enumerateDevices();

      return true;
    } catch (err) {
      console.warn("[useDevices] Permission denied or error:", err);

      // Try audio-only if video was denied
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });

        for (const track of audioStream.getTracks()) {
          track.stop();
        }

        if (!mountedRef.current) return false;

        setHasPermission(true);
        await enumerateDevices();

        return true;
      } catch {
        if (mountedRef.current) {
          setHasPermission(false);
        }
        return false;
      }
    }
  }, [enumerateDevices]);

  return {
    audioInputs,
    audioOutputs,
    videoInputs,
    selectedMicId,
    selectedSpeakerId,
    selectedCameraId,
    setSelectedMic,
    setSelectedSpeaker,
    setSelectedCamera,
    requestPermissions,
    hasPermission,
  };
}
