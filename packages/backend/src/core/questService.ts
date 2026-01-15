import type { TaskRepo } from './repos/taskRepo.js';
import type { QuestRepo } from './repos/questRepo.js';

// Minimal quest service: keeps quests roughly in sync with task actions.
export class QuestService {
  constructor(
    private taskRepo: TaskRepo,
    private questRepo: QuestRepo
  ) {}

  refreshProgress() {
    // For now, just ensure at least one “create a task” daily quest exists/active.
    const existing = this.questRepo.get('q_daily_create_task');
    const tasks = this.taskRepo.list();
    if (!existing) return;

    if (existing.status === 'active' && tasks.length > 0) {
      // don’t auto-complete; the Go code completes via explicit claim
      // but we can keep it active for now.
    }
  }

  getActiveQuests() {
    return this.questRepo.listActive();
  }

  claimRewards(id: string) {
    const q = this.questRepo.get(id);
    if (!q) return { ok: false as const, rewards: [] as any[] };
    this.questRepo.complete(id);
    return { ok: true as const, rewards: q.rewards };
  }

  processDayEnd() {
    // Placeholder for end-of-day quest logic.
  }

  unlockNextStoryQuest() {
    // Placeholder.
  }
}

