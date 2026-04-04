import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";

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
      // Reset video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      const pc = new RTCPeerConnection({
        iceServers: iceServers.length > 0 ? iceServers : undefined,
        bundlePolicy: "max-bundle",
      });

      // Receive avatar video and audio tracks — matches reference useWebRTC.ts pattern
      pc.ontrack = (event) => {
        if (event.track.kind === "video" && videoRef.current) {
          videoRef.current.srcObject = event.streams[0] ?? null;
          // Explicit play() call — required for reliable autoplay across browsers,
          // especially when video element was invisible during negotiation.
          videoRef.current.play().catch((err) => {
            console.warn("[AvatarStream] Video play() failed:", err);
          });
        } else if (event.track.kind === "audio") {
          // Audio element created dynamically and appended to body (hidden),
          // matching reference implementation pattern
          const audio = document.createElement("audio");
          audio.srcObject = event.streams[0] ?? null;
          audio.autoplay = true;
          audio.style.display = "none";
          document.body.appendChild(audio);
          audioElRef.current = audio;
        }
      };

      // Receive-only transceivers — avatar streams video/audio to the client.
      // Audio input goes through VoiceLive session.sendAudio() (PCM base64), not WebRTC.
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      // Create SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Create a promise that will be resolved when the server SDP answer arrives
      const serverSdpPromise = new Promise<string>((resolve, reject) => {
        sdpResolverRef.current = resolve;
        // Timeout after 15s
        setTimeout(() => {
          sdpResolverRef.current = null;
          reject(new Error("Avatar SDP answer timeout"));
        }, 15000);
      });

      // Wait for ICE gathering complete (null candidate), then send
      // base64-encoded SDP offer — matches Azure reference implementation.
      await new Promise<void>((resolve) => {
        let offerSent = false;
        pc.onicecandidate = (e) => {
          if (!e.candidate && pc.localDescription && !offerSent) {
            offerSent = true;
            // ICE gathering complete — encode as base64 JSON and send
            const encodedSdp = btoa(
              JSON.stringify({
                type: "offer",
                sdp: pc.localDescription.sdp,
              }),
            );
            console.info(
              "[AvatarStream] ICE gathering complete, sending SDP offer (len=%d)",
              encodedSdp.length,
            );
            void sendSdpOffer(encodedSdp);
            resolve();
          }
        };
        // Fallback timeout in case ICE gathering hangs
        setTimeout(() => {
          if (pc.localDescription?.sdp && !offerSent) {
            offerSent = true;
            const encodedSdp = btoa(
              JSON.stringify({
                type: "offer",
                sdp: pc.localDescription.sdp,
              }),
            );
            console.warn(
              "[AvatarStream] ICE gathering timeout, sending SDP offer anyway",
            );
            void sendSdpOffer(encodedSdp);
          }
          resolve();
        }, 5000);
      });

      // Wait for server SDP answer
      const serverSdp = await serverSdpPromise;
      sdpResolverRef.current = null;

      await pc.setRemoteDescription({
        type: "answer",
        sdp: serverSdp,
      });

      pcRef.current = pc;
      setIsConnected(true);
      console.info("[AvatarStream] WebRTC connected");
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
      console.warn("[AvatarStream] server_sdp not base64 JSON, using raw");
    }
    console.info("[AvatarStream] Server SDP answer received (len=%d)", sdp.length);
    sdpResolverRef.current?.(sdp);
  }, []);

  const disconnect = useCallback(() => {
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
