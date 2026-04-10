import apiClient from "./client";
import type {
  SearchConnection,
  SearchIndex,
  KnowledgeConfig,
  KnowledgeConfigCreate,
} from "@/types/knowledge-base";

export const knowledgeBaseApi = {
  listConnections: () =>
    apiClient
      .get<SearchConnection[]>("/knowledge-base/connections")
      .then((r) => r.data),

  listIndexes: () =>
    apiClient
      .get<SearchIndex[]>("/knowledge-base/indexes")
      .then((r) => r.data),

  getHcpConfigs: (hcpId: string) =>
    apiClient
      .get<KnowledgeConfig[]>(`/knowledge-base/hcp/${hcpId}/configs`)
      .then((r) => r.data),

  addHcpConfig: (hcpId: string, data: KnowledgeConfigCreate) =>
    apiClient
      .post<KnowledgeConfig>(`/knowledge-base/hcp/${hcpId}/configs`, data)
      .then((r) => r.data),

  removeConfig: (configId: string) =>
    apiClient.delete(`/knowledge-base/configs/${configId}`),
};
