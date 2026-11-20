import 'server-only';
import { getDb } from '../db/client';
import type { BinderDatabase } from '../db/connection';
import { GoalRepository } from './goals';
import { CategoryRepository } from './categories';
import { ProjectRepository } from './projects';
import { TodoRepository } from './todos';
import { TimeBlockRepository } from './timeBlocks';
import { AnnualGoalRepository } from './annualGoals';
import { HabitRepository } from './habits';
import { HabitLogRepository } from './habitLogs';
import { BookRepository } from './books';
import { FocusNoteRepository } from './focusNotes';
import { RetrospectiveRepository } from './retrospectives';
import { SettingsRepository } from './settings';
import { WeeklyTemplateRepository } from './weeklyTemplates';
import { InsightsRepository } from './insights';
import { MorningBootRepository } from './morningBoot';
import { EveningShutdownRepository } from './eveningShutdown';
import { DailyCheckinRepository } from './dailyCheckins';
import { MetricRepository } from './metrics';
import { NoteRepository } from './notes';
import { PersonRepository } from './people';
import { LifeEventRepository } from './lifeEvents';

/** Composes all domain repositories around the same database and authenticated owner. */
export class UserRepositories {
  readonly goals: GoalRepository;
  readonly categories: CategoryRepository;
  readonly projects: ProjectRepository;
  readonly todos: TodoRepository;
  readonly timeBlocks: TimeBlockRepository;
  readonly annualGoals: AnnualGoalRepository;
  readonly habits: HabitRepository;
  readonly habitLogs: HabitLogRepository;
  readonly books: BookRepository;
  readonly focusNotes: FocusNoteRepository;
  readonly retrospectives: RetrospectiveRepository;
  readonly settings: SettingsRepository;
  readonly weeklyTemplates: WeeklyTemplateRepository;
  readonly insights: InsightsRepository;
  readonly morningBoot: MorningBootRepository;
  readonly eveningShutdown: EveningShutdownRepository;
  readonly dailyCheckins: DailyCheckinRepository;
  readonly metrics: MetricRepository;
  readonly notes: NoteRepository;
  readonly people: PersonRepository;
  readonly lifeEvents: LifeEventRepository;

  constructor(database: BinderDatabase, userId: string) {
    this.goals = new GoalRepository(database, userId);
    this.categories = new CategoryRepository(database, userId);
    this.projects = new ProjectRepository(database, userId);
    this.todos = new TodoRepository(database, userId);
    this.timeBlocks = new TimeBlockRepository(database, userId);
    this.annualGoals = new AnnualGoalRepository(database, userId);
    this.habits = new HabitRepository(database, userId);
    this.habitLogs = new HabitLogRepository(database, userId);
    this.books = new BookRepository(database, userId);
    this.focusNotes = new FocusNoteRepository(database, userId);
    this.retrospectives = new RetrospectiveRepository(database, userId);
    this.settings = new SettingsRepository(database, userId);
    this.weeklyTemplates = new WeeklyTemplateRepository(database, userId);
    this.insights = new InsightsRepository(database, userId);
    this.morningBoot = new MorningBootRepository(database, userId);
    this.eveningShutdown = new EveningShutdownRepository(database, userId);
    this.dailyCheckins = new DailyCheckinRepository(database, userId);
    this.metrics = new MetricRepository(database, userId);
    this.notes = new NoteRepository(database, userId);
    this.people = new PersonRepository(database, userId);
    this.lifeEvents = new LifeEventRepository(database, userId);
  }
}

export const getUserRepositories = (userId: string) => new UserRepositories(getDb(), userId);
