export interface ServiceConfigResponse {
  service_name: string;
  display_name: string;
  endpoint: string;
  masked_key: string;
  model_or_deployment: string;
  region: string;
  is_active: boolean;
  updated_at: string | null;
}

export interface ServiceConfigUpdate {
  endpoint: string;
  api_key: string;
  model_or_deployment: string;
  region: string;
}

export interface ConnectionTestResult {
  service_name: string;
  success: boolean;
  message: string;
}

export interface RegionServiceAvailability {
  available: boolean;
  note: string;
}

export interface RegionCapabilities {
  region: string;
  services: Record<string, RegionServiceAvailability>;
}

export type RegionStatus = "available" | "unavailable" | "unknown";

export interface VoiceLiveAgentConfig {
  mode: "agent";
  agent_id: string;
  project_name: string;
}

export interface VoiceLiveModelConfig {
  mode: "model";
  model: string;
}

export type VoiceLiveMode = VoiceLiveAgentConfig | VoiceLiveModelConfig;

/** Parse model_or_deployment into structured Voice Live mode config. */
export function parseVoiceLiveMode(modelOrDeployment: string): VoiceLiveMode {
  if (!modelOrDeployment) {
    return { mode: "model", model: "gpt-4o-realtime-preview" };
  }
  try {
    const parsed = JSON.parse(modelOrDeployment) as Record<string, unknown>;
    if (parsed.mode === "agent") {
      return {
        mode: "agent",
        agent_id: String(parsed.agent_id ?? ""),
        project_name: String(parsed.project_name ?? ""),
      };
    }
  } catch {
    // Not JSON -- check legacy colon encoding
    if (modelOrDeployment.startsWith("agent:")) {
      const parts = modelOrDeployment.split(":");
      return {
        mode: "agent",
        agent_id: parts[1] ?? "",
        project_name: parts[2] ?? "",
      };
    }
  }
  return { mode: "model", model: modelOrDeployment };
}

/** Encode Voice Live mode config into model_or_deployment string. */
export function encodeVoiceLiveMode(config: VoiceLiveMode): string {
  if (config.mode === "agent") {
    return JSON.stringify({
      mode: "agent",
      agent_id: config.agent_id,
      project_name: config.project_name,
    });
  }
  return config.model || "gpt-4o-realtime-preview";
}
