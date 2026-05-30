/**
 * TanStack Query hook for combined content + voice scoring report (D-09, D-11).
 */
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/api/client";

export interface ScoreDimension {
  id: string;
  dimension: string;
  score: number;
  weight: number;
  strengths: string;
  weaknesses: string;
  suggestions: string;
  category: string;
  created_at: string;
}

export interface CombinedScoreReport {
  session_id: string;
  overall_score: number;
  overall_combined_score: number;
  passed: boolean;
  content_dimensions: ScoreDimension[];
  voice_dimensions: ScoreDimension[];
  voice_summary: {
    overall_voice_score: number;
    voice_score_status: string;
    dimensions: ScoreDimension[];
  };
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  feedback_summary: string;
  audio_url: string | null;
  content_total?: number;
  voice_total?: number | null;
  content_weight?: number;
  voice_weight?: number;
}

async function fetchCombinedReport(
  sessionId: string,
): Promise<CombinedScoreReport> {
  const { data } = await apiClient.get<CombinedScoreReport>(
    `/scoring/sessions/${sessionId}/combined-report`,
  );
  return data;
}

export function useCombinedScore(sessionId: string | undefined) {
  return useQuery<CombinedScoreReport>({
    queryKey: ["combined-score", sessionId],
    queryFn: () => fetchCombinedReport(sessionId!),
    enabled: !!sessionId,
    staleTime: 30000,
  });
}
