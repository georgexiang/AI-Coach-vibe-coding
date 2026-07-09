import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import { createVoiceLogger } from "@/lib/voice-logger";

const log = createVoiceLogger("AvatarStream");

type LogLevel = "debug" | "info" | "warn" | "error";

type CandidateStats = RTCStats & {
  candidateType?: string;
  protocol?: string;
  address?: string;
  ip?: string;
  port?: number;
  relayProtocol?: string;
  networkType?: string;
};

type CandidatePairStats = RTCStats & {
  state?: string;
  nominated?: boolean;
  currentRoundTripTime?: number;
  availableIncomingBitrate?: number;
  availableOutgoingBitrate?: number;
  bytesReceived?: number;
  bytesSent?: number;
  localCandidateId?: string;
  remoteCandidateId?: string;
};

type TransportStats = RTCStats & {
  selectedCandidatePairId?: string;
  dtlsState?: string;
  iceRole?: string;
  iceState?: string;
};

interface AvatarStatsSummary {
  videoFps: number;
  videoPacketsLost: number;
  videoPacketsReceived: number;
  videoJitter: number;
  videoBytesReceived: number;
  audioPacketsLost: number;
  audioPacketsReceived: number;
  audioJitter: number;
  audioBytesReceived: number;
  candidatePair: CandidatePairStats | null;
  localCandidate: CandidateStats | null;
  remoteCandidate: CandidateStats | null;
  transport: TransportStats | null;
}

function formatCandidate(candidate: CandidateStats | null): string {
  if (!candidate) return "unknown";
  return [
    candidate.candidateType ?? "unknown-type",
    candidate.protocol ?? "unknown-protocol",
    candidate.networkType ?? "unknown-network",
    candidate.relayProtocol ? `relay=${candidate.relayProtocol}` : null,
    candidate.address ?? candidate.ip ?? null,
    candidate.port != null ? String(candidate.port) : null,
  ]
    .filter(Boolean)
    .join("/");
}

function summarizeStats(stats: RTCStatsReport): AvatarStatsSummary {
  const localCandidates = new Map<string, CandidateStats>();
  const remoteCandidates = new Map<string, CandidateStats>();
  const candidatePairs = new Map<string, CandidatePairStats>();

  const summary: AvatarStatsSummary = {
    videoFps: 0,
    videoPacketsLost: 0,
    videoPacketsReceived: 0,
    videoJitter: 0,
    videoBytesReceived: 0,
    audioPacketsLost: 0,
    audioPacketsReceived: 0,
    audioJitter: 0,
    audioBytesReceived: 0,
    candidatePair: null,
    localCandidate: null,
    remoteCandidate: null,
    transport: null,
  };

  stats.forEach((report) => {
    if (report.type === "inbound-rtp") {
      const rtp = report as RTCInboundRtpStreamStats;
      if (rtp.kind === "video") {
        summary.videoFps = rtp.framesPerSecond ?? 0;
        summary.videoPacketsLost = rtp.packetsLost ?? 0;
        summary.videoPacketsReceived = rtp.packetsReceived ?? 0;
        summary.videoJitter = rtp.jitter ?? 0;
        summary.videoBytesReceived = rtp.bytesReceived ?? 0;
      } else if (rtp.kind === "audio") {
        summary.audioPacketsLost = rtp.packetsLost ?? 0;
        summary.audioPacketsReceived = rtp.packetsReceived ?? 0;
        summary.audioJitter = rtp.jitter ?? 0;
        summary.audioBytesReceived = rtp.bytesReceived ?? 0;
      }
    } else if (report.type === "candidate-pair") {
      const pair = report as CandidatePairStats;
      candidatePairs.set(report.id, pair);
    } else if (report.type === "local-candidate") {
      localCandidates.set(report.id, report as CandidateStats);
    } else if (report.type === "remote-candidate") {
      remoteCandidates.set(report.id, report as CandidateStats);
    } else if (report.type === "transport") {
      summary.transport = report as TransportStats;
    }
  });

  const selectedPairId = summary.transport?.selectedCandidatePairId;
  summary.candidatePair = selectedPairId
    ? candidatePairs.get(selectedPairId) ?? null
    : [...candidatePairs.values()].find((pair) => pair.nominated && pair.state === "succeeded") ??
      [...candidatePairs.values()].find((pair) => pair.state === "succeeded") ??
      null;
  summary.localCandidate = summary.candidatePair?.localCandidateId
    ? localCandidates.get(summary.candidatePair.localCandidateId) ?? null
    : null;
  summary.remoteCandidate = summary.candidatePair?.remoteCandidateId
    ? remoteCandidates.get(summary.candidatePair.remoteCandidateId) ?? null
    : null;

  return summary;
}

