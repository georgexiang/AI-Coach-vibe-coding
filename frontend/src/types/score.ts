export interface ScoreStrength {
  text: string;
  quote: string;
}

export interface ScoreWeakness {
  text: string;
  quote: string;
}

export interface ScoreDetail {
  dimension: string;
  score: number;
  weight: number;
  strengths: ScoreStrength[];
  weaknesses: ScoreWeakness[];
  suggestions: string[];
  category?: "content" | "voice";
}

export interface SessionScore {
  session_id: string;
  overall_score: number;
  passed: boolean;
  feedback_summary: string;
  details: ScoreDetail[];
}
