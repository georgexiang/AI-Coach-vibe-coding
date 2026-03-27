/**
 * AudioWorklet processor for capturing microphone audio.
 * Captures raw Float32 audio data and posts it to the main thread.
 * Used by AudioHandler for Voice Live API integration.
 */
class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRecording = false;
    this.port.onmessage = (e) => {
      if (e.data.command === "START_RECORDING") {
        this.isRecording = true;
      }
      if (e.data.command === "STOP_RECORDING") {
        this.isRecording = false;
      }
    };
  }

  process(inputs) {
    if (this.isRecording && inputs[0] && inputs[0][0]) {
      // Clone the Float32Array data before posting (transferable)
      const audioData = new Float32Array(inputs[0][0]);
      this.port.postMessage({
        eventType: "audio",
        audioData: audioData,
      });
    }
    return true;
  }
}

registerProcessor("audio-recorder-processor", AudioRecorderProcessor);
