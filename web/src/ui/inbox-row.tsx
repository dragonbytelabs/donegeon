import { useFetcher } from "react-router";
import type { inboxAction } from "../routes/inbox.route";
import type { Task } from "../lib/types";
import { css } from "@linaria/core";
import { useState } from "react";

const taskRow = css`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #2a2a2a;
  transition: all 0.15s;
  gap: 8px;
  position: relative;
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background: #2a2a2a;
  }
  
  &.live {
    background: rgba(34, 197, 94, 0.08);
    border-left: 3px solid #22c55e;
    padding-left: 9px;
  }
`;

const dragHandle = css`
  color: #555;
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  opacity: 0.4;
  transition: opacity 0.2s;
  font-size: 16px;
  
  &:active {
    cursor: grabbing;
  }
`;

const checkbox = css`
  width: 18px;
  height: 18px;
  min-width: 18px;
  border: 2px solid #555;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  font-size: 11px;
  
  &:hover {
    border-color: #22c55e;
    background: rgba(34, 197, 94, 0.1);
  }
`;

const taskContent = css`
  flex: 1;
  min-width: 0;
  cursor: pointer;
`;

const taskTitle = css`
  font-size: 14px;
  font-weight: 400;
  color: #e5e5e5;
  line-height: 1.4;
`;

const taskMeta = css`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 4px;
`;

const tag = css`
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  
  &.project {
    background: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
  }
  
  &.regular {
    background: #333;
    color: #999;
  }
  
  &.live-badge {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
  }
`;

const taskActions = css`
  display: flex;
  gap: 4px;
  opacity: 0.4;
  transition: opacity 0.2s;
`;

const actionButton = css`
  background: transparent;
  border: none;
  color: #888;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 16px;
  padding: 0;
  
  &:hover {
    background: #333;
    color: #e5e5e5;
  }
`;

const expandedSection = css`
  padding: 12px 16px 12px 56px;
  background: #1a1a1a;
  border-bottom: 1px solid #2a2a2a;
`;

const descriptionText = css`
  font-size: 13px;
  color: #999;
  line-height: 1.5;
  margin-bottom: 12px;
`;

const tagInputContainer = css`
  display: flex;
  gap: 6px;
  align-items: center;
`;

const tagInput = css`
  background: #242424;
  border: 1px solid #404040;
  border-radius: 4px;
  padding: 6px 10px;
  color: #e5e5e5;
  font-size: 13px;
  font-family: inherit;
  width: 250px;
  
  &:focus {
    outline: none;
    border-color: #8b5cf6;
  }
  
  &::placeholder {
    color: #666;
  }
`;

const addButton = css`
  background: #8b5cf6;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  
  &:hover {
    background: #7c3aed;
  }
`;

const cancelLink = css`
  background: transparent;
  color: #888;
  border: none;
  padding: 6px 8px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  text-decoration: none;
  
  &:hover {
    color: #e5e5e5;
  }
`;

