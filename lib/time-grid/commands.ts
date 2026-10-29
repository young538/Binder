import type { TimeBlock, TimeBlockKind } from '@/lib/types';

type NewBlock = Omit<TimeBlock, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
interface TimeBlockWriter {
  create(data: NewBlock): Promise<unknown>;
  update(id: string, patch: Partial<NewBlock>): Promise<unknown>;
}
export interface BlockDestination {
  date: string;
  kind: TimeBlockKind;
  startMin: number;
}

/** Move/copy policy, independent of React events and the HTTP transport. */
export class TimeBlockCommands {
  constructor(private readonly writer: TimeBlockWriter) {}

  async transfer(block: TimeBlock, destination: BlockDestination, mode: 'move' | 'copy'): Promise<void> {
    const patch = { ...destination, endMin: destination.startMin + block.endMin - block.startMin };
    if (mode === 'copy') {
      await this.writer.create({
        ...patch, text: block.text, categoryId: block.categoryId, goalId: block.goalId,
        todoId: block.date === destination.date ? block.todoId : undefined,
      });
      return;
    }
    if (block.date === patch.date && (block.kind ?? 'plan') === patch.kind &&
        block.startMin === patch.startMin && block.endMin === patch.endMin) return;
    await this.writer.update(block.id, patch);
  }
}
