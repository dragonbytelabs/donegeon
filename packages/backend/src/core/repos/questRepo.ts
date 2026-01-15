import type { QuestModel, QuestType } from '../types.js';

export class QuestRepo {
  private byId = new Map<string, QuestModel>();

  seed(qs: QuestModel[]) {
    for (const q of qs) this.byId.set(q.id, q);
  }

  list(): QuestModel[] {
    return [...this.byId.values()];
  }

  get(id: string): QuestModel | undefined {
    return this.byId.get(id);
  }

  listActive(): QuestModel[] {
    return this.list().filter((q) => q.status === 'active');
  }

  listByType(type: QuestType): QuestModel[] {
    return this.list().filter((q) => q.type === type);
  }

  complete(id: string): boolean {
    const q = this.byId.get(id);
    if (!q) return false;
    q.status = 'complete';
    this.byId.set(id, q);
    return true;
  }
}

