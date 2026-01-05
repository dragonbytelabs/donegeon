import { Link } from "react-router";
import type { Task } from "../lib/types";
import { groupTasksByProject } from "../lib/projects";
import { css } from "@linaria/core";

const container = css`
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
  background: #1a1a1a;
  min-height: 100vh;
  color: #e5e5e5;
`;

const header = css`
  margin-bottom: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  h1 {
    font-size: 28px;
    font-weight: 700;
    color: #fff;
    margin: 0;
  }
`;

const backLink = css`
  background: transparent;
  border: 1px solid #404040;
  color: #888;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  display: inline-block;
  
  &:hover {
    color: #e5e5e5;
    border-color: #666;
  }
`;

const section = css`
  margin-bottom: 24px;
`;

const sectionHeader = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #242424;
  border: 1px solid #333;
  border-radius: 8px 8px 0 0;
  font-weight: 600;
  font-size: 14px;
  color: #fff;
  
  span {
    color: #888;
    font-weight: 400;
    font-size: 13px;
  }
`;

const taskList = css`
  background: #1e1e1e;
  border: 1px solid #333;
  border-top: none;
  border-radius: 0 0 8px 8px;
  overflow: hidden;
`;

const taskRow = css`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #2a2a2a;
  transition: background 0.15s;
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background: #242424;
  }
`;

const checkbox = css`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid #4ade80;
  background: #4ade80;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
`;

const taskContent = css`
  flex: 1;
  min-width: 0;
`;

const taskName = css`
  color: #888;
  font-size: 14px;
  text-decoration: line-through;
  opacity: 0.7;
`;

const taskDescription = css`
  font-size: 12px;
  color: #666;
  margin-top: 4px;
`;

const emptyState = css`
  padding: 48px 24px;
  text-align: center;
  color: #666;
  font-size: 14px;
`;

export default function CompletedView({ tasks }: { tasks: Task[] }) {
    const grouped = groupTasksByProject(tasks);

    if (tasks.length === 0) {
        return (
            <div className={container}>
                <div className={header}>
                    <h1>✅ Completed Tasks</h1>
                    <Link to="/" className={backLink}>← Back to Inbox</Link>
                </div>
                <div className={emptyState}>
                    No completed tasks yet. Complete some tasks to see them here!
                </div>
            </div>
        );
    }

    return (
        <div className={container}>
            <div className={header}>
                <h1>✅ Completed Tasks</h1>
                <Link to="/" className={backLink}>← Back to Inbox</Link>
            </div>

            {Object.entries(grouped)
                .sort(([a], [b]) => {
                    if (a === '(no project)') return -1;
                    if (b === '(no project)') return 1;
                    return a.localeCompare(b);
                })
                .map(([project, ts]) => (
                    <div key={project} className={section}>
                        <div className={sectionHeader}>
                            <div>
                                {project === '(no project)' ? 'Completed' : `📁 ${project}`}
                            </div>
                            <span>{ts.length} task{ts.length !== 1 ? 's' : ''}</span>
                        </div>

                        <div className={taskList}>
                            {ts
                                .sort((a, b) => {
                                    // Sort by ID (most recent first, assuming higher IDs = newer)
                                    return b.id - a.id;
                                })
                                .map((t) => (
                                    <div key={t.id} className={taskRow}>
                                        <div className={checkbox}>✓</div>
                                        <div className={taskContent}>
                                            <div className={taskName}>{t.name}</div>
                                            {t.description && (
                                                <div className={taskDescription}>{t.description}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                ))}
        </div>
    );
}
