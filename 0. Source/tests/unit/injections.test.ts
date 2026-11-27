// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { DatabaseConnection } from '@/lib/server/db/connection';
import { InjectionRepository } from '@/lib/server/repos/injections';
import { BackupService } from '@/lib/server/backup/service';
import { clickLedger, residualTrend, type InjectionEntry } from '@/lib/injections';
import { validateFields } from '@/lib/validation/mutations';

const date = '2020-01-01T00:00:00.000Z';
const pen = { name: '테스트 펜', drug: 'semaglutide' as const, capacityMcg: 1000, closed: false };
const dose = { penId: 'p', amountMcg: 350, takenAt: date };
let connection: DatabaseConnection;
let repo: InjectionRepository;
beforeEach(() => {
  connection = new DatabaseConnection({ filename: () => ':memory:', migrationsFolder: path.resolve('drizzle') });
  repo = new InjectionRepository(connection.get(), 'a');
});
afterEach(() => connection.close());

describe('injection journal', () => {
  it('keeps retries, corrections, closure and remaining inventory consistent', () => {
    const p = repo.savePen('p', pen, null);
    const first = repo.saveEntry('a1', dose, null);
    repo.saveEntry('a1', dose, null);
    expect(repo.journal().entries).toHaveLength(1);
    repo.saveEntry('a2', { ...dose, amountMcg: 650 }, null);
    expect(() => repo.saveEntry('a3', dose, null)).toThrow();
    expect(() => repo.savePen('p', { ...pen, drug: 'tirzepatide' }, p.updatedAt)).toThrow();
    const changed = repo.saveEntry('a1', { ...dose, amountMcg: 125 }, first.updatedAt);
    expect(() => repo.saveEntry('a1', dose, first.updatedAt)).toThrow();
    expect(() => repo.remove('entries', 'a1', first.updatedAt)).toThrow();
    repo.savePen('p', { ...pen, closed: true }, p.updatedAt);
    expect(() => repo.saveEntry('a3', { ...dose, amountMcg: 10 }, null)).toThrow();
    repo.remove('entries', 'a1', changed.updatedAt);
    expect(repo.journal().entries).toHaveLength(1);
  });

  it('isolates accounts and rolls back an import that exceeds capacity', () => {
    const p = repo.savePen('p', pen, null);
    const e = repo.saveEntry('e', dose, null);
    const other = new InjectionRepository(connection.get(), 'b');
    expect(other.journal()).toEqual({ pens: [], entries: [] });
    expect(() => other.savePen('p', pen, p.updatedAt)).toThrow();
    expect(() => other.saveEntry('other', dose, null)).toThrow();
    other.remove('entries', e.id, e.updatedAt);
    const backup = new BackupService(() => connection.get());
    const data = backup.exportFor('a');
    expect(() => backup.importFor('a', { mode: 'replace', data: { ...data, injectionPens: [{ ...p, capacityMcg: 1 }] } })).toThrow();
    expect(repo.journal().entries).toEqual([e]);
    expect(repo.journal().pens).toEqual([p]);
  });

  it('restores private examples separately and protects them during journal edits', () => {
    const backup = new BackupService(() => connection.get());
    const p = repo.savePen('p', pen, null);
    const entry = repo.saveEntry('sample-entry', dose, null);
    const exported = backup.exportFor('a');
    const sample = { ...p, isExample: true };
    backup.importFor('a', { mode: 'replace', data: { ...exported, injectionPens: [sample] } });
    expect(repo.journal()).toEqual({ pens: [], entries: [] });
    expect(repo.journal(true).examples).toEqual({ pens: [sample], entries: [entry] });
    expect(new InjectionRepository(connection.get(), 'b').journal(true).examples).toBeUndefined();
    repo.savePen('live', pen, null);
    expect(() => repo.saveEntry(entry.id, { ...dose, penId: 'live' }, entry.updatedAt)).toThrow();
    expect(() => repo.savePen('p', pen, p.updatedAt)).toThrow();
    expect(() => repo.remove('entries', entry.id, entry.updatedAt)).toThrow();
    expect(() => repo.saveEntry('new', dose, null)).toThrow();
    expect(() => backup.importFor('a', { mode: 'merge', data: exported })).toThrow();
    expect(backup.exportFor('a').injectionPens.find(row => row.id === 'p')?.isExample).toBe(true);
  });

  it('keeps click counts optional, chronological and independent of recorded drug amounts', () => {
    const p = repo.savePen('p', { ...pen, startingClicks: 40 }, null);
    const first = repo.saveEntry('1', { ...dose, usedClicks: 7 }, null);
    const second = repo.saveEntry('2', dose, null);
    const last = repo.saveEntry('3', { ...dose, amountMcg: 30, usedClicks: 0 }, null);
    const ledger = () => clickLedger(repo.journal());
    expect(ledger().afterEntry.get(first.id)).toBe(33);
    expect(ledger().afterEntry.has(last.id)).toBe(false);
    expect(ledger().byPen.get(p.id)).toMatchObject({ used: 7, missing: 1, remaining: null });
    const revised = repo.saveEntry(second.id, { ...dose, usedClicks: 33 }, second.updatedAt);
    expect(ledger().byPen.get(p.id)?.remaining).toBe(0);
    const legacy = repo.saveEntry(second.id, { ...dose, amountMcg: 100 }, revised.updatedAt);
    expect(legacy.usedClicks).toBe(33);
    const backup = new BackupService(() => connection.get());
    backup.importFor('a', { mode: 'replace', data: backup.exportFor('a') });
    expect(ledger().afterEntry.get(last.id)).toBe(0);
    repo.savePen(p.id, { ...pen, startingClicks: 39 }, p.updatedAt);
    expect(ledger().byPen.get(p.id)?.remaining).toBeNull();
    repo.remove('entries', second.id, legacy.updatedAt);
    expect(ledger().byPen.get(p.id)?.remaining).toBe(32);
    repo.savePen('blank', pen, null);
    expect(ledger().byPen.get('blank')?.remaining).toBeNull();
    for (const invalid of [-1, 1.5, '10']) {
      expect(() => validateFields('injectionEntries', { ...dose, usedClicks: invalid })).toThrow();
      expect(() => validateFields('injectionPens', { ...pen, startingClicks: invalid })).toThrow();
    }
  });

  it('rejects fractional inventory units, ambiguous local times and future records', () => {
    for (const invalid of [{ amountMcg: 0.6 }, { amountMcg: 0 }, { takenAt: '2020-01-01T16:00' }, { takenAt: '2999-01-01T01:00:00.000Z' }]) {
      expect(() => validateFields('injectionEntries', { ...dose, ...invalid })).toThrow();
    }
  });

  it.each([['semaglutide', 7], ['tirzepatide', 5]] as const)('preserves the historical baseline and half-life for %s', (drug, days) => {
    const end = Date.parse(date) + days * 86400000;
    const rows = [{ ...dose } as InjectionEntry];
    expect(residualTrend(rows, drug, end, 1).at(-1)?.value).toBeCloseTo(50);
    expect(residualTrend(rows, drug, end, 28).at(-1)?.value).toBeCloseTo(50);
    const repeated = residualTrend([...rows, { ...rows[0], takenAt: new Date(end).toISOString() }], drug, end, 28);
    expect(repeated.at(-2)?.value).toBeCloseTo(100 / 3);
    expect(repeated.at(-1)?.value).toBe(100);
  });
});
