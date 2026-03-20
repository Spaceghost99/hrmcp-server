import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt';
import { ScoreCandidateResponseSchema, WeightsInput } from './schema';
import { createError } from '../../errors/envelope';
import { ErrorCodes } from '../../errors/codes';

const client = new Anthropic({
  apiKey: config.anthropicApiKey,
  timeout: config.anthropicTimeoutMs,
});

export async function scoreCandidate(
  resumeText: string,
  jobDescription: string,
  weights: WeightsInput,
  recencyWindowYears: number
): Promise<{ success: true; data: any } | { success: false; error: any; status: number }> {

  const userPrompt = buildUserPrompt(
    resumeText,
    jobDescription,
    weights,
    recencyWindowYears
  );

  let rawResponse: string;

  try {
    const message = await client.messages.create({
      model: config.anthropicModel,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userPrompt }
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from model');
    }
    rawResponse = content.text;

  } catch (err: any) {
    if (err.name === 'APITimeoutError') {
      return {
        success: false,
        status: 503,
        error: createError(
          ErrorCodes.MODEL_UNAVAILABLE,
          'The scoring model did not respond in time. Please retry.',
          { upstream_status: 'timeout' }
        ),
      };
    }

    return {
      success: false,
      status: 503,
      error: createError(
        ErrorCodes.MODEL_UNAVAILABLE,
        'The scoring model is currently unavailable. Please retry.',
        { upstream_status: (err as any).status || 'unknown' }
      ),
    };
  }

  // Log raw response for debugging
  if (config.logLevel === 'debug') {
    console.log('RAW MODEL RESPONSE:', rawResponse);
  }

  // Parse the JSON response
  let parsed: any;
  try {
    const cleaned = rawResponse
      .replace(/^```json\n?/, '')
      .replace(/^```\n?/, '')
      .replace(/\n?```$/, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return {
      success: false,
      status: 500,
      error: createError(
        ErrorCodes.RESPONSE_PARSE_FAILURE,
        'The model returned an unexpected response format.',
        { raw_response_preview: rawResponse.slice(0, 200) }
      ),
    };
  }

  // Validate against schema
  const validated = ScoreCandidateResponseSchema.safeParse(parsed);
  if (!validated.success) {
    console.log('SCHEMA VALIDATION ERRORS:', JSON.stringify(validated.error.issues, null, 2));
    console.log('PARSED RESPONSE:', JSON.stringify(parsed, null, 2));
    return {
      success: false,
      status: 500,
      error: createError(
        ErrorCodes.RESPONSE_PARSE_FAILURE,
        'The model response did not match the expected schema.',
        { raw_response_preview: rawResponse.slice(0, 200) }
      ),
    };
  }

  return {
    success: true,
    data: validated.data,
  };
}