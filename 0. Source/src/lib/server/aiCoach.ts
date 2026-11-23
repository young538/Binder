import 'server-only';
import type {
  RetroCoachDraft,
  RetroCoachRequestedProvider,
  RetroCoachResponse,
  RetroCoachStatus,
} from '@/lib/retroCoach';

export const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

type RemoteCoachProvider = 'openai' | 'gemini';

interface RawCoachPayload {
  insights?: unknown;
  draft?: {
    good?: unknown;
    bad?: unknown;
    nextStep?: unknown;
  };
}

interface ProviderCallResult {
  response?: RetroCoachResponse;
  failureReason?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

export function parseCoachJson(
  text: string,
): { insights: string[]; draft: RetroCoachDraft } | null {
  try {
    const parsed = JSON.parse(stripJsonFence(text)) as RawCoachPayload;
    const insights = Array.isArray(parsed.insights)
      ? parsed.insights.filter(isNonEmptyString).map(line => line.trim()).slice(0, 5)
      : [];
    const good = parsed.draft?.good;
    const bad = parsed.draft?.bad;
    const nextStep = parsed.draft?.nextStep;

    if (
      insights.length === 0 ||
      !isNonEmptyString(good) ||
      !isNonEmptyString(bad) ||
      !isNonEmptyString(nextStep)
    ) {
      return null;
    }

    return {
      insights,
      draft: {
        good: good.trim(),
        bad: bad.trim(),
        nextStep: nextStep.trim(),
      },
    };
  } catch {
    return null;
  }
}

export function getPublicAiCoachStatus(
  env: NodeJS.ProcessEnv = process.env,
): RetroCoachStatus {
  const configuredProviders: RemoteCoachProvider[] = [];
  const models: RetroCoachStatus['models'] = {};

  if (env.OPENAI_API_KEY?.trim()) {
    configuredProviders.push('openai');
    models.openai = env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  }
  if (env.GEMINI_API_KEY?.trim()) {
    configuredProviders.push('gemini');
    models.gemini = env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  }

  const rawDefault = env.AI_COACH_PROVIDER?.trim().toLowerCase();
  const defaultProvider: RetroCoachStatus['defaultProvider'] =
    rawDefault === 'openai' || rawDefault === 'gemini' ? rawDefault : 'auto';

  return {
    configuredProviders,
    defaultProvider,
    models,
  };
}

function buildStructuredCoachPrompt(base: RetroCoachResponse): string {
  return [
    base.promptText,
    '',
    '반드시 아래 JSON 스키마로만 응답하세요:',
    '{',
    '  "insights": ["핵심 데이터 인사이트 3~4문장 (한국어, 구체적 숫자 근거 포함)"],',
    '  "draft": {',
    '    "good": "좋았던 것 2~3줄 (불릿 - 시작)",',
    '    "bad": "아쉬운 것 1~2줄 (불릿 - 시작)",',
    '    "nextStep": "다음 기간 바로 실천할 1가지 핵심 행동"',
    '  }',
    '}',
  ].join('\n');
}

function supportsTemperature(model: string): boolean {
  return !/^(o[1-9]|gpt-5)/i.test(model.trim());
}

function extractOpenAiContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
          return part.text;
        }
        return '';
      })
      .join('');
  }
  return '';
}

