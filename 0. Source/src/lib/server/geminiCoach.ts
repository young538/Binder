import 'server-only';
import type { RetroCoachResponse } from '@/lib/retroCoach';

interface GeminiPayload {
  insights?: unknown;
  draft?: {
    good?: unknown;
    bad?: unknown;
    nextStep?: unknown;
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Optionally enriches local retrospective analysis using Gemini REST API when GEMINI_API_KEY is set. */
export async function enrichRetroCoachWithGemini(
  base: RetroCoachResponse,
): Promise<RetroCoachResponse> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return base;
  }

  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const systemPrompt = [
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

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.4,
        },
      }),
    });

    if (!response.ok) {
      console.warn(`[retro-coach] Gemini returned HTTP ${response.status}`);
      return {
        ...base,
        fallbackReason: 'Gemini 응답을 받지 못해 로컬 패턴 분석으로 생성했어요.',
      };
    }

    const raw = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = raw.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!isNonEmptyString(text)) {
      return {
        ...base,
        fallbackReason: 'Gemini 응답 형식을 확인하지 못해 로컬 패턴 분석으로 생성했어요.',
      };
    }

    const parsed = JSON.parse(text) as GeminiPayload;
    const insights = Array.isArray(parsed.insights)
      ? parsed.insights.filter(isNonEmptyString).slice(0, 5)
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
      return {
        ...base,
        fallbackReason: 'Gemini 응답 항목이 불완전해 로컬 패턴 분석으로 생성했어요.',
      };
    }

    return {
      ...base,
      provider: 'gemini',
      model,
      insights,
      draft: {
        good: good.trim(),
        bad: bad.trim(),
        nextStep: nextStep.trim(),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.name : 'unknown error';
    console.warn(`[retro-coach] Gemini request failed (${message})`);
    return {
      ...base,
      fallbackReason: 'Gemini 연결이 지연되어 로컬 패턴 분석으로 생성했어요.',
    };
  }
}
