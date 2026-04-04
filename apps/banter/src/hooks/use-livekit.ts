import { useState, useEffect, useCallback, useRef } from "react";
import {
  Room,
  RoomEvent,
  VideoPresets,
  Track,
  RemoteParticipant,
  LocalParticipant,
  RemoteTrackPublication,
} from "livekit-client";

interface UseLiveKitOptions {
  token: string | null;
  serverUrl?: string;
}

interface UseLiveKitReturn {
  room: Room | null;
  participants: RemoteParticipant[];
  localParticipant: LocalParticipant | null;
  activeSpeakers: string[];
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isConnected: boolean;
  connectionError: string | null;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
  disconnect: () => void;
  setMicrophoneDevice: (deviceId: string) => void;
  setSpeakerDevice: (deviceId: string) => void;
  setCameraDevice: (deviceId: string) => void;
}

const DEFAULT_SERVER_URL = `ws://${window.location.hostname}:7880`;

export function useLiveKit({
  token,
  serverUrl = DEFAULT_SERVER_URL,
}: UseLiveKitOptions): UseLiveKitReturn {
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [localParticipant, setLocalParticipant] =
    useState<LocalParticipant | null>(null);
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const roomRef = useRef<Room | null>(null);

  // Sync room ref for use in callbacks
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const updateParticipants = useCallback((currentRoom: Room) => {
    setParticipants(Array.from(currentRoom.remoteParticipants.values()));
  }, []);

  const updateLocalMediaState = useCallback((currentRoom: Room) => {
    const local = currentRoom.localParticipant;
    setIsMuted(!local.isMicrophoneEnabled);
    setIsCameraOn(local.isCameraEnabled);
    setIsScreenSharing(local.isScreenShareEnabled);
  }, []);

  const attachAudioTrack = useCallback(
    (
      track: RemoteTrackPublication["track"],
      participantIdentity: string,
    ) => {
      if (!track || track.kind !== Track.Kind.Audio) return;

      const mediaStream = new MediaStream([
        track.mediaStreamTrack,
      ]);
      const audioEl = document.createElement("audio");
      audioEl.srcObject = mediaStream;
      audioEl.autoplay = true;
      audioEl.play().catch((err) => {
        console.warn(
          `[useLiveKit] Failed to play audio for ${participantIdentity}:`,
          err,
        );
      });

      const key = `${participantIdentity}:${track.sid}`;
      audioElementsRef.current.set(key, audioEl);
    },
    [],
  );

  const detachAudioTrack = useCallback(
    (
      track: RemoteTrackPublication["track"],
      participantIdentity: string,
    ) => {
      if (!track) return;

      const key = `${participantIdentity}:${track.sid}`;
      const audioEl = audioElementsRef.current.get(key);
      if (audioEl) {
        audioEl.pause();
        audioEl.srcObject = null;
        audioElementsRef.current.delete(key);
      }
    },
    [],
  );

  const cleanupAudioElements = useCallback(() => {
    for (const audioEl of audioElementsRef.current.values()) {
      audioEl.pause();
      audioEl.srcObject = null;
    }
    audioElementsRef.current.clear();
  }, []);

  // Connect/disconnect based on token
  useEffect(() => {
    if (!token) {
      return;
    }

    const newRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
    });

    let cancelled = false;

    const onParticipantConnected = () => {
      if (!cancelled) updateParticipants(newRoom);
    };

    const onParticipantDisconnected = () => {
      if (!cancelled) updateParticipants(newRoom);
    };

    const onTrackSubscribed = (
      track: RemoteTrackPublication["track"],
      _publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (!cancelled) {
        attachAudioTrack(track, participant.identity);
      }
    };

    const onTrackUnsubscribed = (
      track: RemoteTrackPublication["track"],
      _publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (!cancelled) {
        detachAudioTrack(track, participant.identity);
      }
    };

    const onActiveSpeakersChanged = (
      speakers: { identity: string }[],
    ) => {
      if (!cancelled) {
        setActiveSpeakers(speakers.map((s) => s.identity));
      }
    };

    const onLocalTrackPublished = () => {
      if (!cancelled) updateLocalMediaState(newRoom);
    };

    const onLocalTrackUnpublished = () => {
      if (!cancelled) updateLocalMediaState(newRoom);
    };

    const onDisconnected = () => {
      if (!cancelled) {
        setIsConnected(false);
        setParticipants([]);
        setLocalParticipant(null);
        setActiveSpeakers([]);
        setIsMuted(true);
        setIsCameraOn(false);
        setIsScreenSharing(false);
        cleanupAudioElements();
      }
    };

    const onMediaDevicesError = (error: Error) => {
      if (!cancelled) {
        console.error("[useLiveKit] Media devices error:", error);
        setConnectionError(`Device error: ${error.message}`);
      }
    };

    newRoom.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    newRoom.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    newRoom.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    newRoom.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    newRoom.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged);
    newRoom.on(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
    newRoom.on(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
    newRoom.on(RoomEvent.Disconnected, onDisconnected);
    newRoom.on(RoomEvent.MediaDevicesError, onMediaDevicesError);

    setRoom(newRoom);
    setConnectionError(null);

    newRoom
      .connect(serverUrl, token)
      .then(() => {
        if (cancelled) {
          newRoom.disconnect();
          return;
        }

        setIsConnected(true);
        setLocalParticipant(newRoom.localParticipant);
        updateParticipants(newRoom);

        // Enable microphone after connecting
        return newRoom.localParticipant.setMicrophoneEnabled(true);
      })
      .then(() => {
        if (!cancelled) {
          updateLocalMediaState(newRoom);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[useLiveKit] Connection failed:", err);
          setConnectionError(
            err instanceof Error ? err.message : "Connection failed",
          );
          setIsConnected(false);
        }
      });

    return () => {
      cancelled = true;

      newRoom.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      newRoom.off(
        RoomEvent.ParticipantDisconnected,
        onParticipantDisconnected,
      );
      newRoom.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      newRoom.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      newRoom.off(
        RoomEvent.ActiveSpeakersChanged,
        onActiveSpeakersChanged,
      );
      newRoom.off(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
      newRoom.off(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
      newRoom.off(RoomEvent.Disconnected, onDisconnected);
      newRoom.off(RoomEvent.MediaDevicesError, onMediaDevicesError);

      newRoom.disconnect();
      cleanupAudioElements();

      setRoom(null);
      setIsConnected(false);
      setLocalParticipant(null);
      setParticipants([]);
      setActiveSpeakers([]);
    };
  }, [
    token,
    serverUrl,
    updateParticipants,
    updateLocalMediaState,
    attachAudioTrack,
    detachAudioTrack,
    cleanupAudioElements,
  ]);

  const toggleMute = useCallback(() => {
    const currentRoom = roomRef.current;
    if (!currentRoom) return;

    const enabled = currentRoom.localParticipant.isMicrophoneEnabled;
    currentRoom.localParticipant
      .setMicrophoneEnabled(!enabled)
      .then(() => {
        setIsMuted(enabled); // was enabled → now muted
      })
      .catch((err: unknown) => {
        console.error("[useLiveKit] Failed to toggle mute:", err);
      });
  }, []);

  const toggleCamera = useCallback(() => {
    const currentRoom = roomRef.current;
    if (!currentRoom) return;

    const enabled = currentRoom.localParticipant.isCameraEnabled;
    currentRoom.localParticipant
      .setCameraEnabled(!enabled)
      .then(() => {
        setIsCameraOn(!enabled);
      })
      .catch((err: unknown) => {
        console.error("[useLiveKit] Failed to toggle camera:", err);
      });
  }, []);

  const toggleScreenShare = useCallback(() => {
    const currentRoom = roomRef.current;
    if (!currentRoom) return;

    const enabled = currentRoom.localParticipant.isScreenShareEnabled;
    currentRoom.localParticipant
      .setScreenShareEnabled(!enabled)
      .then(() => {
        setIsScreenSharing(!enabled);
      })
      .catch((err: unknown) => {
        console.error("[useLiveKit] Failed to toggle screen share:", err);
      });
  }, []);

  const disconnect = useCallback(() => {
    const currentRoom = roomRef.current;
    if (currentRoom) {
      currentRoom.disconnect();
    }
  }, []);

  const setMicrophoneDevice = useCallback((deviceId: string) => {
    const currentRoom = roomRef.current;
    if (!currentRoom) return;

    currentRoom.switchActiveDevice("audioinput", deviceId).catch((err: unknown) => {
      console.error("[useLiveKit] Failed to switch microphone:", err);
    });
  }, []);

  const setSpeakerDevice = useCallback((deviceId: string) => {
    for (const audioEl of audioElementsRef.current.values()) {
      if (typeof audioEl.setSinkId === "function") {
        audioEl.setSinkId(deviceId).catch((err) => {
          console.error("[useLiveKit] Failed to set speaker device:", err);
        });
      }
    }
  }, []);

  const setCameraDevice = useCallback((deviceId: string) => {
    const currentRoom = roomRef.current;
    if (!currentRoom) return;

    currentRoom.switchActiveDevice("videoinput", deviceId).catch((err: unknown) => {
      console.error("[useLiveKit] Failed to switch camera:", err);
    });
  }, []);

  return {
    room,
    participants,
    localParticipant,
    activeSpeakers,
    isMuted,
    isCameraOn,
    isScreenSharing,
    isConnected,
    connectionError,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    disconnect,
    setMicrophoneDevice,
    setSpeakerDevice,
    setCameraDevice,
  };
}