function logStatsSnapshot(
  summary: AvatarStatsSummary,
  level: LogLevel,
  reason: string,
  videoBytesDelta: number | null = null,
  audioBytesDelta: number | null = null,
): void {
  log[level](
    "webrtc-stats reason=%s pair=%s pairState=%s nominated=%s local=%s remote=%s rtt=%.3f dtls=%s ice=%s vFps=%d vLost=%d vRecv=%d vJitter=%.4f vBytes=%d vDelta=%s aLost=%d aRecv=%d aJitter=%.4f aBytes=%d aDelta=%s inBitrate=%s outBitrate=%s",
    reason,
    summary.candidatePair?.id ?? "none",
    summary.candidatePair?.state ?? "unknown",
    summary.candidatePair?.nominated ?? false,
    formatCandidate(summary.localCandidate),
    formatCandidate(summary.remoteCandidate),
    summary.candidatePair?.currentRoundTripTime ?? 0,
    summary.transport?.dtlsState ?? "unknown",
    summary.transport?.iceState ?? "unknown",
    summary.videoFps,
    summary.videoPacketsLost,
    summary.videoPacketsReceived,
    summary.videoJitter,
    summary.videoBytesReceived,
    videoBytesDelta == null ? "n/a" : String(videoBytesDelta),
    summary.audioPacketsLost,
    summary.audioPacketsReceived,
    summary.audioJitter,
    summary.audioBytesReceived,
    audioBytesDelta == null ? "n/a" : String(audioBytesDelta),
    summary.candidatePair?.availableIncomingBitrate ?? "n/a",
    summary.candidatePair?.availableOutgoingBitrate ?? "n/a",
  );
}

async function logPeerConnectionSnapshot(
  pc: RTCPeerConnection,
  level: LogLevel,
  reason: string,
): Promise<void> {
  try {
    const stats = await pc.getStats();
    logStatsSnapshot(summarizeStats(stats), level, reason);
  } catch (error) {
    log.warn("getStats() failed for %s: %o", reason, error);
  }
}

/**
 * WebRTC avatar video stream hook for Azure Voice Live.
 *
 * Follows the Azure reference implementation pattern (useWebRTC.ts):
 *   1. Client creates SDP offer via RTCPeerConnection
 *   2. SDP offer is base64-encoded as JSON: btoa(JSON.stringify({type:'offer', sdp}))
 *   3. Client sends via session.avatar.connect { client_sdp: encodedSdp }
 *   4. Server responds with base64-encoded SDP answer in server_sdp field
 *   5. Client decodes: JSON.parse(atob(server_sdp)).sdp -> setRemoteDescription
 *
 * Video rendering: uses a pre-existing <video> element via React ref (NOT dynamic
 * createElement). This matches the reference implementation and avoids issues with
 * appending video to a hidden container which prevents autoplay.
 */
