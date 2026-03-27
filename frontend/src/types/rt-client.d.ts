/**
 * Type declarations for rt-client SDK.
 * The rt-client package provides the RTClient class for Azure Voice Live API.
 * This declaration allows dynamic import without TypeScript errors.
 */
declare module "rt-client" {
  export class RTClient {
    constructor(
      endpoint: URL,
      credentials: { key: string },
      options: { model: string },
    );

    configure(config: Record<string, unknown>): Promise<unknown>;
    close(): Promise<void>;
    responses(): AsyncIterable<unknown>;
    sendItem(item: unknown): void;
    generateResponse(): void;
    connectAvatar(
      sdp: RTCSessionDescription,
    ): Promise<RTCSessionDescriptionInit>;
  }
}
