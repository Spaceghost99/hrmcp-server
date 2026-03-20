import { z } from 'zod';

export const WeightsSchema = z.object({
  skills_match: z.number().min(0).max(1),
  experience: z.number().min(0).max(1),
  industry_background: z.number().min(0).max(1),
  education: z.number().min(0).max(1),
});

export const ScoreCandidateRequestSchema = z.object({
  resume_text: z.string(),
  job_description: z.string(),
  weights: WeightsSchema.optional(),
  recency_window_years: z.number().int().positive().optional(),
});

export const DimensionScoresSchema = z.object({
  skills_match: z.number().int().min(0).max(100),
  experience: z.number().int().min(0).max(100),
  industry_background: z.number().int().min(0).max(100),
  education: z.number().int().min(0).max(100),
});

export const ScoreCandidateResponseSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  dimension_scores: DimensionScoresSchema,
  strengths: z.array(z.string()).min(2).max(4),
  gaps: z.array(z.string()).min(2).max(4),
  recency_window_used: z.number().int().positive(),
});

export const WarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  detail: z.record(z.string(), z.unknown()).optional(),
});

export type WeightsInput = z.infer<typeof WeightsSchema>;
export type ScoreCandidateRequest = z.infer<typeof ScoreCandidateRequestSchema>;
export type DimensionScores = z.infer<typeof DimensionScoresSchema>;
export type ScoreCandidateResponse = z.infer<typeof ScoreCandidateResponseSchema>;
export type Warning = z.infer<typeof WarningSchema>;

export const DEFAULT_WEIGHTS: WeightsInput = {
  skills_match: 0.40,
  experience: 0.30,
  industry_background: 0.20,
  education: 0.10,
};

export const DEFAULT_RECENCY_WINDOW = 10;