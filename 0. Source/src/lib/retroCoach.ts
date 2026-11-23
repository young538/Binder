import { summarizeSubscriptions, formatCurrency } from './subscriptions';
import type {
  Book,
  Category,
  DailyCheckin,
  Project,
  Retrospective,
  Subscription,
  TimeBlock,
  Todo,
} from './types';

export type RetroCoachMode = 'weekly' | 'monthly';

export type RetroCoachProvider = 'local' | 'gemini' | 'openai';

export type RetroCoachRequestedProvider = 'auto' | 'openai' | 'gemini' | 'local';

export interface RetroCoachStatus {
  configuredProviders: ('openai' | 'gemini')[];
  defaultProvider: 'auto' | 'openai' | 'gemini';
  models: {
    openai?: string;
    gemini?: string;
  };
}

export interface RetroCoachCategoryStat {
  categoryId: string;
  name: string;
  color: string;
  planMin: number;
  actualMin: number;
  diffMin: number;
}

export interface RetroCoachDraft {
  good: string;
  bad: string;
  nextStep: string;
}

export interface RetroCoachMetrics {
  planMin: number;
  actualMin: number;
  executionRate: number | null;
  todoDone: number;
  todoTotal: number;
  habitPercent: number;
  completedProjectsCount: number;
  finishedBooksCount: number;
  avgSleep: number | null;
  avgEnergy: number | null;
  avgStress: number | null;
}

export interface RetroCoachResponse {
  mode: RetroCoachMode;
  period: string;
  startDate: string;
  endDate: string;
  provider: RetroCoachProvider;
  model?: string;
  fallbackReason?: string;
  metrics: RetroCoachMetrics;
  categoryStats: RetroCoachCategoryStat[];
  insights: string[];
  draft: RetroCoachDraft;
  promptText: string;
}

export interface RetroCoachInput {
  mode: RetroCoachMode;
  period: string;
  startDate: string;
  endDate: string;
  blocks: TimeBlock[];
  todos: Todo[];
  categories: Category[];
  completedProjects: Project[];
  finishedBooks: Book[];
  checkins: DailyCheckin[];
  habitPercent: number;
  subscriptions?: Subscription[];
  existingRetro?: Retrospective | null;
}

