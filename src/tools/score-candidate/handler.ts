import { config } from '../../config';
import { createError, createWarning } from '../../errors/envelope';
import { ErrorCodes } from '../../errors/codes';
import { scoreCandidate } from './scorer';
import {
  DEFAULT_WEIGHTS,
  DEFAULT_RECENCY_WINDOW,
  WeightsInput,
} from './schema';

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function detectLanguage(text: string): string | null {
  const nonLatinPattern = /[\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/;
  if (nonLatinPattern.test(text)) return 'non-latin';
  return null;
}

export async function handleScoreCandidate(body: any): Promise<{
  status: number;
  body: any;
}> {
  const warnings: any[] = [];

  // Check required fields
  const missingFields: string[] = [];
  if (!body.resume_text || body.resume_text.trim() === '') {
    missingFields.push('resume_text');
  }
  if (!body.job_description || body.job_description.trim() === '') {
    missingFields.push('job_description');
  }
  if (missingFields.length > 0) {
    return {
      status: 400,
      body: createError(
        ErrorCodes.MISSING_REQUIRED_FIELD,
        'One or more required fields are missing.',
        { missing_fields: missingFields }
      ),
    };
  }

  const resumeText: string = body.resume_text;
  const jobDescription: string = body.job_description;

  // Check payload size
  if (resumeText.length > config.maxResumeChars) {
    return {
      status: 400,
      body: createError(
        ErrorCodes.PAYLOAD_TOO_LARGE,
        'Input exceeds maximum allowed length.',
        {
          field: 'resume_text',
          character_count: resumeText.length,
          maximum: config.maxResumeChars,
        }
      ),
    };
  }

  if (jobDescription.length > config.maxJdChars) {
    return {
      status: 400,
      body: createError(
        ErrorCodes.PAYLOAD_TOO_LARGE,
        'Input exceeds maximum allowed length.',
        {
          field: 'job_description',
          character_count: jobDescription.length,
          maximum: config.maxJdChars,
        }
      ),
    };
  }

  // Check resume word count
  const resumeWordCount = countWords(resumeText);
  if (resumeWordCount < 50) {
    return {
      status: 400,
      body: createError(
        ErrorCodes.RESUME_TOO_SHORT,
        'Resume is too short to score meaningfully.',
        { word_count: resumeWordCount, minimum: 50 }
      ),
    };
  }

  // Check recency window
  let recencyWindowYears = DEFAULT_RECENCY_WINDOW;
  if (body.recency_window_years !== undefined) {
    if (
      !Number.isInteger(body.recency_window_years) ||
      body.recency_window_years <= 0
    ) {
      return {
        status: 400,
        body: createError(
          ErrorCodes.RECENCY_WINDOW_INVALID,
          'recency_window_years must be a positive integer.',
          { provided_value: body.recency_window_years }
        ),
      };
    }
    recencyWindowYears = body.recency_window_years;
  }

  // Validate weights
  let weights: WeightsInput = DEFAULT_WEIGHTS;
  if (body.weights !== undefined) {
    const requiredKeys = ['skills_match', 'experience', 'industry_background', 'education'];
    const missingKeys = requiredKeys.filter(k => !(k in body.weights));
    if (missingKeys.length > 0) {
      return {
        status: 400,
        body: createError(
          ErrorCodes.WEIGHTS_MISSING_KEYS,
          'One or more required weight keys are missing.',
          { missing_keys: missingKeys }
        ),
      };
    }

    for (const key of requiredKeys) {
      const value = body.weights[key];
      if (typeof value !== 'number' || value < 0 || value > 1) {
        return {
          status: 400,
          body: createError(
            ErrorCodes.WEIGHTS_NEGATIVE_VALUE,
            `Weight value for ${key} is invalid. Must be between 0.0 and 1.0.`,
            { invalid_key: key, value }
          ),
        };
      }
    }

    const sum = requiredKeys.reduce((acc, k) => acc + body.weights[k], 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      return {
        status: 400,
        body: createError(
          ErrorCodes.WEIGHTS_INVALID_SUM,
          'Weights must sum to 1.0.',
          { provided_sum: Math.round(sum * 1000) / 1000, expected: 1.0 }
        ),
      };
    }

    weights = body.weights;
  }

  // Check for thin JD
  const jdWordCount = countWords(jobDescription);
  if (jdWordCount < 30) {
    warnings.push(
      createWarning(
        ErrorCodes.JOB_DESCRIPTION_THIN,
        'Job description is very short. Scoring accuracy may be reduced.',
        { word_count: jdWordCount, recommended_minimum: 30 }
      )
    );
  }

  // Check for non-English
  const affectedFields: string[] = [];
  if (detectLanguage(resumeText)) affectedFields.push('resume_text');
  if (detectLanguage(jobDescription)) affectedFields.push('job_description');
  if (affectedFields.length > 0) {
    warnings.push(
      createWarning(
        ErrorCodes.NON_ENGLISH_DETECTED,
        'One or more inputs appear to be in a non-English language. Scoring accuracy may be reduced.',
        { detected_language: 'non-latin', affected_fields: affectedFields }
      )
    );
  }

  // Call the scorer
  const result = await scoreCandidate(
    resumeText,
    jobDescription,
    weights,
    recencyWindowYears
  );

  if (!result.success) {
    return {
      status: result.status,
      body: result.error,
    };
  }

  // Return successful response
  return {
    status: 200,
    body: {
      ...result.data,
      model: config.anthropicModel,
      warnings,
    },
  };
}