export default function InboxRow({ t }: { t: Task; }) {
    const fetcher = useFetcher<typeof inboxAction>();
    const [showDetails, setShowDetails] = useState(false);
    const [showTagInput, setShowTagInput] = useState(false);
    const [tagValue, setTagValue] = useState("");
    const [completing, setCompleting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOver, setDragOver] = useState(false);

    const hasProject = t.tags?.some(tag => tag.startsWith('project:'));
    const projectName = hasProject ? t.tags?.find(tag => tag.startsWith('project:'))?.replace('project:', '') : null;
    const otherTags = t.tags?.filter(tag => !tag.startsWith('project:')) || [];
    const isLive = t.zone === 'live';
    
    const handleComplete = () => {
        setCompleting(true);
        fetcher.submit(
            { intent: "complete", id: String(t.id) }, 
            { method: "post" }
        );
    };
    
    const handleAddTag = () => {
        if (!tagValue.trim()) return;
        fetcher.submit(
            { intent: "tag", id: String(t.id), tag: tagValue.trim() }, 
            { method: "post" }
        );
        setShowTagInput(false);
        setTagValue("");
    };
    
    const handleDragStart = (e: React.DragEvent) => {
        setIsDragging(true);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(t.id));
    };
    
    const handleDragEnd = () => {
        setIsDragging(false);
    };
    
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOver(true);
    };
    
    const handleDragLeave = () => {
        setDragOver(false);
    };
    
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId === String(t.id)) return;
        
        console.log(`Reorder: move task ${draggedId} to position of task ${t.id}`);
        fetcher.submit(
            { intent: "reorder", sourceId: draggedId, targetId: String(t.id) }, 
            { method: "post" }
        );
    };

    return (
        <div>
            <div 
                className={`${taskRow} ${isLive ? 'live' : ''}`}
                draggable={true}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                    opacity: isDragging ? 0.5 : 1,
                    borderTop: dragOver ? '2px solid #8b5cf6' : undefined,
                }}
                onMouseEnter={(e) => {
                    const handle = e.currentTarget.querySelector('[data-drag-handle]') as HTMLElement;
                    const actions = e.currentTarget.querySelector('[data-actions]') as HTMLElement;
                    if (handle) handle.style.opacity = '1';
                    if (actions) actions.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                    const handle = e.currentTarget.querySelector('[data-drag-handle]') as HTMLElement;
                    const actions = e.currentTarget.querySelector('[data-actions]') as HTMLElement;
                    if (handle) handle.style.opacity = '0.4';
                    if (actions) actions.style.opacity = '0.4';
                }}
            >
                <div 
                    className={dragHandle} 
                    title="Drag to reorder" 
                    data-drag-handle
                    onMouseDown={(e) => {
                        // Make the parent draggable when clicking the handle
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                            parent.draggable = true;
                        }
                    }}
                >
                    ⋮⋮
                </div>
                
                <div 
                    className={checkbox}
                    onClick={handleComplete}
                    style={{ opacity: completing ? 0.5 : 1 }}
                >
                    {completing ? '⏳' : ''}
                </div>
                
                <div 
                    className={taskContent}
                    onClick={() => setShowDetails(!showDetails)}
                >
                    <div className={taskTitle}>{t.name}</div>
                    {!showDetails && (
                        <div className={taskMeta}>
                            {isLive && (
                                <span className={`${tag} live-badge`}>⚡ Live</span>
                            )}
                            {projectName && (
                                <span className={`${tag} project`}>📁 {projectName}</span>
                            )}
                            {otherTags.map(tagName => (
                                <span key={tagName} className={`${tag} regular`}>
                                    {tagName}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <div className={taskActions} data-actions>
                    <button
                        className={actionButton}
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowDetails(!showDetails);
                        }}
                        title="Edit task"
                    >
                        ✏️
                    </button>
                    
                    <button
                        className={actionButton}
                        onClick={(e) => {
                            e.stopPropagation();
                            console.log('Set date clicked for task', t.id);
                        }}
                        title="Set date"
                    >
                        📅
                    </button>
                    
                    <button
                        className={actionButton}
                        onClick={(e) => {
                            e.stopPropagation();
                            console.log('Comment clicked for task', t.id);
                        }}
                        title="Add comment"
                    >
                        💬
                    </button>
                    
                    <button
                        className={actionButton}
                        onClick={(e) => {
                            e.stopPropagation();
                            console.log('More actions clicked for task', t.id);
                        }}
                        title="More actions"
                    >
                        ⋯
                    </button>
                </div>
            </div>
            
            {showDetails && (
                <div className={expandedSection}>
                    {t.description && (
                        <div className={descriptionText}>{t.description}</div>
                    )}
                    
                    <div className={taskMeta} style={{ marginBottom: 12 }}>
                        {isLive && (
                            <span className={`${tag} live-badge`}>⚡ Live</span>
                        )}
                        {projectName && (
                            <span className={`${tag} project`}>📁 {projectName}</span>
                        )}
                        {otherTags.map(tagName => (
                            <span key={tagName} className={`${tag} regular`}>
                                {tagName}
                            </span>
                        ))}
                    </div>
                    
                    {!showTagInput ? (
                        <button
                            className={cancelLink}
                            onClick={() => setShowTagInput(true)}
                            style={{ padding: 0, fontSize: 13 }}
                        >
                            + Add tag
                        </button>
                    ) : (
                        <div className={tagInputContainer}>
                            <input
                                className={tagInput}
                                placeholder="Tag name (e.g. urgent, project:work)"
                                value={tagValue}
                                onChange={(e) => setTagValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddTag();
                                    if (e.key === 'Escape') {
                                        setShowTagInput(false);
                                        setTagValue("");
                                    }
                                }}
                                autoFocus
                            />
                            <button className={addButton} onClick={handleAddTag}>
                                Add
                            </button>
                            <button 
                                className={cancelLink} 
                                onClick={() => {
                                    setShowTagInput(false);
                                    setTagValue("");
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                    
                    {!isLive && (
                        <button
                            className={addButton}
                            style={{ marginTop: 12 }}
                            onClick={() => {
                                fetcher.submit(
                                    { intent: "process", id: String(t.id) }, 
                                    { method: "post" }
                                );
                            }}
                        >
                            → Move to Live
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}