import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";

/**
 * WebRTC avatar video stream hook.
 * Manages RTCPeerConnection lifecycle for Azure AI Avatar rendering.
 * Handles ICE gathering, SDP exchange, and video/audio track injection.
 */
export function useAvatarStream(
  videoContainerRef: RefObject<HTMLDivElement | null>,
) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(
    async (iceServers: RTCIceServer[], rtClient: unknown) => {
      const pc = new RTCPeerConnection({ iceServers });

      // Receive avatar video and audio tracks
      pc.ontrack = (event) => {
        if (!videoContainerRef.current) return;
        const el = document.createElement(
          event.track.kind === "video" ? "video" : "audio",
        ) as HTMLMediaElement;
        el.id = `avatar-${event.track.kind}`;
        el.srcObject = event.streams[0] ?? null;
        el.autoplay = true;
        if (event.track.kind === "video") {
          (el as HTMLVideoElement).playsInline = true;
          el.style.width = "100%";
          el.style.height = "100%";
          el.style.objectFit = "cover";
        }
        // Remove existing element of same type before appending
        const existing = videoContainerRef.current.querySelector(
          `#avatar-${event.track.kind}`,
        );
        if (existing) existing.remove();
        videoContainerRef.current.appendChild(el);
      };

      pc.addTransceiver("video", { direction: "sendrecv" });
      pc.addTransceiver("audio", { direction: "sendrecv" });

      // SDP offer/answer exchange
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering complete instead of fixed timeout (avoids Pitfall 3)
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
          return;
        }
        const timeout = setTimeout(resolve, 5000); // 5s max wait
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === "complete") {
            clearTimeout(timeout);
            resolve();
          }
        };
      });

      // Exchange SDP with Azure via rt-client
      const client = rtClient as {
        connectAvatar?: (
          sdp: RTCSessionDescription,
        ) => Promise<RTCSessionDescriptionInit>;
      };
      if (!client.connectAvatar) {
        throw new Error("RTClient does not support avatar connection");
      }
      const answer = await client.connectAvatar(
        pc.localDescription as RTCSessionDescription,
      );
      await pc.setRemoteDescription(answer);

      pcRef.current = pc;
      setIsConnected(true);
    },
    [videoContainerRef],
  );

  const disconnect = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    // Clear video elements
    if (videoContainerRef.current) {
      videoContainerRef.current.innerHTML = "";
    }
    setIsConnected(false);
  }, [videoContainerRef]);

  return { connect, disconnect, isConnected };
}
