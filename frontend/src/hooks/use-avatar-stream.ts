import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";

/**
 * WebRTC avatar video stream hook.
 * Manages RTCPeerConnection lifecycle for Azure AI Avatar rendering.
 * Handles ICE gathering, SDP exchange, and video/audio track injection.
 *
 * Flow (matches reference Voice-Live-Agent-With-Avadar):
 * 1. Create RTCPeerConnection with server-provided ICE servers
 * 2. Setup ontrack handler, add video+audio transceivers, create data channel
 * 3. Create SDP offer, set local description
 * 4. Wait for ICE gathering (2s timeout)
 * 5. Exchange SDP via RTClient.connectAvatar()
 * 6. Set remote description -> WebRTC handshake complete
 */
export function useAvatarStream(
  videoContainerRef: RefObject<HTMLDivElement | null>,
) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const clearVideo = useCallback(() => {
    if (videoContainerRef.current) {
      videoContainerRef.current.innerHTML = "";
    }
  }, [videoContainerRef]);

  const connect = useCallback(
    async (iceServers: RTCIceServer[], rtClient: unknown) => {
      // Clear any previous video elements
      clearVideo();

      const pc = new RTCPeerConnection({ iceServers });

      // Receive avatar video and audio tracks
      pc.ontrack = (event) => {
        if (!videoContainerRef.current) return;
        const el = document.createElement(
          event.track.kind,
        ) as HTMLMediaElement;
        el.id = event.track.kind;
        el.srcObject = event.streams[0] ?? null;
        el.autoplay = true;
        if (event.track.kind === "video") {
          (el as HTMLVideoElement).playsInline = true;
          el.style.width = "100%";
          el.style.height = "100%";
          el.style.objectFit = "cover";
        }
        videoContainerRef.current.appendChild(el);
      };

      // Add transceivers for bidirectional media
      pc.addTransceiver("video", { direction: "sendrecv" });
      pc.addTransceiver("audio", { direction: "sendrecv" });

      // Setup data channel for avatar events (blendshapes, etc.)
      pc.addEventListener("datachannel", (event) => {
        const dataChannel = event.channel;
        dataChannel.onmessage = (e) => {
          console.log(
            "[" + new Date().toISOString() + "] WebRTC event: " + e.data,
          );
        };
      });
      pc.createDataChannel("eventChannel");

      // Create SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering (2s timeout like reference implementation)
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
          return;
        }
        const timeout = setTimeout(resolve, 2000);
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === "complete") {
            clearTimeout(timeout);
            resolve();
          }
        };
      });

      // Exchange SDP with Azure via rt-client connectAvatar
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
    [videoContainerRef, clearVideo],
  );

  const disconnect = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    clearVideo();
    setIsConnected(false);
  }, [clearVideo]);

  return { connect, disconnect, isConnected };
}
