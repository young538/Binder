import 'server-only';
import { getDb } from '../db/client';
import type { BinderDatabase } from '../db/connection';
import { GoalRepository } from './goals';
import { CategoryRepository } from './categories';
import { TodoRepository } from './todos';
import { TimeBlockRepository } from './timeBlocks';
import { AnnualGoalRepository } from './annualGoals';
import { HabitRepository } from './habits';
import { HabitLogRepository } from './habitLogs';
import { BookRepository } from './books';
import { FocusNoteRepository } from './focusNotes';
import { RetrospectiveRepository } from './retrospectives';
import { SettingsRepository } from './settings';

/** Composes all domain repositories around the same database and authenticated owner. */
export class UserRepositories {
  readonly goals: GoalRepository;
  readonly categories: CategoryRepository;
  readonly todos: TodoRepository;
  readonly timeBlocks: TimeBlockRepository;
  readonly annualGoals: AnnualGoalRepository;
  readonly habits: HabitRepository;
  readonly habitLogs: HabitLogRepository;
  readonly books: BookRepository;
  readonly focusNotes: FocusNoteRepository;
  readonly retrospectives: RetrospectiveRepository;
  readonly settings: SettingsRepository;

  constructor(database: BinderDatabase, userId: string) {
    this.goals = new GoalRepository(database, userId);
    this.categories = new CategoryRepository(database, userId);
    this.todos = new TodoRepository(database, userId);
    this.timeBlocks = new TimeBlockRepository(database, userId);
    this.annualGoals = new AnnualGoalRepository(database, userId);
    this.habits = new HabitRepository(database, userId);
    this.habitLogs = new HabitLogRepository(database, userId);
    this.books = new BookRepository(database, userId);
    this.focusNotes = new FocusNoteRepository(database, userId);
    this.retrospectives = new RetrospectiveRepository(database, userId);
    this.settings = new SettingsRepository(database, userId);
  }
}

export const getUserRepositories = (userId: string) => new UserRepositories(getDb(), userId);