export function useAvatarStream(
  videoRef: RefObject<HTMLVideoElement | null>,
) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const sdpResolverRef = useRef<((sdp: string) => void) | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedCandidatePairIdRef = useRef<string | null>(null);
  const lastBytesRef = useRef<{
    videoBytesReceived: number;
    audioBytesReceived: number;
  } | null>(null);

  /**
   * Start avatar WebRTC connection.
   * @param iceServers - ICE server configuration from session.updated avatar config
   * @param sendSdpOffer - Sends base64-encoded SDP offer via VoiceLive session
   */
  const connect = useCallback(
    async (
      iceServers: RTCIceServer[],
      sendSdpOffer: (sdp: string) => Promise<void>,
    ) => {
      log.info("connect() entry, iceServers=%d", iceServers.length);

      // Reset video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      const pc = new RTCPeerConnection({
        iceServers: iceServers.length > 0 ? iceServers : undefined,
        bundlePolicy: "max-bundle",
      });
      pcRef.current = pc;

      // WebRTC connection state handlers
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "failed") {
          log.error("connectionState: %s", state);
          void logPeerConnectionSnapshot(pc, "error", "connectionState:failed");
        } else if (state === "disconnected" || state === "closed") {
          log.warn("connectionState: %s", state);
          void logPeerConnectionSnapshot(pc, "warn", `connectionState:${state}`);
        } else {
          log.info("connectionState: %s", state);
        }
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === "failed") {
          log.error("iceConnectionState: %s", state);
          void logPeerConnectionSnapshot(pc, "error", "iceConnectionState:failed");
        } else if (state === "disconnected") {
          log.warn("iceConnectionState: %s", state);
          void logPeerConnectionSnapshot(pc, "warn", "iceConnectionState:disconnected");
        } else {
          log.info("iceConnectionState: %s", state);
        }
      };

      pc.onsignalingstatechange = () => {
        log.debug("signalingState: %s", pc.signalingState);
      };

      // Receive avatar video and audio tracks — matches reference useWebRTC.ts pattern
      pc.ontrack = (event) => {
        if (event.track.kind === "video" && videoRef.current) {
          videoRef.current.srcObject = event.streams[0] ?? null;
          videoRef.current.play().catch((err: unknown) => {
            log.warn("Video play() failed: %o", err);
          });
          log.info(
            "Video track received, streams=%d, track.readyState=%s",
            event.streams.length,
            event.track.readyState,
          );
        } else if (event.track.kind === "audio") {
          // Audio element created dynamically and appended to body (hidden),
          // matching reference implementation pattern
          const audio = document.createElement("audio");
          audio.srcObject = event.streams[0] ?? null;
          audio.autoplay = true;
          audio.style.display = "none";
          document.body.appendChild(audio);
          audio.play().catch((err: unknown) => {
            log.warn("Audio play() failed: %o", err);
          });
          audioElRef.current = audio;
          log.info(
            "Audio track received, streams=%d, track.readyState=%s",
            event.streams.length,
            event.track.readyState,
          );
        }
      };

      // Receive-only transceivers — avatar streams video/audio to the client.
      // Audio input goes through VoiceLive session.sendAudio() (PCM base64), not WebRTC.
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      // Register ICE candidate handler BEFORE createOffer (matches reference impl).
      // This ensures no candidates are missed even if gathering starts immediately.
      const offerReadyPromise = new Promise<string>((resolve) => {
        let offerSent = false;

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            log.debug(
              "ICE candidate: %s %s",
              e.candidate.type,
              e.candidate.protocol,
            );
          }
          if (!e.candidate && pc.localDescription && !offerSent) {
            offerSent = true;
            const encodedSdp = btoa(
              JSON.stringify({
                type: "offer",
                sdp: pc.localDescription.sdp,
              }),
            );
            log.info(
              "ICE gathering complete, sending SDP offer (len=%d)",
              encodedSdp.length,
            );
            resolve(encodedSdp);
          }
        };

        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === "complete" && pc.localDescription && !offerSent) {
            offerSent = true;
            const encodedSdp = btoa(
              JSON.stringify({
                type: "offer",
                sdp: pc.localDescription.sdp,
              }),
            );
            log.info(
              "ICE gathering complete (statechange), sending SDP offer (len=%d)",
              encodedSdp.length,
            );
            resolve(encodedSdp);
          }
        };

        // Safety timeout — 8s. All candidates (host, srflx, relay) typically arrive
        // within 2-3s. The null candidate event sometimes never fires in certain
        // network environments, so this timeout is necessary to avoid hanging.
        setTimeout(() => {
          if (!offerSent) {
            offerSent = true;
            const sdp = pc.localDescription?.sdp;
            if (sdp) {
              const encodedSdp = btoa(
                JSON.stringify({ type: "offer", sdp }),
              );
              log.warn(
                "ICE gathering timeout (8s), sending SDP offer. gatheringState=%s",
                pc.iceGatheringState,
              );
              resolve(encodedSdp);
            }
          }
        }, 8000);
      });

      // Create and set local offer — this triggers ICE gathering
      const offer = await pc.createOffer();
      log.info("createOffer success");
      await pc.setLocalDescription(offer);
      log.info("setLocalDescription success");

      // Create a promise for the server SDP answer
      const serverSdpPromise = new Promise<string>((resolve, reject) => {
        sdpResolverRef.current = resolve;
        setTimeout(() => {
          sdpResolverRef.current = null;
          reject(new Error("Avatar SDP answer timeout"));
        }, 15000);
      });

      // Wait for ICE gathering (or timeout), then send SDP offer
      const encodedSdp = await offerReadyPromise;
      await sendSdpOffer(encodedSdp);

      // Wait for server SDP answer
      const serverSdp = await serverSdpPromise;
      sdpResolverRef.current = null;

      await pc.setRemoteDescription({
        type: "answer",
        sdp: serverSdp,
      });
      log.info("setRemoteDescription success");

      pcRef.current = pc;
      // Expose for debugging — check stats via: window.__avatarPC.getStats()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__avatarPC = pc;
      setIsConnected(true);
      log.info("WebRTC connected");
      void logPeerConnectionSnapshot(pc, "info", "connected");

      // Start periodic getStats collection (every 5 seconds)
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
      statsIntervalRef.current = setInterval(() => {
        if (!pcRef.current) return;
        void pcRef.current.getStats().then((stats: RTCStatsReport) => {
          const summary = summarizeStats(stats);
          const previousBytes = lastBytesRef.current;
          const videoBytesDelta = previousBytes
            ? summary.videoBytesReceived - previousBytes.videoBytesReceived
            : null;
          const audioBytesDelta = previousBytes
            ? summary.audioBytesReceived - previousBytes.audioBytesReceived
            : null;
          lastBytesRef.current = {
            videoBytesReceived: summary.videoBytesReceived,
            audioBytesReceived: summary.audioBytesReceived,
          };

          if (summary.candidatePair?.id !== selectedCandidatePairIdRef.current) {
            selectedCandidatePairIdRef.current = summary.candidatePair?.id ?? null;
            logStatsSnapshot(summary, "info", "selected-candidate-pair-changed");
          }

          // Anomaly detection
          const totalVideoPackets = summary.videoPacketsReceived + summary.videoPacketsLost;
          if (totalVideoPackets > 0) {
            const lossPercent = (summary.videoPacketsLost / totalVideoPackets) * 100;
            if (lossPercent > 5) {
              log.warn("ANOMALY: video packet loss %.1f%%", lossPercent);
            }
          }
          const totalAudioPackets = summary.audioPacketsReceived + summary.audioPacketsLost;
          if (totalAudioPackets > 0) {
            const lossPercent = (summary.audioPacketsLost / totalAudioPackets) * 100;
            if (lossPercent > 5) {
              log.warn("ANOMALY: audio packet loss %.1f%%", lossPercent);
            }
          }
          if (summary.videoFps > 0 && summary.videoFps < 10) {
            log.warn("ANOMALY: video fps=%d (<10)", summary.videoFps);
          }
          if (videoBytesDelta === 0 && summary.videoBytesReceived > 0) {
            log.warn("ANOMALY: video bytes stalled");
          }
          if (audioBytesDelta === 0 && summary.audioBytesReceived > 0) {
            log.warn("ANOMALY: audio bytes stalled");
          }

          logStatsSnapshot(summary, "debug", "periodic", videoBytesDelta, audioBytesDelta);
        });
      }, 5000);
    },
    [videoRef],
  );

  /**
   * Handle server SDP answer.
   * Azure sends server_sdp as base64-encoded JSON: {type:'answer', sdp:'...'}.
   * Falls back to raw SDP string if decode fails.
   */
  const handleServerSdp = useCallback(async (rawServerSdp: string) => {
    let sdp = rawServerSdp;
    try {
      // Try base64 decode + JSON parse (Azure format)
      const decoded = JSON.parse(atob(rawServerSdp)) as {
        sdp?: string;
        type?: string;
      };
      if (decoded.sdp) {
        sdp = decoded.sdp;
      }
    } catch {
      // Not base64-encoded JSON — use raw value as SDP
      log.warn("server_sdp not base64 JSON, using raw");
    }
    log.info("Server SDP answer received (len=%d)", sdp.length);
    sdpResolverRef.current?.(sdp);
  }, []);

  const disconnect = useCallback(() => {
    log.info("disconnect() called");
    if (pcRef.current) {
      void logPeerConnectionSnapshot(pcRef.current, "info", "disconnect");
    }
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    selectedCandidatePairIdRef.current = null;
    lastBytesRef.current = null;
    sdpResolverRef.current = null;
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    // Clean up video
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    // Clean up dynamically created audio element
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current.remove();
      audioElRef.current = null;
    }
    setIsConnected(false);
  }, [videoRef]);

  return { connect, disconnect, handleServerSdp, isConnected };
}
