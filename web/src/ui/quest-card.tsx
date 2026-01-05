import { css } from "@linaria/core";

export type QuestType = "daily" | "story" | "seasonal" | "boss" | "failure";
export type QuestStatus = "locked" | "active" | "in_progress" | "complete" | "failed";

export interface QuestObjective {
  op: string;
  count: number;
  time_window: string;
}

export interface QuestProgress {
  objective_index: number;
  current: number;
  required: number;
  complete: boolean;
}

export interface QuestReward {
  kind: string;
  currency?: string;
  amount?: number;
  card_type?: string;
  card_count?: number;
  xp?: number;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  scope: string;
  season?: string;
  difficulty: string;
  objectives: QuestObjective[];
  rewards: QuestReward[];
  status: QuestStatus;
  progress?: QuestProgress[];
  week?: number;
  day?: number;
}

const questCard = css`
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
  border: 2px solid #4c1d95;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #8b5cf6, #a78bfa);
  }
  
  &[data-complete="true"] {
    border-color: #10b981;
    background: linear-gradient(135deg, #064e3b 0%, #065f46 100%);
    
    &::before {
      background: linear-gradient(90deg, #10b981, #34d399);
    }
  }
`;

const questHeader = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const questTitle = css`
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  margin: 0;
`;

const questBadge = css`
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  &[data-type="daily"] {
    background: #3b82f6;
    color: #fff;
  }
  
  &[data-type="story"] {
    background: #8b5cf6;
    color: #fff;
  }
  
  &[data-type="boss"] {
    background: #dc2626;
    color: #fff;
  }
  
  &[data-type="seasonal"] {
    background: #f59e0b;
    color: #fff;
  }
`;

const questDescription = css`
  font-size: 13px;
  color: #cbd5e1;
  margin: 0 0 12px;
  line-height: 1.5;
`;

const objectiveList = css`
  margin: 12px 0;
`;

const objective = css`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  font-size: 13px;
  color: #e2e8f0;
`;

const progressBar = css`
  flex: 1;
  height: 8px;
  background: #1e293b;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: linear-gradient(90deg, #8b5cf6, #a78bfa);
    transition: width 0.3s ease;
    width: var(--progress);
  }
`;

const progressText = css`
  font-size: 12px;
  color: #94a3b8;
  min-width: 50px;
  text-align: right;
`;

const rewardSection = css`
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const rewardBadge = css`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(139, 92, 246, 0.2);
  border: 1px solid rgba(139, 92, 246, 0.4);
  border-radius: 6px;
  font-size: 12px;
  color: #a78bfa;
`;

const completeButton = css`
  width: 100%;
  margin-top: 12px;
  padding: 10px;
  background: linear-gradient(135deg, #10b981, #059669);
  border: none;
  border-radius: 6px;
  color: white;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

interface QuestCardProps {
  quest: Quest;
  onComplete?: (questId: string) => void;
}

export function QuestCard({ quest, onComplete }: QuestCardProps) {
  const isComplete = quest.status === "complete";
  const canClaim = quest.progress?.every(p => p.complete) && quest.status !== "complete";
  
  return (
    <div className={questCard} data-complete={isComplete}>
      <div className={questHeader}>
        <h3 className={questTitle}>{quest.title}</h3>
        <span className={questBadge} data-type={quest.type}>
          {quest.type}
        </span>
      </div>
      
      <p className={questDescription}>{quest.description}</p>
      
      <div className={objectiveList}>
        {quest.objectives.map((obj, i) => {
          const progress = quest.progress?.[i];
          const percent = progress
            ? Math.min(100, (progress.current / progress.required) * 100)
            : 0;
          
          return (
            <div key={i} className={objective}>
              <div className={progressBar} style={{ "--progress": `${percent}%` } as any} />
              <span className={progressText}>
                {progress?.current || 0}/{obj.count}
              </span>
            </div>
          );
        })}
      </div>
      
      {quest.rewards.length > 0 && (
        <div className={rewardSection}>
          {quest.rewards.map((reward, i) => (
            <span key={i} className={rewardBadge}>
              {reward.kind === "currency" && `${reward.amount} ${reward.currency}`}
              {reward.kind === "card" && `${reward.card_count}x ${reward.card_type}`}
              {reward.kind === "xp" && `${reward.xp} XP`}
            </span>
          ))}
        </div>
      )}
      
      {canClaim && (
        <button
          className={completeButton}
          onClick={() => onComplete?.(quest.id)}
        >
          ✨ Claim Rewards
        </button>
      )}
      
      {isComplete && (
        <div style={{ marginTop: 12, textAlign: "center", color: "#10b981", fontWeight: 600 }}>
          ✓ Complete
        </div>
      )}
    </div>
  );
}