async function callOpenAiCoach(
  base: RetroCoachResponse,
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch,
): Promise<ProviderCallResult> {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      failureReason: 'OPENAI_API_KEY가 설정되지 않아 로컬 패턴 분석으로 생성했어요.',
    };
  }

  const model = env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const baseUrl = (env.OPENAI_BASE_URL?.trim() || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, '');
  const endpoint = `${baseUrl}/chat/completions`;

  const payload: Record<string, unknown> = {
    model,
    messages: [
      {
        role: 'system',
        content: '당신은 한국어로 답하는 개인 생산성·라이프 OS 코치입니다. 유효한 JSON 객체만 반환하세요.',
      },
      {
        role: 'user',
        content: buildStructuredCoachPrompt(base),
      },
    ],
    response_format: { type: 'json_object' },
  };
  if (supportsTemperature(model)) {
    payload.temperature = 0.4;
  }

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(`[retro-coach] OpenAI returned HTTP ${response.status}`);
      return {
        failureReason: 'OpenAI 응답을 받지 못해 대체 분석으로 생성했어요.',
      };
    }

    const raw = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const text = extractOpenAiContent(raw.choices?.[0]?.message?.content);
    const parsed = text ? parseCoachJson(text) : null;
    if (!parsed) {
      return {
        failureReason: 'OpenAI 응답 형식을 확인하지 못해 대체 분석으로 생성했어요.',
      };
    }

    return {
      response: {
        ...base,
        provider: 'openai',
        model,
        insights: parsed.insights,
        draft: parsed.draft,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.name : 'unknown error';
    console.warn(`[retro-coach] OpenAI request failed (${message})`);
    return {
      failureReason: 'OpenAI 연결이 지연되어 대체 분석으로 생성했어요.',
    };
  }
}

async function callGeminiCoach(
  base: RetroCoachResponse,
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch,
): Promise<ProviderCallResult> {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return {
      failureReason: 'GEMINI_API_KEY가 설정되지 않아 로컬 패턴 분석으로 생성했어요.',
    };
  }

  const model = env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildStructuredCoachPrompt(base) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.4,
        },
      }),
    });

    if (!response.ok) {
      console.warn(`[retro-coach] Gemini returned HTTP ${response.status}`);
      return {
        failureReason: 'Gemini 응답을 받지 못해 대체 분석으로 생성했어요.',
      };
    }

    const raw = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = raw.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = isNonEmptyString(text) ? parseCoachJson(text) : null;
    if (!parsed) {
      return {
        failureReason: 'Gemini 응답 형식을 확인하지 못해 대체 분석으로 생성했어요.',
      };
    }

    return {
      response: {
        ...base,
        provider: 'gemini',
        model,
        insights: parsed.insights,
        draft: parsed.draft,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.name : 'unknown error';
    console.warn(`[retro-coach] Gemini request failed (${message})`);
    return {
      failureReason: 'Gemini 연결이 지연되어 대체 분석으로 생성했어요.',
    };
  }
}

/** Optionally enriches local retrospective analysis using OpenAI / Gemini REST APIs with automatic fallback. */
export async function enrichRetroCoach(
  base: RetroCoachResponse,
  requestedProvider: RetroCoachRequestedProvider = 'auto',
  options?: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch },
): Promise<RetroCoachResponse> {
  if (requestedProvider === 'local') {
    return base;
  }

  const env = options?.env ?? process.env;
  const fetchImpl = options?.fetchImpl ?? fetch;

  const callOne = (provider: RemoteCoachProvider) =>
    provider === 'openai'
      ? callOpenAiCoach(base, env, fetchImpl)
      : callGeminiCoach(base, env, fetchImpl);

  if (requestedProvider === 'openai' || requestedProvider === 'gemini') {
    const result = await callOne(requestedProvider);
    if (result.response) return result.response;
    return {
      ...base,
      fallbackReason: result.failureReason ?? 'AI 응답을 받지 못해 로컬 패턴 분석으로 생성했어요.',
    };
  }

  const status = getPublicAiCoachStatus(env);
  if (status.configuredProviders.length === 0) {
    return base;
  }

  const preferredOrder: RemoteCoachProvider[] =
    status.defaultProvider === 'gemini' ? ['gemini', 'openai'] : ['openai', 'gemini'];
  const configuredSet = new Set(status.configuredProviders);
  const candidates = preferredOrder.filter(provider => configuredSet.has(provider));

  let lastFailure: string | undefined;
  for (const candidate of candidates) {
    const result = await callOne(candidate);
    if (result.response) {
      return result.response;
    }
    lastFailure = result.failureReason;
  }

  return {
    ...base,
    fallbackReason: lastFailure ?? 'AI 응답을 받지 못해 로컬 패턴 분석으로 생성했어요.',
  };
}
