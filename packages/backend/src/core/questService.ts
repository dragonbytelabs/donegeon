import type { TaskRepo } from './repos/taskRepo.js';
import type { QuestRepo } from './repos/questRepo.js';
import type { BoardEventDto } from '@donegeon/app/api';

// Minimal quest service: keeps quests roughly in sync with task actions.
export class QuestService {
  constructor(
    private taskRepo: TaskRepo,
    private questRepo: QuestRepo
  ) {}

  refreshProgress(): { events: BoardEventDto[] } {
    const events: BoardEventDto[] = [];
    
    // Check "create a task" daily quest
    const existing = this.questRepo.get('q_daily_create_task');
    const tasks = this.taskRepo.list();
    
    if (existing && existing.status === 'active') {
      const prevCompleted = existing.status === 'complete';
      const shouldBeComplete = tasks.length > 0;
      
      if (!prevCompleted && shouldBeComplete) {
        // Quest just became completable
        existing.status = 'complete';
        this.questRepo.update(existing);
        events.push({ 
          kind: 'quest_completed', 
          quest_id: existing.id, 
          title: existing.title 
        } as any);
      }
    }
    
    return { events };
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

