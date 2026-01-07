import { useEffect, useState } from "react";
import { css } from "@linaria/core";
import { Link } from "react-router";
import { api } from "../lib/api";
import type { Project } from "../lib/types";

const page = css`
  min-height: 100vh;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  color: white;
  padding: 40px 20px;
`;

const container = css`
  max-width: 900px;
  margin: 0 auto;
`;

const header = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
`;

const title = css`
  font-size: 32px;
  font-weight: 900;
  color: #fbbf24;
`;

const backButton = css`
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }
`;

const createSection = css`
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 30px;
`;

const formTitle = css`
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 16px;
  color: #fbbf24;
`;

const input = css`
  width: 100%;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  font-size: 14px;
  margin-bottom: 12px;
  
  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }
`;

const button = css`
  padding: 10px 24px;
  background: linear-gradient(180deg, #4a9eff, #2563eb);
  border: none;
  border-radius: 8px;
  color: white;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const projectList = css`
  display: grid;
  gap: 16px;
`;

const projectCard = css`
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
  }
`;

const projectHeader = css`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
`;

const projectName = css`
  font-size: 20px;
  font-weight: 700;
  color: #60a5fa;
`;

const projectDescription = css`
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.5;
  margin-bottom: 12px;
`;

const projectMeta = css`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  gap: 16px;
`;

const archiveButton = css`
  padding: 6px 12px;
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: #ff6b6b;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(239, 68, 68, 0.3);
  }
`;

const emptyState = css`
  text-align: center;
  padding: 60px 20px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 16px;
`;

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      setLoading(true);
      const data = await api.listProjects();
      setProjects(data);
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!name.trim()) return;
    
    try {
      setCreating(true);
      await api.createProject(name, description);
      setName("");
      setDescription("");
      await loadProjects();
    } catch (err) {
      console.error("Failed to create project:", err);
      alert("Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  async function handleArchive(id: number) {
    if (!confirm("Archive this project?")) return;
    
    try {
      await api.archiveProject(id);
      await loadProjects();
    } catch (err) {
      console.error("Failed to archive project:", err);
      alert("Failed to archive project");
    }
  }

  const activeProjects = projects.filter(p => !p.archived);

  return (
    <div className={page}>
      <div className={container}>
        <div className={header}>
          <h1 className={title}>📁 Projects</h1>
          <Link to="/board" className={backButton}>
            ← Back to Board
          </Link>
        </div>

        <div className={createSection}>
          <div className={formTitle}>Create New Project</div>
          <input
            className={input}
            type="text"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <input
            className={input}
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button
            className={button}
            onClick={handleCreate}
            disabled={!name.trim() || creating}
          >
            {creating ? "Creating..." : "Create Project"}
          </button>
        </div>

        {loading ? (
          <div className={emptyState}>Loading projects...</div>
        ) : activeProjects.length === 0 ? (
          <div className={emptyState}>
            No projects yet. Create one to organize your tasks!
          </div>
        ) : (
          <div className={projectList}>
            {activeProjects.map((project) => (
              <div key={project.id} className={projectCard}>
                <div className={projectHeader}>
                  <div className={projectName}>{project.name}</div>
                  <button
                    className={archiveButton}
                    onClick={() => handleArchive(project.id)}
                  >
                    Archive
                  </button>
                </div>
                {project.description && (
                  <div className={projectDescription}>{project.description}</div>
                )}
                <div className={projectMeta}>
                  <span>Created: {new Date(project.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
