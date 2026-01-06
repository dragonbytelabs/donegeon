import { useEffect, useState } from "react";
import { css } from "@linaria/core";
import { api } from "../lib/api";
import { type Quest, QuestCard } from "../ui/quest-card";

const container = css`
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
  background: #0a0a0f;
  min-height: 100vh;
`;

const header = css`
  margin-bottom: 32px;
  
  h1 {
    font-size: 32px;
    font-weight: 800;
    color: #fff;
    margin: 0 0 8px;
    background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  p {
    color: #94a3b8;
    font-size: 14px;
    margin: 0;
  }
`;

const section = css`
  margin-bottom: 32px;
`;

const sectionTitle = css`
  font-size: 18px;
  font-weight: 700;
  color: #e2e8f0;
  margin: 0 0 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid #1e293b;
`;

const emptyState = css`
  text-align: center;
  padding: 48px 24px;
  color: #64748b;
  font-size: 14px;
  background: #0f172a;
  border-radius: 12px;
  border: 1px dashed #1e293b;
`;

export default function QuestsPage() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadQuests() {
    try {
      setLoading(true);
      const data = await api.listActiveQuests();
      setQuests(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load quests");
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteQuest(questId: string) {
    try {
      await api.completeQuest(questId);
      // Reload quests
      await loadQuests();
    } catch (err: any) {
      console.error("Failed to complete quest:", err);
      alert(`Failed to complete quest: ${err.message}`);
    }
  }

  useEffect(() => {
    loadQuests();
  }, []);

  if (loading) {
    return (
      <div className={container}>
        <div className={emptyState}>Loading quests...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={container}>
        <div className={emptyState} style={{ color: "#ef4444" }}>
          Error: {error}
        </div>
      </div>
    );
  }

  const activeQuests = quests?.filter(q => q.status === "active" || q.status === "in_progress") || [];
  const completedQuests = quests?.filter(q => q.status === "complete") || [];

  return (
    <div className={container}>
      <div className={header}>
        <h1>⚔️ Quests</h1>
        <p>Complete quests to earn rewards and unlock new features</p>
      </div>

      {activeQuests.length > 0 && (
        <div className={section}>
          <h2 className={sectionTitle}>Active Quests</h2>
          {activeQuests.map((quest) => (
            <QuestCard
              key={quest.id}
              quest={quest}
              onComplete={handleCompleteQuest}
            />
          ))}
        </div>
      )}

      {completedQuests.length > 0 && (
        <div className={section}>
          <h2 className={sectionTitle}>Completed</h2>
          {completedQuests.map((quest) => (
            <QuestCard key={quest.id} quest={quest} />
          ))}
        </div>
      )}

      {activeQuests.length === 0 && completedQuests.length === 0 && (
        <div className={emptyState}>
          No active quests. Check back tomorrow for new daily quests!
        </div>
      )}
    </div>
  );
}
