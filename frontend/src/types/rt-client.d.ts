/**
 * Type declarations for rt-client SDK.
 * The rt-client package provides the RTClient class for Azure Voice Live API.
 * This declaration allows dynamic import without TypeScript errors.
 */
declare module "rt-client" {
  interface AzureAgentConfig {
    agentId: string;
    projectName?: string;
    agentConnectionString?: string;
    agentAccessToken?: string;
    threadId?: string;
  }

  interface RTAzureOpenAIOptions {
    deployment: string;
    requestId?: string;
    apiVersion?: string;
    path?: string;
  }

  interface RTVoiceAgentOptions {
    modelOrAgent: string | AzureAgentConfig;
    profile?: string;
    requestId?: string;
    apiVersion?: string;
    path?: string;
  }

  export class RTClient {
    constructor(
      endpoint: URL,
      credentials: { key: string },
      options: RTAzureOpenAIOptions | RTVoiceAgentOptions,
    );

    configure(config: Record<string, unknown>): Promise<Record<string, unknown>>;
    close(): Promise<void>;
    sendAudio(audio: Uint8Array): Promise<void>;
    events(): AsyncIterable<{ type: string } & Record<string, unknown>>;
    sendItem(item: unknown): Promise<void>;
    generateResponse(): Promise<void>;
    connectAvatar(
      sdp: RTCSessionDescription,
    ): Promise<RTCSessionDescription>;
  }
}
