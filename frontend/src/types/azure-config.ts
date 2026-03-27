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
