import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import { createVoiceLogger } from "@/lib/voice-logger";

const log = createVoiceLogger("AvatarStream");

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

      // WebRTC connection state handlers
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "failed") {
          log.error("connectionState: %s", state);
        } else {
          log.info("connectionState: %s", state);
        }
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === "failed") {
          log.error("iceConnectionState: %s", state);
        } else if (state === "disconnected") {
          log.warn("iceConnectionState: %s", state);
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

      // Start periodic getStats collection (every 5 seconds)
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
      statsIntervalRef.current = setInterval(() => {
        if (!pcRef.current) return;
        void pcRef.current.getStats().then((stats: RTCStatsReport) => {
          let videoFps = 0;
          let videoPacketsLost = 0;
          let videoPacketsReceived = 0;
          let videoJitter = 0;
          let videoBytesReceived = 0;
          let audioPacketsLost = 0;
          let audioPacketsReceived = 0;
          let audioJitter = 0;
          let rtt = 0;

          stats.forEach((report) => {
            if (report.type === "inbound-rtp") {
              const rtp = report as RTCInboundRtpStreamStats;
              if (rtp.kind === "video") {
                videoFps = rtp.framesPerSecond ?? 0;
                videoPacketsLost = rtp.packetsLost ?? 0;
                videoPacketsReceived = rtp.packetsReceived ?? 0;
                videoJitter = rtp.jitter ?? 0;
                videoBytesReceived = rtp.bytesReceived ?? 0;
              } else if (rtp.kind === "audio") {
                audioPacketsLost = rtp.packetsLost ?? 0;
                audioPacketsReceived = rtp.packetsReceived ?? 0;
                audioJitter = rtp.jitter ?? 0;
              }
            } else if (report.type === "candidate-pair") {
              const pair = report as RTCIceCandidatePairStats;
              if (pair.state === "succeeded" && pair.currentRoundTripTime !== undefined) {
                rtt = pair.currentRoundTripTime;
              }
            }
          });

          // Anomaly detection
          const totalVideoPackets = videoPacketsReceived + videoPacketsLost;
          if (totalVideoPackets > 0) {
            const lossPercent = (videoPacketsLost / totalVideoPackets) * 100;
            if (lossPercent > 5) {
              log.warn("ANOMALY: video packet loss %.1f%%", lossPercent);
            }
          }
          const totalAudioPackets = audioPacketsReceived + audioPacketsLost;
          if (totalAudioPackets > 0) {
            const lossPercent = (audioPacketsLost / totalAudioPackets) * 100;
            if (lossPercent > 5) {
              log.warn("ANOMALY: audio packet loss %.1f%%", lossPercent);
            }
          }
          if (videoFps > 0 && videoFps < 10) {
            log.warn("ANOMALY: video fps=%d (<10)", videoFps);
          }

          log.debug(
            "stats: videoFps=%d vLost=%d vJitter=%.4f vBytes=%d aLost=%d aJitter=%.4f rtt=%.3f",
            videoFps,
            videoPacketsLost,
            videoJitter,
            videoBytesReceived,
            audioPacketsLost,
            audioJitter,
            rtt,
          );
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
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
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