function fmtHours(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}시간` : `${hours.toFixed(1)}시간`;
}

function average(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((sum, n) => sum + n, 0) / nums.length) * 10) / 10;
}

function computeSleepOrEnergyInsight(
  blocks: TimeBlock[],
  checkins: DailyCheckin[],
): string | null {
  if (checkins.length === 0) return null;

  const actualMinByDay = new Map<string, number>();
  for (const block of blocks) {
    if ((block.kind ?? 'plan') !== 'actual') continue;
    actualMinByDay.set(
      block.date,
      (actualMinByDay.get(block.date) ?? 0) + Math.max(0, block.endMin - block.startMin),
    );
  }

  const sleepCheckins = checkins.filter((c): c is DailyCheckin & { sleepHours: number } => c.sleepHours != null);
  const rested = sleepCheckins.filter(c => c.sleepHours >= 7);
  const short = sleepCheckins.filter(c => c.sleepHours < 7);

  if (rested.length > 0 && short.length > 0) {
    const avgRestedMin = rested.reduce((s, c) => s + (actualMinByDay.get(c.date) ?? 0), 0) / rested.length;
    const avgShortMin = short.reduce((s, c) => s + (actualMinByDay.get(c.date) ?? 0), 0) / short.length;
    if (avgRestedMin > 0 || avgShortMin > 0) {
      return `수면 7시간 이상인 날(${rested.length}일) 평균 실행 시간은 ${fmtHours(Math.round(avgRestedMin))}이고, 7시간 미만인 날(${short.length}일)은 ${fmtHours(Math.round(avgShortMin))}입니다.`;
    }
  }

  const energyCheckins = checkins.filter((c): c is DailyCheckin & { energy: 1 | 2 | 3 | 4 | 5 } => c.energy != null);
  const highEnergy = energyCheckins.filter(c => c.energy >= 4);
  const lowEnergy = energyCheckins.filter(c => c.energy <= 2);
  if (highEnergy.length > 0 && lowEnergy.length > 0) {
    const avgHigh = highEnergy.reduce((s, c) => s + (actualMinByDay.get(c.date) ?? 0), 0) / highEnergy.length;
    const avgLow = lowEnergy.reduce((s, c) => s + (actualMinByDay.get(c.date) ?? 0), 0) / lowEnergy.length;
    return `에너지 4점 이상인 날(${highEnergy.length}일) 평균 실행은 ${fmtHours(Math.round(avgHigh))}, 2점 이하인 날(${lowEnergy.length}일)은 ${fmtHours(Math.round(avgLow))}였습니다.`;
  }

  const avgSleep = average(sleepCheckins.map(c => c.sleepHours));
  const avgEnergy = average(energyCheckins.map(c => c.energy));
  const parts: string[] = [];
  if (avgSleep != null) parts.push(`평균 수면 ${avgSleep}시간`);
  if (avgEnergy != null) parts.push(`평균 에너지 ${avgEnergy}/5`);
  if (parts.length === 0) return null;
  return `컨디션 체크인 ${checkins.length}일 기준 ${parts.join(', ')}를 기록했습니다.`;
}

/** Deterministic pattern analyzer and Korean draft generator for weekly/monthly retrospectives. */
export function buildRetroCoachSummary(input: RetroCoachInput): RetroCoachResponse {
  const periodLabel = input.mode === 'weekly' ? '이번 주' : '이번 달';
  const nextLabel = input.mode === 'weekly' ? '다음 주' : '다음 달';

  let planMin = 0;
  let actualMin = 0;
  const catMap = new Map<string, RetroCoachCategoryStat>();
  for (const cat of input.categories) {
    catMap.set(cat.id, {
      categoryId: cat.id,
      name: cat.name,
      color: cat.color,
      planMin: 0,
      actualMin: 0,
      diffMin: 0,
    });
  }

  for (const block of input.blocks) {
    const dur = Math.max(0, block.endMin - block.startMin);
    const kind = block.kind ?? 'plan';
    if (kind === 'plan') planMin += dur;
    else actualMin += dur;

    let stat = catMap.get(block.categoryId);
    if (!stat) {
      stat = {
        categoryId: block.categoryId,
        name: '미분류',
        color: '#9ca3af',
        planMin: 0,
        actualMin: 0,
        diffMin: 0,
      };
      catMap.set(block.categoryId, stat);
    }
    if (kind === 'plan') stat.planMin += dur;
    else stat.actualMin += dur;
    stat.diffMin = stat.actualMin - stat.planMin;
  }

  const categoryStats = [...catMap.values()]
    .filter(stat => stat.planMin > 0 || stat.actualMin > 0)
    .sort((a, b) => b.actualMin - a.actualMin || b.planMin - a.planMin);

  const countableTodos = input.todos.filter(t => t.status !== 'cancelled');
  const todoDone = countableTodos.filter(t => t.status === 'done').length;
  const todoTotal = countableTodos.length;
  const executionRate = planMin > 0 ? Math.round((actualMin / planMin) * 100) : null;

  const avgSleep = average(input.checkins.map(c => c.sleepHours).filter((v): v is number => v != null));
  const avgEnergy = average(input.checkins.map(c => c.energy).filter((v): v is 1 | 2 | 3 | 4 | 5 => v != null));
  const avgStress = average(input.checkins.map(c => c.stress).filter((v): v is 1 | 2 | 3 | 4 | 5 => v != null));

  const topActualCat = categoryStats.find(c => c.actualMin > 0) ?? null;
  const underPlannedCat = [...categoryStats]
    .filter(c => c.planMin - c.actualMin >= 30)
    .sort((a, b) => (b.planMin - b.actualMin) - (a.planMin - a.actualMin))[0] ?? null;
  const overflowCat = [...categoryStats]
    .filter(c => c.actualMin - c.planMin >= 30)
    .sort((a, b) => (b.actualMin - b.planMin) - (a.actualMin - a.planMin))[0] ?? null;

  const insights: string[] = [];

  if (actualMin > 0 && executionRate != null && topActualCat) {
    insights.push(
      `${periodLabel} 실제 기록 시간은 ${fmtHours(actualMin)}(계획 대비 ${executionRate}%)이며, 가장 많은 시간을 쓴 영역은 '${topActualCat.name}'(${fmtHours(topActualCat.actualMin)})입니다.`,
    );
  } else if (actualMin > 0 && topActualCat) {
    insights.push(
      `${periodLabel} 계획 블록 없이 실제 기록 ${fmtHours(actualMin)}을 남겼으며, 핵심 영역은 '${topActualCat.name}'(${fmtHours(topActualCat.actualMin)})입니다.`,
    );
  } else if (planMin > 0) {
    insights.push(
      `${periodLabel} 계획된 시간은 ${fmtHours(planMin)}이지만 아직 실제 확정 블록이 없습니다. 일일 화면에서 '계획 → 실제 확정'을 활용해 보세요.`,
    );
  } else {
    insights.push(
      `${periodLabel} 아직 시간 블록 기록이 없습니다. 작은 30분 블록부터 기록하면 패턴 분석이 정교해집니다.`,
    );
  }

  if (underPlannedCat && overflowCat) {
    insights.push(
      `시간 배분 차이: '${underPlannedCat.name}'은 계획보다 ${fmtHours(underPlannedCat.planMin - underPlannedCat.actualMin)} 덜 진행됐고, '${overflowCat.name}'은 ${fmtHours(overflowCat.actualMin - overflowCat.planMin)} 더 쓰였습니다.`,
    );
  } else if (underPlannedCat) {
    insights.push(
      `'${underPlannedCat.name}' 영역은 계획(${fmtHours(underPlannedCat.planMin)}) 대비 실제(${fmtHours(underPlannedCat.actualMin)})가 ${fmtHours(underPlannedCat.planMin - underPlannedCat.actualMin)} 부족해 시간 버퍼 점검이 필요합니다.`,
    );
  } else if (overflowCat) {
    insights.push(
      `'${overflowCat.name}' 영역에 계획보다 ${fmtHours(overflowCat.actualMin - overflowCat.planMin)} 더 투입했습니다. 계획 단계에 여유를 미리 반영해 보세요.`,
    );
  }

  const bioInsight = computeSleepOrEnergyInsight(input.blocks, input.checkins);
  if (bioInsight) {
    insights.push(bioInsight);
  }

  const todoRate = todoTotal > 0 ? Math.round((todoDone / todoTotal) * 100) : null;
  const milestoneParts: string[] = [];
  if (todoRate != null) milestoneParts.push(`할 일 ${todoDone}/${todoTotal}(${todoRate}%)`);
  milestoneParts.push(`습관 달성률 ${input.habitPercent}%`);
  if (input.completedProjects.length > 0) {
    milestoneParts.push(`완료 프로젝트 ${input.completedProjects.length}개`);
  }
  if (input.finishedBooks.length > 0) {
    milestoneParts.push(`완독 ${input.finishedBooks.length}권`);
  }
  insights.push(`${periodLabel} 실행 성과: ${milestoneParts.join(' · ')}.`);

  const subscriptionSummary = input.subscriptions
    ? summarizeSubscriptions(input.subscriptions, input.endDate)
    : null;
  if (input.mode === 'monthly' && subscriptionSummary && subscriptionSummary.activeCount > 0) {
    const monthlyText = subscriptionSummary.monthlyByCurrency
      .map(item => formatCurrency(item.amount, item.currency))
      .join(' · ');
    insights.push(
      `고정 구독 점검: 활성 구독 ${subscriptionSummary.activeCount}건(월 환산 ${monthlyText || '₩0'})이 유지 중입니다.`,
    );
  }

  // Build non-empty draft suggestions grounded in observed data.
  const goodLines: string[] = [];
  if (topActualCat) {
    goodLines.push(`- '${topActualCat.name}' 영역에 ${fmtHours(topActualCat.actualMin)} 집중해 핵심 리듬을 지켰습니다.`);
  }
  if (todoDone > 0) {
    goodLines.push(`- 할 일 ${todoDone}건을 완료했습니다${todoRate != null ? ` (완료율 ${todoRate}%)` : ''}.`);
  }
  if (input.habitPercent >= 70) {
    goodLines.push(`- 습관 달성률 ${input.habitPercent}%로 꾸준한 루틴을 유지했습니다.`);
  }
  if (input.completedProjects.length > 0) {
    goodLines.push(`- 프로젝트 완료: ${input.completedProjects.map(p => p.title).join(', ')}`);
  }
  if (input.finishedBooks.length > 0) {
    goodLines.push(`- 완독 도서: ${input.finishedBooks.map(b => b.title).join(', ')}`);
  }
  if (goodLines.length === 0) {
    goodLines.push(`- ${periodLabel} 회고 화면을 열고 기록을 점검한 것 자체가 다음 주기를 정리하는 좋은 출발점입니다.`);
  }

  const badLines: string[] = [];
  if (underPlannedCat) {
    badLines.push(
      `- '${underPlannedCat.name}' 계획 대비 실행 격차가 ${fmtHours(underPlannedCat.planMin - underPlannedCat.actualMin)} 발생했습니다.`,
    );
  }
  if (todoTotal > 0 && todoDone < todoTotal) {
    const remaining = todoTotal - todoDone;
    badLines.push(`- 예정한 할 일 ${todoTotal}건 중 ${remaining}건이 미완료로 남았습니다.`);
  }
  if (avgSleep != null && avgSleep < 6.5) {
    badLines.push(`- 평균 수면이 ${avgSleep}시간으로 짧아 컨디션과 집중력이 떨어질 여지가 있었습니다.`);
  }
  if (input.habitPercent > 0 && input.habitPercent < 50) {
    badLines.push(`- 습관 달성률이 ${input.habitPercent}%에 머물러 루틴 난이도나 시간대 조정이 필요합니다.`);
  }
  if (badLines.length === 0) {
    badLines.push(`- 큰 누수는 없었지만, 계획 블록과 실제 기록의 차이를 매일 마감 때 한 번 더 점검하면 좋습니다.`);
  }

  let nextStep = `${nextLabel}에는 하루 첫 90분 가장 중요한 작업 1건만 먼저 확정해 실행하세요.`;
  if (underPlannedCat) {
    nextStep = `${nextLabel} 일정에서 '${underPlannedCat.name}' 블록을 하루 시작 시간대에 먼저 고정하고 예상 시간의 1.2배 버퍼를 두기.`;
  } else if (avgSleep != null && avgSleep < 7) {
    nextStep = `${nextLabel} 컨디션 회복을 위해 수면 7시간 이상 확보하고, 이브닝 셧다운으로 다음 날 할 일 3개만 추리기.`;
  } else if (todoTotal > 0 && todoRate != null && todoRate < 70) {
    nextStep = `${nextLabel} 일일 할 일 수를 지금보다 20% 줄여 핵심 3가지 완주율 높이기.`;
  }

  const categoryTable =
    categoryStats.length > 0
      ? categoryStats
          .map(
            c =>
              `  * ${c.name}: 계획 ${fmtHours(c.planMin)} / 실제 ${fmtHours(c.actualMin)} (차이 ${
                c.diffMin >= 0 ? '+' : '-'
              }${fmtHours(Math.abs(c.diffMin))})`,
          )
          .join('\n')
      : '  * 기록된 시간 블록 없음';

  const existingDraftText = [
    input.existingRetro?.template?.good ? `좋았던 것: ${input.existingRetro.template.good}` : '',
    input.existingRetro?.template?.bad ? `아쉬운 것: ${input.existingRetro.template.bad}` : '',
    input.existingRetro?.template?.nextStep ? `다음 행동: ${input.existingRetro.template.nextStep}` : '',
    input.existingRetro?.freeText ? `자유 메모: ${input.existingRetro.freeText}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const promptText = [
    `당신은 개인 생산성·라이프 OS 코치입니다. 아래 ${input.period} (${input.startDate} ~ ${input.endDate}) 기록을 바탕으로 냉정하고 따뜻한 ${input.mode === 'weekly' ? '주간' : '월간'} 회고 피드백과 ${nextLabel} 실행 전략을 제안해 주세요.`,
    '',
    '[실행 요약]',
    `- 시간: 계획 ${fmtHours(planMin)} / 실제 ${fmtHours(actualMin)}${executionRate != null ? ` (달성률 ${executionRate}%)` : ''}`,
    `- 할 일: ${todoDone}/${todoTotal} 완료, 습관 달성률 ${input.habitPercent}%`,
    `- 컨디션: 평균 수면 ${avgSleep != null ? `${avgSleep}시간` : '미기록'}, 에너지 ${avgEnergy ?? '미기록'}/5, 스트레스 ${avgStress ?? '미기록'}/5`,
    `- 완료 프로젝트(${input.completedProjects.length}개): ${input.completedProjects.map(p => p.title).join(', ') || '없음'}`,
    `- 완독 도서(${input.finishedBooks.length}권): ${input.finishedBooks.map(b => b.title).join(', ') || '없음'}`,
    '',
    '[카테고리별 계획 대비 실제]',
    categoryTable,
    existingDraftText ? `\n[내가 적은 메모]\n${existingDraftText}` : '',
    '',
    '요청:',
    '1) 이번 기간에서 가장 잘 작동한 시스템 1가지',
    '2) 계획과 실제가 어긋난 핵심 원인 1가지',
    `3) ${nextLabel} 바로 적용할 수 있는 구체적 실험 1가지`,
  ]
    .filter(line => line !== '')
    .join('\n');

  return {
    mode: input.mode,
    period: input.period,
    startDate: input.startDate,
    endDate: input.endDate,
    provider: 'local',
    metrics: {
      planMin,
      actualMin,
      executionRate,
      todoDone,
      todoTotal,
      habitPercent: input.habitPercent,
      completedProjectsCount: input.completedProjects.length,
      finishedBooksCount: input.finishedBooks.length,
      avgSleep,
      avgEnergy,
      avgStress,
    },
    categoryStats,
    insights,
    draft: {
      good: goodLines.join('\n'),
      bad: badLines.join('\n'),
      nextStep,
    },
    promptText,
  };
}
