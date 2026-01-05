import { Link, useFetcher } from "react-router";
import type { Task } from "../lib/types";
import { useRef } from "react";
import { groupTasksByProject, listProjects } from "../lib/projects";
import { useViewMode } from "../lib/view";
import type { inboxAction } from "../routes/inbox.route";
import InboxRow from "../ui/inbox-row";
import { css } from "@linaria/core";

// Styled components
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

const headerActions = css`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const completedLink = css`
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

const viewToggle = css`
  background: transparent;
  border: 1px solid #404040;
  color: #888;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  
  &:hover {
    color: #e5e5e5;
    border-color: #666;
  }
`;

const addTaskCard = css`
  background: #242424;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
`;

const inputGroup = css`
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
`;

const input = css`
  flex: 1;
  background: #1a1a1a;
  border: 1px solid #404040;
  border-radius: 6px;
  padding: 10px 12px;
  color: #e5e5e5;
  font-size: 14px;
  font-family: inherit;
  
  &:focus {
    outline: none;
    border-color: #8b5cf6;
  }
  
  &::placeholder {
    color: #666;
  }
`;

const button = css`
  background: #8b5cf6;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  font-family: inherit;
  
  &:hover {
    background: #7c3aed;
  }
  
  &:active {
    transform: translateY(1px);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const projectLinks = css`
  font-size: 12px;
  color: #888;
  margin-top: 8px;
  
  a {
    color: #8b5cf6;
    text-decoration: none;
    
    &:hover {
      text-decoration: underline;
    }
  }
`;

const section = css`
  margin-bottom: 32px;
`;

const sectionHeader = css`
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #666;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  span {
    opacity: 0.6;
    font-weight: 400;
  }
`;

const taskList = css`
  background: #242424;
  border: 1px solid #333;
  border-radius: 8px;
  overflow: hidden;
`;

export default function InboxManagerView({ tasks }: { tasks: Task[] }) {
    const createFetcher = useFetcher<typeof inboxAction>();
    const formRef = useRef<HTMLFormElement>(null);
    
    // Filter out completed tasks
    const activeTasks = tasks.filter(t => !t.completed);
    
    const projects = listProjects(activeTasks);
    const grouped = groupTasksByProject(activeTasks);

    const { mode, setMode } = useViewMode();
    
    return (
        <div className={container}>
            <div className={header}>
                <h1>⚔️ Task Dungeon</h1>
                <div className={headerActions}>
                    <Link to="/completed" className={completedLink}>
                        ✅ Completed
                    </Link>
                    <button 
                        className={viewToggle}
                        onClick={() => setMode(mode === "manager" ? "game" : "manager")}
                    >
                        View: {mode === "manager" ? "Manager" : "Game"}
                    </button>
                </div>
            </div>
            
            <div className={addTaskCard}>
                <createFetcher.Form method="post" ref={formRef}>
                    <input type="hidden" name="intent" value="create" />

                    <div className={inputGroup}>
                        <input 
                            className={input} 
                            name="name" 
                            placeholder="What needs to be done?"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.currentTarget.form?.requestSubmit();
                                }
                            }}
                        />
                        <button 
                            className={button} 
                            type="submit" 
                            disabled={createFetcher.state !== "idle"}
                        >
                            {createFetcher.state === "submitting" ? "Adding..." : "+ Add Task"}
                        </button>
                    </div>
                    
                    <div className={inputGroup}>
                        <input 
                            className={input} 
                            name="description" 
                            placeholder="Description (optional)" 
                        />
                        <input 
                            className={input} 
                            name="projectName" 
                            placeholder="Project (e.g. home, work)" 
                        />
                    </div>
                </createFetcher.Form>

                {projects.length > 0 && (
                    <div className={projectLinks}>
                        Projects:{" "}
                        {projects.map((p, i) => (
                            <span key={p}>
                                <Link to={`/project/${encodeURIComponent(p)}`}>{p}</Link>
                                {i < projects.length - 1 ? ", " : ""}
                            </span>
                        ))}
                    </div>
                )}
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
                                {project === '(no project)' ? 'Inbox' : `📁 ${project}`}
                            </div>
                            <span>{ts.length} task{ts.length !== 1 ? 's' : ''}</span>
                        </div>

                        <div className={taskList}>
                            {ts
                                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                                .map((t) => (
                                    <InboxRow key={t.id} t={t} />
                                ))}
                        </div>
                    </div>
                ))}
        </div>
    )
}
