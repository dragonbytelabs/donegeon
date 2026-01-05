import React, { useEffect, useRef } from "react";
import { useImmer } from "use-immer";
import { css } from "@linaria/core";
import { Link } from "react-router";
import { api } from "../lib/api";
import type {
    Task,
    Villager,
    Zombie,
    Inventory,
    Deck,
    Building,
    ModifierCard,
    Quest,
} from "../lib/types";

// Stacklands-style board
const board = css`
  position: fixed;
  inset: 0;
  background: 
    radial-gradient(circle at 20% 30%, rgba(120, 150, 100, 0.3), transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(100, 130, 90, 0.2), transparent 50%),
    linear-gradient(180deg, #8b9f7f 0%, #7a8f6f 100%);
  overflow: hidden;
  cursor: grab;
  user-select: none;

  &:active {
    cursor: grabbing;
  }
`;

const boardCanvas = css`
  position: absolute;
  width: 4000px;
  height: 4000px;
  top: 0;
  left: 0;
  pointer-events: none;
`;

const topBar = css`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  border-bottom: 2px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 20px;
  z-index: 100;
  color: white;
`;

const leftHud = css`
  position: fixed;
  top: 80px;
  left: 20px;
  width: 280px;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
  z-index: 100;
  color: white;
`;

const hudTitle = css`
  font-size: 16px;
  font-weight: 800;
  margin-bottom: 12px;
  color: #fbbf24;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const hudSection = css`
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  
  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }
`;

const hudLabel = css`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 6px;
  font-weight: 700;
`;

const hudValue = css`
  font-size: 14px;
  color: white;
  font-weight: 600;
`;

const backButton = css`
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 6px;
  
  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }
`;

const resourceDisplay = css`
  display: flex;
  gap: 15px;
  align-items: center;
  font-size: 14px;
  font-weight: 700;
`;

const resourceItem = css`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

const resourceIcon = css`
  font-size: 18px;
`;

const button = css`
  padding: 8px 16px;
  background: linear-gradient(180deg, #4a9eff, #2563eb);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  color: white;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.1s;

  &:hover {
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const card = css`
  position: absolute;
  width: 120px;
  height: 160px;
  background: white;
  border-radius: 12px;
  box-shadow: 
    0 8px 24px rgba(0, 0, 0, 0.3),
    0 2px 6px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  border: 2px solid rgba(0, 0, 0, 0.15);
  cursor: grab;
  transition: box-shadow 0.2s;
  display: flex;
  flex-direction: column;
  overflow: visible;
  pointer-events: auto;
  z-index: 1;

  &:hover {
    box-shadow: 
      0 12px 32px rgba(0, 0, 0, 0.4),
      0 4px 8px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.8);
    z-index: 2;
  }

  &:active {
    cursor: grabbing;
    z-index: 3;
  }
`;

const cardHeader = css`
  padding: 8px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.05), transparent);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(0, 0, 0, 0.6);
`;

const cardBody = css`
  flex: 1;
  padding: 10px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
`;

const cardTitle = css`
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 4px;
  color: #1a1a1a;
  line-height: 1.2;
`;

const cardSubtitle = css`
  font-size: 10px;
  color: rgba(0, 0, 0, 0.5);
  line-height: 1.3;
`;

const cardIcon = css`
  font-size: 32px;
  margin-bottom: 8px;
`;

const grabHandle = css`
  position: absolute;
  left: -30px;
  top: 50%;
  transform: translateY(-50%);
  width: 26px;
  height: 60px;
  background: #f3f4f6;
  border: 2px solid #374151;
  border-radius: 8px;
  cursor: grab;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  opacity: 0.1;
  transition: all 0.2s;
  z-index: 999;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  pointer-events: auto;

  &:hover {
    background: #ffffff;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.6);
    transform: translateY(-50%) scale(1.08);
  }

  &:active {
    cursor: grabbing;
    background: #e5e7eb;
  }
`;

const detailButton = css`
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.2s;
  z-index: 1000;
  pointer-events: auto;

  &:hover {
    background: white;
    transform: scale(1.1);
  }
`;

const completeButton = css`
  position: absolute;
  bottom: 4px;
  right: 4px;
  padding: 4px 8px;
  background: linear-gradient(180deg, #10b981, #059669);
  color: white;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
  transition: all 0.2s;
  z-index: 1000;
  pointer-events: auto;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);

  &:hover {
    background: linear-gradient(180deg, #059669, #047857);
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.98);
  }
`;

const detailPanel = css`
  position: fixed;
  right: 0;
  top: 60px;
  bottom: 0;
  width: 350px;
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(10px);
  border-left: 2px solid rgba(255, 255, 255, 0.1);
  z-index: 100;
  overflow-y: auto;
  padding: 20px;
  color: white;
`;

const detailPanelHeader = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
`;

const detailPanelTitle = css`
  font-size: 18px;
  font-weight: 700;
`;

const detailPanelClose = css`
  cursor: pointer;
  font-size: 24px;
  opacity: 0.7;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
`;

const slotSection = css`
  margin-bottom: 24px;
`;

const slotLabel = css`
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 10px;
`;

const slot = css`
  background: rgba(255, 255, 255, 0.05);
  border: 2px dashed rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
`;

const slotFilled = css`
  background: rgba(96, 165, 250, 0.2);
  border: 2px solid rgba(96, 165, 250, 0.5);
  color: white;
`;

const deckDisplay = css`
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 12px;
  z-index: 50;
`;

const deckCard = css`
  width: 80px;
  height: 110px;
  border-radius: 10px;
  background: linear-gradient(135deg, #7c3aed, #2563eb);
  border: 2px solid rgba(255, 255, 255, 0.3);
  box-shadow: 
    0 10px 24px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  transition: transform 0.2s;
  position: relative;

  &:hover {
    transform: translateY(-4px);
  }

  &:active {
    transform: translateY(-2px);
  }

  &[data-locked="true"] {
    opacity: 0.5;
    cursor: not-allowed;
    filter: grayscale(0.8);
  }
`;

const deckName = css`
  font-size: 10px;
  font-weight: 800;
  text-align: center;
  margin-top: 8px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
`;

const deckCost = css`
  font-size: 12px;
  font-weight: 700;
  margin-top: 4px;
`;

type CardEntity = {
    id: string;
    type: "villager" | "task" | "zombie" | "loot" | "modifier" | "building";
    x: number;
    y: number;
    data: any;
    parentId?: string; // Card this is stacked on
};

type State = {
    loading: boolean;
    error: string | null;

    // Camera
    cameraX: number;
    cameraY: number;

    // Entities
    cards: CardEntity[];

    // Resources
    inventory: Inventory | null;
    villagers: Villager[];
    tasks: Task[];
    zombies: Zombie[];
    quests: Quest[];
    decks: Deck[];
    buildings: Building[];

    // Drag state
    dragging: string | null;
    dragOffsetX: number;
    dragOffsetY: number;
    hoverTarget: string | null; // Card being hovered over during drag

    // Detail panel
    detailPanelCard: string | null; // Card to show details for
    hoveredCard: string | null; // Card currently being hovered
};

export default function BoardPage() {
    const [st, update] = useImmer<State>({
        loading: true,
        error: null,
        cameraX: 0,
        cameraY: 0,
        cards: [], // Start empty, will load positions in refresh()
        inventory: null,
        villagers: [],
        tasks: [],
        zombies: [],
        quests: [],
        decks: [],
        buildings: [],
        dragging: null,
        dragOffsetX: 0,
        dragOffsetY: 0,
        hoverTarget: null,
        detailPanelCard: null,
        hoveredCard: null,
    });

    const boardRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);

    // Get all cards in a stack (card + all children recursively)
    const getStack = (cardId: string, cards: CardEntity[]): CardEntity[] => {
        const card = cards.find(c => c.id === cardId);
        if (!card) return [];

        // Find all children
        const children = cards.filter(c => c.parentId === cardId);
        const allChildren = children.flatMap(child => getStack(child.id, cards));

        return [card, ...allChildren];
    };

    // Save board state to localStorage whenever cards change
    const saveBoardState = (cards: CardEntity[]) => {
        try {
            const positions = cards.map(c => ({
                id: c.id,
                type: c.type,
                x: c.x,
                y: c.y,
                parentId: c.parentId,
                // Save full data for modifier and loot cards since they're not reloaded from backend
                data: (c.type === 'modifier' || c.type === 'loot') ? c.data : undefined
            }));
            localStorage.setItem("boardState", JSON.stringify({ cards: positions }));
            console.log("Saved board state to localStorage:", positions.length, "cards");
        } catch (err) {
            console.warn("Failed to save board state:", err);
        }
    };

    // Load saved positions from localStorage (returns Map of id -> {x, y, parentId, data?})
    const loadSavedPositions = (): Map<string, { x: number; y: number; parentId?: string; data?: any }> => {
        try {
            const saved = localStorage.getItem("boardState");
            if (saved) {
                const parsed = JSON.parse(saved);
                const posMap = new Map<string, { x: number; y: number; parentId?: string; data?: any }>();
                if (parsed.cards) {
                    for (const card of parsed.cards) {
                        posMap.set(card.id, { x: card.x, y: card.y, parentId: card.parentId, data: card.data });
                    }
                    console.log("Loaded", posMap.size, "saved card positions from localStorage");
                }
                return posMap;
            }
        } catch (err) {
            console.warn("Failed to load board state:", err);
        }
        return new Map();
    };

    async function refresh() {
        update((d) => {
            d.loading = true;
            d.error = null;
        });

        try {
            const [inventory, villagers, tasks, zombies, decks, buildings, quests] = await Promise.all([
                api.loot(),
                api.villagers(),
                api.listTasks(),
                api.zombies(),
                api.listDecks(),
                api.listBuildings(),
                api.listQuests(),
            ]);

            update((d) => {
                d.inventory = inventory;
                d.villagers = villagers;
                d.tasks = tasks;
                d.zombies = zombies;
                d.decks = decks;
                d.buildings = buildings;
                d.quests = quests;
                d.loading = false;

                // Filter to only live tasks for board display
                const liveTasks = tasks.filter(t => t.zone === "live");

                // Load saved positions once on first render
                const savedPositions = d.cards.length === 0 ? loadSavedPositions() : new Map();

                // Initialize cards if empty
                if (d.cards.length === 0) {
                    console.log("Initializing cards:", { villagers: villagers.length, tasks: liveTasks.length, zombies: zombies.length });

                    // Place villagers prominently in top-center
                    villagers.forEach((v, i) => {
                        const cardId = `villager-${v.id}`;
                        const savedPos = savedPositions.get(cardId);
                        d.cards.push({
                            id: cardId,
                            type: "villager",
                            x: savedPos?.x ?? (800 + i * 180),
                            y: savedPos?.y ?? 150,
                            data: v,
                            parentId: savedPos?.parentId,
                        });
                    });

                    // Place only live tasks in a grid
                    liveTasks.forEach((t, i) => {
                        const cardId = `task-${t.id}`;
                        const savedPos = savedPositions.get(cardId);
                        d.cards.push({
                            id: cardId,
                            type: "task",
                            x: savedPos?.x ?? (400 + (i % 6) * 150),
                            y: savedPos?.y ?? (400 + Math.floor(i / 6) * 190),
                            data: t,
                            parentId: savedPos?.parentId,
                        });
                    });

                    // Place zombies in top-right
                    zombies.forEach((z, i) => {
                        const cardId = `zombie-${z.id}`;
                        const savedPos = savedPositions.get(cardId);
                        d.cards.push({
                            id: cardId,
                            type: "zombie",
                            x: savedPos?.x ?? (1500 + i * 150),
                            y: savedPos?.y ?? 150,
                            data: z,
                            parentId: savedPos?.parentId,
                        });
                    });

                    console.log("Cards initialized:", d.cards.length, savedPositions.size > 0 ? "(with saved positions)" : "");
                } else {
                    // Update existing card data with fresh data (keep positions!)
                    console.log("Updating existing cards with fresh data, preserving positions");

                    // Update villager cards
                    villagers.forEach((v) => {
                        const card = d.cards.find(c => c.id === `villager-${v.id}`);
                        if (card) {
                            card.data = v; // Update data but keep x, y
                        } else {
                            // Add new villager if it doesn't exist
                            d.cards.push({
                                id: `villager-${v.id}`,
                                type: "villager",
                                x: 800 + villagers.indexOf(v) * 180,
                                y: 150,
                                data: v,
                            });
                        }
                    });

                    // Update task cards (only live tasks)
                    liveTasks.forEach((t) => {
                        const card = d.cards.find(c => c.id === `task-${t.id}`);
                        if (card) {
                            card.data = t; // Update data but keep x, y
                        } else {
                            // Add new task if it doesn't exist
                            const taskIndex = liveTasks.indexOf(t);
                            d.cards.push({
                                id: `task-${t.id}`,
                                type: "task",
                                x: 400 + (taskIndex % 6) * 150,
                                y: 400 + Math.floor(taskIndex / 6) * 190,
                                data: t,
                            });
                        }
                    });

                    // Update zombie cards
                    zombies.forEach((z, i) => {
                        const card = d.cards.find(c => c.id === `zombie-${z.id}`);
                        if (card) {
                            card.data = z;
                        } else {
                            // Add new zombies
                            d.cards.push({
                                id: `zombie-${z.id}`,
                                type: "zombie",
                                x: 1500 + i * 150,
                                y: 150,
                                data: z,
                            });
                        }
                    });

                    // Remove zombie cards that no longer exist
                    const zombieIds = new Set(zombies.map(z => `zombie-${z.id}`));
                    d.cards = d.cards.filter(c => {
                        if (c.type === "zombie") {
                            return zombieIds.has(c.id);
                        }
                        return true;
                    });

                    // Remove task cards that are no longer live or don't exist
                    const liveTaskIds = new Set(liveTasks.map(t => `task-${t.id}`));
                    d.cards = d.cards.filter(c => {
                        if (c.type === "task") {
                            return liveTaskIds.has(c.id);
                        }
                        return true;
                    });

                    // Restore modifier and loot cards from localStorage if they're missing
                    const savedPositions = loadSavedPositions();
                    for (const [cardId, savedData] of savedPositions.entries()) {
                        // Check if this is a modifier or loot card that's not in the current cards
                        if (cardId.startsWith('drop-') && !d.cards.some(c => c.id === cardId) && savedData.data) {
                            console.log('Restoring saved card from localStorage:', cardId, savedData.data);

                            // Determine card type from saved data
                            let cardType: 'modifier' | 'loot' | 'task' | null = null;
                            let cardData = savedData.data;

                            // Handle different data structures
                            // Modifier cards have specific types like 'recurring_contract', 'deadline_pin', etc.
                            const modifierTypes = ['recurring_contract', 'deadline_pin', 'time_warp', 'double_time'];
                            if (modifierTypes.includes(savedData.data.type)) {
                                cardType = 'modifier';
                                // Data is already the modifier card
                            } else if (savedData.data.modifier_card) {
                                cardType = 'modifier';
                                cardData = savedData.data.modifier_card;
                            } else if (savedData.data.type === 'loot') {
                                cardType = 'loot';
                            } else if (savedData.data.type === 'blank_task') {
                                cardType = 'task';
                            }

                            if (cardType) {
                                d.cards.push({
                                    id: cardId,
                                    type: cardType,
                                    x: savedData.x,
                                    y: savedData.y,
                                    data: cardData,
                                    parentId: savedData.parentId,
                                });
                            }
                        }
                    }
                }
            });
        } catch (e: any) {
            update((d) => {
                d.error = String(e?.message ?? e);
                d.loading = false;
            });
        }
    }

    useEffect(() => {
        void refresh();
    }, []);

    // Camera drag
    const handleBoardMouseDown = (e: React.MouseEvent) => {
        if (e.target === boardRef.current || e.target === canvasRef.current) {
            const startX = e.clientX;
            const startY = e.clientY;
            const startCamX = st.cameraX;
            const startCamY = st.cameraY;

            const handleMove = (me: MouseEvent) => {
                const dx = me.clientX - startX;
                const dy = me.clientY - startY;
                update((d) => {
                    d.cameraX = startCamX + dx;
                    d.cameraY = startCamY + dy;
                });
            };

            const handleUp = () => {
                window.removeEventListener("mousemove", handleMove);
                window.removeEventListener("mouseup", handleUp);
            };

            window.addEventListener("mousemove", handleMove);
            window.addEventListener("mouseup", handleUp);
        }
    };

    // Card drag
    const handleCardMouseDown = (cardId: string, e: React.MouseEvent, isGrabHandle: boolean = false) => {
        e.stopPropagation();
        const cardEl = e.currentTarget as HTMLElement;
        const rect = cardEl.getBoundingClientRect();

        const card = st.cards.find(c => c.id === cardId);
        if (!card) return;

        // Determine if we should move the entire stack:
        // 1. If using grab handle, always move stack
        // 2. If card has no parent, check if it has children to move them too
        // 3. If card has a parent and NOT using grab handle, unstack it
        let shouldMoveStack = false;
        if (isGrabHandle) {
            shouldMoveStack = true;
        } else if (!card.parentId) {
            // Root card without grab handle - check if it has children
            const hasChildren = st.cards.some(c => c.parentId === cardId);
            shouldMoveStack = hasChildren;
        } else {
            // Card with parent and no grab handle - unstack it
            shouldMoveStack = false;
        }

        console.log("Started dragging card:", cardId, shouldMoveStack ? "(moving stack)" : "(moving solo)");

        update((d) => {
            d.dragging = cardId;
            d.dragOffsetX = e.clientX - rect.left;
            d.dragOffsetY = e.clientY - rect.top;
        });

        let currentHoverTarget: string | null = null;

        const handleMove = (me: MouseEvent) => {
            update((d) => {
                const cardIndex = d.cards.findIndex(c => c.id === cardId);
                if (cardIndex !== -1) {
                    const oldX = d.cards[cardIndex].x;
                    const oldY = d.cards[cardIndex].y;
                    const newX = me.clientX - d.cameraX - d.dragOffsetX;
                    const newY = me.clientY - d.cameraY - d.dragOffsetY - 60; // Account for top bar
                    const deltaX = newX - oldX;
                    const deltaY = newY - oldY;

                    // Move the dragged card
                    d.cards[cardIndex].x = newX;
                    d.cards[cardIndex].y = newY;

                    // Only move children if shouldMoveStack is true
                    if (shouldMoveStack) {
                        const moveChildren = (parentId: string) => {
                            const children = d.cards.filter(c => c.parentId === parentId);
                            for (const child of children) {
                                child.x += deltaX;
                                child.y += deltaY;
                                moveChildren(child.id); // Move grandchildren too
                            }
                        };
                        moveChildren(cardId);
                    } else {
                        // Unstack the card from its parent
                        d.cards[cardIndex].parentId = undefined;
                    }
                }

                // Check for hover target
                const draggedCard = d.cards[cardIndex];
                d.hoverTarget = null;

                // When dragging a modifier, prioritize finding task cards
                const isModifier = draggedCard.type === "modifier";
                const sortedCards = isModifier
                    ? [...d.cards].sort((a, b) => {
                        if (a.type === "task" && b.type !== "task") return -1;
                        if (a.type !== "task" && b.type === "task") return 1;
                        return 0;
                    })
                    : d.cards;

                for (const otherCard of sortedCards) {
                    if (otherCard.id === cardId) continue;

                    const dx = draggedCard.x - otherCard.x;
                    const dy = draggedCard.y - otherCard.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    // Within 80px = hovering
                    if (distance < 80) {
                        d.hoverTarget = otherCard.id;
                        currentHoverTarget = otherCard.id;
                        if (!currentHoverTarget || currentHoverTarget !== otherCard.id) {
                            console.log("Hovering over:", otherCard.id, otherCard.type, "distance:", distance);
                        }
                        break;
                    }
                }

                if (d.hoverTarget === null && currentHoverTarget !== null) {
                    console.log("No longer hovering");
                    currentHoverTarget = null;
                }
            });
        };

        const handleUp = () => {
            console.log("Mouse up! Hover target was:", currentHoverTarget);

            // Get current state
            const draggedCard = st.cards.find(c => c.id === cardId);
            const targetCard = currentHoverTarget ? st.cards.find(c => c.id === currentHoverTarget) : null;

            console.log("Dragged card:", draggedCard?.type, "Target card:", targetCard?.type);

            if (draggedCard && targetCard) {
                console.log("Calling handleCardDrop...");
                handleCardDrop(draggedCard, targetCard);
            } else {
                console.log("No valid drop target");
            }

            update((d) => {
                d.dragging = null;
                d.hoverTarget = null;
            });

            // Save card positions to localStorage after drag ends
            saveBoardState(st.cards);

            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", handleUp);
        };

        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", handleUp);
    };

    async function handleCompleteTask(taskId: number) {
        try {
            console.log('Completing task:', taskId);

            // Find the task card and its modifiers
            const taskCard = st.cards.find(c => c.id === `task-${taskId}`);
            if (!taskCard) {
                throw new Error('Task card not found');
            }

            const task = taskCard.data as Task;

            // Find attached modifiers and all child cards
            const attachedModifiers = st.cards.filter(c =>
                c.parentId === taskCard.id && c.type === 'modifier'
            );
            
            // Complete the task
            const result = await api.completeTask(taskId);
            console.log('Task completed successfully:', result);

            // Remove all modifiers attached to this task
            const modifierIds = attachedModifiers.map(m => m.id);
            
            // Build reward message
            let rewardMsg = `✓ Completed "${task.name}"!`;
            if (result.loot_drops && result.loot_drops.length > 0) {
                const lootSummary = result.loot_drops.map((drop: any) => 
                    `+${drop.amount} ${drop.type}`
                ).join(', ');
                rewardMsg += ` | Rewards: ${lootSummary}`;
            } else {
                rewardMsg += ` | Stamina restored!`;
            }
            
            // Immediately remove the task card and all its modifiers from board
            // Keep the villager if it exists
            update(d => {
                d.cards = d.cards.filter(c => {
                    // Remove the task
                    if (c.id === `task-${taskId}`) return false;
                    // Remove all modifiers that were attached to this task
                    if (modifierIds.includes(c.id)) return false;
                    // Keep everything else (including the villager)
                    return true;
                });
                
                // Unparent any cards that were children of the removed task
                d.cards.forEach(c => {
                    if (c.parentId === `task-${taskId}`) {
                        c.parentId = undefined;
                    }
                });
                
                d.error = rewardMsg;
                setTimeout(() => update((d) => { d.error = null; }), 4000);
            });

            // Refresh to get updated data (stamina returned, task moved to completed zone, quest progress)
            await refresh();

        } catch (e: any) {
            console.error('Failed to complete task:', e);
            update(d => {
                d.error = `✗ Failed to complete task: ${e.message}`;
                setTimeout(() => update((d) => { d.error = null; }), 3000);
            });
        }
    }

    // Handle card stacking logic
    async function handleCardDrop(draggedCard: CardEntity, targetCard: CardEntity) {
        console.log("handleCardDrop called with:", draggedCard.type, "->", targetCard.type);

        try {
            // Task + Villager = Assign task (either direction)
            if ((draggedCard.type === "task" && targetCard.type === "villager") ||
                (draggedCard.type === "villager" && targetCard.type === "task")) {

                const task = draggedCard.type === "task" ? draggedCard.data as Task : targetCard.data as Task;
                const villager = draggedCard.type === "villager" ? draggedCard.data as Villager : targetCard.data as Villager;

                console.log("Assigning task", task.id, "to villager", villager.id);
                console.log("Villager current stamina:", villager.stamina, "/", villager.max_stamina);

                if (villager.stamina > 0) {
                    console.log("Making API call to assignTask...");
                    const result = await api.assignTask(task.id, villager.id);
                    console.log("API call successful:", result);

                    update((d) => {
                        d.error = `✓ Assigned "${task.name}" to ${villager.name}`;
                        setTimeout(() => update((d) => { d.error = null; }), 2000);

                        // Stack task on villager with prominent offset
                        const taskCard = d.cards.find(c => c.id === `task-${task.id}`);
                        const villagerCard = d.cards.find(c => c.id === `villager-${villager.id}`);
                        if (taskCard && villagerCard) {
                            taskCard.parentId = villagerCard.id;
                            taskCard.x = villagerCard.x + 20;
                            taskCard.y = villagerCard.y + 20;
                        }
                    });

                    console.log("Calling refresh...");
                    await refresh();
                    console.log("Refresh complete");
                } else {
                    console.log("Villager has no stamina");
                    update((d) => {
                        d.error = `✗ ${villager.name} has no stamina left`;
                        setTimeout(() => update((d) => { d.error = null; }), 2000);
                    });
                }
            }

            // Modifier + Task = Apply modifier (either direction)
            else if ((draggedCard.type === "modifier" && targetCard.type === "task") ||
                (draggedCard.type === "task" && targetCard.type === "modifier")) {

                const modifier = draggedCard.type === "modifier" ? draggedCard.data as ModifierCard : targetCard.data as ModifierCard;
                const task = draggedCard.type === "task" ? draggedCard.data as Task : targetCard.data as Task;
                const taskCard = draggedCard.type === "task" ? draggedCard : targetCard;
                const modCard = draggedCard.type === "modifier" ? draggedCard : targetCard;

                console.log("Attaching modifier", modifier.id, "to task", task.id);
                
                // Check if this modifier type is already attached to the task
                const existingModifiers = st.cards.filter(c =>
                    c.parentId === taskCard.id && c.type === 'modifier'
                );
                const hasSameType = existingModifiers.some(mc => {
                    const existingMod = mc.data as ModifierCard;
                    return existingMod.type === modifier.type;
                });
                
                if (hasSameType) {
                    update((d) => {
                        d.error = `✗ Task already has a ${modifier.type.replace(/_/g, ' ')} modifier`;
                        setTimeout(() => update((d) => { d.error = null; }), 2000);
                    });
                    return;
                }

                const result = await api.attachModifier(task.id, modifier);
                console.log("Modifier attached:", result);

                update((d) => {
                    d.error = `✓ Applied ${modifier.type.replace(/_/g, ' ')} to "${task.name}"`;
                    setTimeout(() => update((d) => { d.error = null; }), 2000);

                    // Stack modifier on task - offset to top-left to avoid blocking info button
                    // Multiple modifiers on same task should be staggered
                    const modCardIndex = d.cards.findIndex(c => c.id === modCard.id);
                    if (modCardIndex !== -1) {
                        d.cards[modCardIndex].parentId = taskCard.id;

                        // Count how many modifiers are already on this task
                        const existingModifiers = d.cards.filter(c =>
                            c.parentId === taskCard.id && c.type === 'modifier' && c.id !== modCard.id
                        ).length;

                        // Stagger each modifier: first at -40,-40, second at -50,-50, third at -60,-60, etc.
                        const offset = 40 + (existingModifiers * 10);
                        d.cards[modCardIndex].x = taskCard.x - offset;
                        d.cards[modCardIndex].y = taskCard.y - offset;
                    }
                });
                await refresh();
            }

            // Task + Task = Check for recipe
            else if (draggedCard.type === "task" && targetCard.type === "task") {
                const task1 = draggedCard.data as Task;
                const task2 = targetCard.data as Task;

                console.log("Trying recipe with tasks", task1.id, "and", task2.id);

                // Try to execute recipe (backend will validate)
                try {
                    const result = await api.executeRecipe(task1.id, task2.id);
                    console.log("Recipe executed:", result);
                    update((d) => {
                        d.error = `✓ Recipe executed!`;
                        setTimeout(() => update((d) => { d.error = null; }), 2000);
                    });
                    await refresh();
                } catch (e: any) {
                    console.log("No recipe found:", e.message);
                    // No recipe found, ignore
                }
            }

            // Villager + Zombie = Attack zombie (either direction)
            else if ((draggedCard.type === "villager" && targetCard.type === "zombie") ||
                (draggedCard.type === "zombie" && targetCard.type === "villager")) {

                const villager = draggedCard.type === "villager" ? draggedCard.data as Villager : targetCard.data as Villager;
                const zombie = draggedCard.type === "zombie" ? draggedCard.data as Zombie : targetCard.data as Zombie;

                console.log("Attacking zombie", zombie.id, "with villager", villager.id);
                console.log("Villager current stamina:", villager.stamina, "/", villager.max_stamina);

                // Check if villager has stamina (using old API that expects "slots")
                if (villager.stamina >= 2) {
                    console.log("Making API call to clearZombie...");
                    const result = await api.clearZombie(zombie.id, 2); // Cost 2 stamina to attack
                    console.log("Zombie attack result:", result);

                    update((d) => {
                        d.error = `✓ ${villager.name} attacked zombie!`;
                        setTimeout(() => update((d) => { d.error = null; }), 2000);
                    });

                    await refresh();
                } else {
                    console.log("Villager has insufficient stamina");
                    update((d) => {
                        d.error = `✗ ${villager.name} needs 2 stamina to attack`;
                        setTimeout(() => update((d) => { d.error = null; }), 2000);
                    });
                }
            }

            // Loot + Villager = Consume loot for stamina boost (either direction)
            else if ((draggedCard.type === "loot" && targetCard.type === "villager") ||
                (draggedCard.type === "villager" && targetCard.type === "loot")) {

                const loot = draggedCard.type === "loot" ? draggedCard : targetCard;
                const lootData = loot.data as any;
                const villager = draggedCard.type === "villager" ? draggedCard.data as Villager : targetCard.data as Villager;

                console.log("Consuming loot", lootData.loot_type, "for villager", villager.id);

                // Apply loot effects
                if (lootData.loot_type === "ink") {
                    // Ink gives +1 stamina
                    update((d) => {
                        const villagerCard = d.cards.find(c => c.id === `villager-${villager.id}`);
                        if (villagerCard) {
                            const v = villagerCard.data as Villager;
                            v.stamina = Math.min(v.max_stamina, v.stamina + 1);
                        }
                        // Remove loot card
                        d.cards = d.cards.filter(c => c.id !== loot.id);
                        d.error = `✓ ${villager.name} gained +1 stamina from ink`;
                        setTimeout(() => update((d) => { d.error = null; }), 2000);
                    });
                } else if (lootData.loot_type === "paper") {
                    // Paper could be used for something else
                    update((d) => {
                        d.cards = d.cards.filter(c => c.id !== loot.id);
                        d.error = `✓ Paper consumed (no effect yet)`;
                        setTimeout(() => update((d) => { d.error = null; }), 2000);
                    });
                } else {
                    update((d) => {
                        d.error = `✗ ${lootData.loot_type} can't be used on villagers`;
                        setTimeout(() => update((d) => { d.error = null; }), 2000);
                    });
                }
            }

        } catch (e: any) {
            console.error("Drop error:", e);
            console.error("Error details:", e.message, e.stack);
            update((d) => {
                d.error = `✗ Error: ${String(e?.message ?? e)}`;
                setTimeout(() => update((d) => { d.error = null; }), 3000);
            });
        }
    }

    async function openDeck(deckId: string) {
        console.log("Opening deck:", deckId);
        try {
            const result = await api.openDeck(deckId);
            console.log("Deck opened, drops:", result.drops);

            // Add new cards to board
            update((d) => {
                let x = 300;
                let y = 600;

                result.drops.forEach((drop, i) => {
                    const cardId = `drop-${Date.now()}-${i}`;

                    if (drop.type === "loot") {
                        d.cards.push({
                            id: cardId,
                            type: "loot",
                            x: x + i * 140,
                            y: y,
                            data: drop,
                        });
                    } else if (drop.type === "modifier" && drop.modifier_card) {
                        d.cards.push({
                            id: cardId,
                            type: "modifier",
                            x: x + i * 140,
                            y: y,
                            data: drop.modifier_card,
                        });
                    } else if (drop.type === "blank_task") {
                        d.cards.push({
                            id: cardId,
                            type: "task",
                            x: x + i * 140,
                            y: y,
                            data: { id: -1, name: "Blank Task", zone: "inbox", completed: false },
                        });
                    }
                });
            });

            await refresh();
        } catch (e: any) {
            update((d) => {
                d.error = String(e?.message ?? e);
            });
        }
    }

    function renderCard(c: CardEntity) {
        const isHoverTarget = st.hoverTarget === c.id;
        const isDragging = st.dragging === c.id;
        const isHovered = st.hoveredCard === c.id;

        // Check if this card has children (is a stack root)
        const hasChildren = st.cards.some(card => card.parentId === c.id);

        // Only show grab handle on the stack root (has children but no parent)
        const isStackRoot = hasChildren && !c.parentId;

        // Calculate grab handle offset - needs to be further left if there are cards extending left
        let grabHandleLeftOffset = -30;
        if (isStackRoot) {
            // Get all cards in this stack (children and descendants)
            const stackCards: CardEntity[] = [c];
            const addChildren = (parentId: string) => {
                const children = st.cards.filter(card => card.parentId === parentId);
                children.forEach(child => {
                    stackCards.push(child);
                    addChildren(child.id);
                });
            };
            addChildren(c.id);

            // Find the leftmost x position in the stack
            const leftmostX = Math.min(...stackCards.map(card => card.x));

            // If there are cards to the left of this root card, adjust handle position
            if (leftmostX < c.x) {
                // Position handle relative to the leftmost card, accounting for card width
                grabHandleLeftOffset = leftmostX - c.x - 30;
            }
        }

        // Calculate z-index based on stack depth
        // Special case: modifiers should appear BEHIND their parent task
        let stackDepth = 0;
        let currentCard = c;
        const isModifierChild = c.type === 'modifier' && c.parentId;

        while (currentCard.parentId) {
            stackDepth++;
            currentCard = st.cards.find(card => card.id === currentCard.parentId) || currentCard;
            if (stackDepth > 10) break; // Prevent infinite loops
        }

        // Modifiers get negative z-index offset to appear behind parent
        const zIndexAdjustment = isModifierChild ? -5 : 0;

        const style: React.CSSProperties = {
            left: `${c.x}px`,
            top: `${c.y}px`,
            zIndex: isDragging ? 1000 : isHoverTarget ? 500 : (10 + stackDepth + zIndexAdjustment),
            boxShadow: isHoverTarget
                ? '0 0 0 4px rgba(59, 130, 246, 0.5), 0 12px 32px rgba(0, 0, 0, 0.4)'
                : undefined,
            borderColor: isHovered ? 'white' : undefined,
            borderWidth: isHovered ? '3px' : undefined,
            borderStyle: isHovered ? 'solid' : undefined,
            transform: isHoverTarget ? 'scale(1.05)' : undefined,
            transition: isDragging ? 'none' : 'all 0.2s',
        };

        if (c.type === "villager") {
            const v = c.data as Villager;
            const staminaPercent = v.max_stamina > 0 ? (v.stamina / v.max_stamina) : 0;
            const staminaColor = staminaPercent === 0 ? "#dc2626" : staminaPercent < 0.5 ? "#f59e0b" : "#10b981";

            return (
                <div
                    className={card}
                    style={{
                        ...style,
                        background: "linear-gradient(180deg, #ddd6fe, #c4b5fd)",
                        borderColor: staminaColor,
                        borderWidth: "3px",
                    }}
                    onMouseDown={(e) => handleCardMouseDown(c.id, e, hasChildren)}
                    onMouseEnter={() => update(d => { d.hoveredCard = c.id; })}
                    onMouseLeave={() => update(d => { d.hoveredCard = null; })}
                >
                    {isStackRoot && (
                        <div
                            className={grabHandle}
                            style={{ left: `${grabHandleLeftOffset}px` }}
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                handleCardMouseDown(c.id, e, true);
                            }}
                        >
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#374151' }} />
                                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#374151' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#374151' }} />
                                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#374151' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#374151' }} />
                                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#374151' }} />
                            </div>
                        </div>
                    )}
                    <div className={cardHeader} style={{ background: "linear-gradient(180deg, rgba(109, 40, 217, 0.1), transparent)" }}>
                        Villager
                    </div>
                    <div className={cardBody}>
                        <div className={cardIcon}>🧙</div>
                        <div className={cardTitle}>{v.name}</div>
                        <div className={cardSubtitle} style={{
                            color: staminaColor,
                            fontWeight: 700,
                            fontSize: "12px",
                            marginTop: "4px"
                        }}>
                            ⚡ {v.stamina}/{v.max_stamina} stamina
                        </div>
                    </div>
                </div>
            );
        }

        if (c.type === "task") {
            const t = c.data as Task;

            return (
                <div
                    className={card}
                    style={style}
                    onMouseDown={(e) => handleCardMouseDown(c.id, e)}
                    onMouseEnter={() => update(d => { d.hoveredCard = c.id; })}
                    onMouseLeave={() => update(d => { d.hoveredCard = null; })}
                >
                    <div
                        className={detailButton}
                        onClick={(e) => {
                            e.stopPropagation();
                            update(d => { d.detailPanelCard = c.id; });
                        }}
                    >
                        ℹ️
                    </div>
                    {t.assigned_villager && (
                        <div
                            className={completeButton}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCompleteTask(t.id);
                            }}
                        >
                            ✓ Done
                        </div>
                    )}
                    <div className={cardHeader}>Task</div>
                    <div className={cardBody}>
                        <div className={cardIcon}>📋</div>
                        <div className={cardTitle}>{t.name}</div>
                        {t.description && <div className={cardSubtitle}>{t.description}</div>}
                        {t.assigned_villager && (
                            <div
                                className={cardSubtitle}
                                style={{
                                    marginTop: "8px",
                                    color: "#10b981",
                                    fontWeight: 600,
                                    fontSize: "11px"
                                }}
                            >
                                🧙 Assigned
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        if (c.type === "zombie") {
            const z = c.data as Zombie;
            return (
                <div
                    className={card}
                    style={{ ...style, background: "#ff4444", color: "white" }}
                    onMouseDown={(e) => handleCardMouseDown(c.id, e)}
                >
                    <div className={cardHeader} style={{ color: "rgba(255,255,255,0.8)" }}>Zombie</div>
                    <div className={cardBody}>
                        <div className={cardIcon}>🧟</div>
                        <div className={cardTitle} style={{ color: "white" }}>Zombie</div>
                        <div className={cardSubtitle} style={{ color: "rgba(255,255,255,0.8)" }}>
                            {z.reason}
                        </div>
                    </div>
                </div>
            );
        }

        if (c.type === "loot") {
            const lootIcons: Record<string, string> = {
                coin: "🪙",
                paper: "📄",
                ink: "🖋",
                gear: "⚙️",
                parts: "🔧",
                blueprint_shard: "📐",
            };

            return (
                <div
                    className={card}
                    style={{ ...style, background: "linear-gradient(180deg, #fef3c7, #fde68a)" }}
                    onMouseDown={(e) => handleCardMouseDown(c.id, e)}
                >
                    <div className={cardHeader}>Loot</div>
                    <div className={cardBody}>
                        <div className={cardIcon}>{lootIcons[c.data.loot_type] || "💎"}</div>
                        <div className={cardTitle}>
                            {c.data.loot_type?.replace("_", " ")}
                        </div>
                        <div className={cardSubtitle}>×{c.data.loot_amount}</div>
                    </div>
                </div>
            );
        }

        if (c.type === "modifier") {
            const m = c.data as ModifierCard;
            const modIcons: Record<string, string> = {
                recurring_contract: "🔁",
                deadline_pin: "⏱",
                schedule_token: "📅",
                importance_seal: "⚠️",
            };

            return (
                <div
                    className={card}
                    style={{ ...style, background: "linear-gradient(180deg, #e0e7ff, #c7d2fe)" }}
                    onMouseDown={(e) => handleCardMouseDown(c.id, e)}
                >
                    <div className={cardHeader}>Modifier</div>
                    <div className={cardBody}>
                        <div className={cardIcon}>{modIcons[m.type] || "✨"}</div>
                        <div className={cardTitle}>
                            {m.type.replace("_", " ")}
                        </div>
                        {m.max_charges > 0 && (
                            <div className={cardSubtitle}>
                                {m.charges}/{m.max_charges} charges
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return null;
    }

    return (
        <div className={board} ref={boardRef} onMouseDown={handleBoardMouseDown}>
            <div className={topBar}>
                <Link to="/" className={backButton}>
                    ← Task Manager
                </Link>
                <div style={{ fontWeight: 900, fontSize: 16 }}>DONEGEON</div>

                {st.inventory && (
                    <div className={resourceDisplay}>
                        <div className={resourceItem} title="Coins - Currency for buying decks and buildings">
                            <span className={resourceIcon}>🪙</span>
                            {st.inventory.coin}
                        </div>
                        <div className={resourceItem} title="Paper - Crafting material for planning tools">
                            <span className={resourceIcon}>📄</span>
                            {st.inventory.paper}
                        </div>
                        <div className={resourceItem} title="Ink - Material for modifiers and schedules">
                            <span className={resourceIcon}>🖋</span>
                            {st.inventory.ink}
                        </div>
                        <div className={resourceItem} title="Gears - Maintenance and automation parts">
                            <span className={resourceIcon}>⚙️</span>
                            {st.inventory.gear}
                        </div>
                        <div className={resourceItem} title="Parts - Advanced building components">
                            <span className={resourceIcon}>🔧</span>
                            {st.inventory.parts}
                        </div>
                        <div className={resourceItem} title="Blueprint Shards - Rare materials for powerful buildings">
                            <span className={resourceIcon}>📐</span>
                            {st.inventory.blueprint_shard}
                        </div>
                    </div>
                )}

                <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                    <button
                        className={button}
                        onClick={async () => {
                            console.log("End Day clicked");
                            try {
                                const result = await api.dayTick();
                                console.log("Day tick result:", result);
                                await refresh();
                                console.log("Refresh after day tick complete");
                            } catch (e: any) {
                                console.error("End Day error:", e);
                                update((d) => {
                                    d.error = `✗ Error: ${e.message}`;
                                    setTimeout(() => update((d) => { d.error = null; }), 3000);
                                });
                            }
                        }}
                        title="End the current day - Process all tasks, progress zombies, and reset villager stamina"
                    >
                        End Day
                    </button>
                    <button
                        className={button}
                        onClick={refresh}
                        title="Refresh the board - Reload all cards and game state"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {/* Left HUD - Daily Objectives */}
            <div className={leftHud}>
                <div className={hudTitle}>📋 Today's Goals</div>

                <div className={hudSection}>
                    <div className={hudLabel}>Villager Stamina</div>
                    <div className={hudValue}>
                        {st.villagers.map(v => (
                            <div key={v.id} style={{ marginBottom: 4 }}>
                                {v.name}: {v.stamina}/{v.max_stamina} stamina
                            </div>
                        ))}
                    </div>
                </div>

                <div className={hudSection}>
                    <div className={hudLabel}>Active Tasks</div>
                    <div className={hudValue}>
                        {st.tasks.filter(t => t.zone === "live").length} live • {st.tasks.length} total
                    </div>
                </div>

                {st.zombies.length > 0 && (
                    <div className={hudSection}>
                        <div className={hudLabel}>⚠️ Zombies</div>
                        <div className={hudValue} style={{ color: "#ff4444" }}>
                            {st.zombies.length} active threat{st.zombies.length !== 1 ? "s" : ""}
                        </div>
                    </div>
                )}

                {st.quests && st.quests.length > 0 && (
                    <div className={hudSection}>
                        <div className={hudLabel}>🎯 Active Quests</div>
                        <div style={{ fontSize: 11, lineHeight: 1.5, color: "rgba(255,255,255,0.95)" }}>
                            {st.quests.filter((q: any) => q.status === 'active').slice(0, 3).map((q: any) => (
                                <div key={q.id} style={{ 
                                    marginBottom: 8, 
                                    padding: "6px 8px",
                                    background: "rgba(59, 130, 246, 0.15)",
                                    borderRadius: "4px",
                                    border: "1px solid rgba(59, 130, 246, 0.3)"
                                }}>
                                    <div style={{ fontWeight: 700, fontSize: 12, color: "#60a5fa" }}>{q.title}</div>
                                    <div style={{ opacity: 0.85, fontSize: 10, marginTop: 2 }}>{q.description}</div>
                                </div>
                            ))}
                            {st.quests.filter((q: any) => q.status === 'complete').length > 0 && (
                                <div style={{ marginTop: 6, fontSize: 10, opacity: 0.7, fontStyle: "italic" }}>
                                    ✓ {st.quests.filter((q: any) => q.status === 'complete').length} quest(s) completed
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className={hudSection}>
                    <div className={hudLabel}>Success Checklist</div>
                    <div style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(255,255,255,0.8)" }}>
                        ✓ Assign tasks to villagers<br />
                        ✓ Use stamina efficiently<br />
                        ✓ Complete high-value tasks<br />
                        ✓ Open decks for new cards<br />
                        ✓ Defeat zombies before end of day
                    </div>
                </div>
            </div>

            <div
                ref={canvasRef}
                className={boardCanvas}
                style={{
                    transform: `translate(${st.cameraX}px, ${st.cameraY}px)`,
                }}
            >
                {st.cards.map((c) => {
                    const CardElement = renderCard(c);
                    return CardElement ? React.cloneElement(CardElement, { key: c.id }) : null;
                })}
            </div>

            <div className={deckDisplay}>
                {st.decks.filter(d => d.status === "unlocked").map((deck) => (
                    <div
                        key={deck.id}
                        className={deckCard}
                        onClick={() => openDeck(deck.id)}
                        data-locked={deck.status === "locked"}
                        title={`${deck.description} - Click to open for ${deck.times_opened < 5 && deck.type === "first_day" ? "FREE" : deck.base_cost + " coins"}`}
                    >
                        <div style={{ fontSize: 24 }}>📦</div>
                        <div className={deckName}>{deck.name.replace(" Deck", "")}</div>
                        <div className={deckCost}>
                            {deck.times_opened < 5 && deck.type === "first_day"
                                ? "FREE"
                                : `${deck.base_cost} 🪙`}
                        </div>
                    </div>
                ))}
            </div>

            {st.error && (
                <div style={{
                    position: "fixed",
                    top: 80,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: st.error.startsWith("✓") ? "#10b981" : "#dc2626",
                    color: "white",
                    padding: "16px 32px",
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: "16px",
                    zIndex: 200,
                    boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
                    animation: "slideDown 0.3s ease-out",
                }}>
                    {st.error}
                </div>
            )}

            {/* Detail Panel */}
            {st.detailPanelCard && (() => {
                const detailCard = st.cards.find(c => c.id === st.detailPanelCard);
                if (!detailCard) return null;

                // Get all cards in this stack (children)
                const stackCards = getStack(detailCard.id, st.cards);
                const taskCard = stackCards.find(c => c.type === "task");
                const modifierCards = stackCards.filter(c => c.type === "modifier");

                // Check if task has a parent villager (task is child of villager)
                let villagerCard = stackCards.find(c => c.type === "villager");
                if (!villagerCard && taskCard?.parentId) {
                    villagerCard = st.cards.find(c => c.id === taskCard.parentId && c.type === "villager");
                }

                return (
                    <div className={detailPanel}>
                        <div className={detailPanelHeader}>
                            <div className={detailPanelTitle}>
                                {taskCard ? (taskCard.data as Task).name : "Stack Details"}
                            </div>
                            <div
                                className={detailPanelClose}
                                onClick={() => update(d => { d.detailPanelCard = null; })}
                            >
                                ×
                            </div>
                        </div>

                        {taskCard && (
                            <>
                                <div className={slotSection}>
                                    <div className={slotLabel}>Task</div>
                                    <div className={`${slot} ${slotFilled}`}>
                                        <div>
                                            <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
                                            <div style={{ fontWeight: 700 }}>{(taskCard.data as Task).name}</div>
                                            {(taskCard.data as Task).description && (
                                                <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
                                                    {(taskCard.data as Task).description}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className={slotSection}>
                                    <div className={slotLabel}>Assigned Villager</div>
                                    {villagerCard ? (
                                        <div className={`${slot} ${slotFilled}`}>
                                            <div>
                                                <div style={{ fontSize: 24, marginBottom: 8 }}>🧙</div>
                                                <div style={{ fontWeight: 700 }}>{(villagerCard.data as Villager).name}</div>
                                                <div style={{ fontSize: 11, marginTop: 4 }}>
                                                    ⚡ {(villagerCard.data as Villager).stamina}/{(villagerCard.data as Villager).max_stamina} stamina
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={slot}>Empty - Drag villager to assign</div>
                                    )}
                                </div>

                                <div className={slotSection}>
                                    <div className={slotLabel}>Modifiers ({modifierCards.length}/4)</div>
                                    {[0, 1, 2, 3].map(i => {
                                        const mod = modifierCards[i];
                                        return mod ? (
                                            <div key={i} className={`${slot} ${slotFilled}`}>
                                                <div>
                                                    <div style={{ fontSize: 20, marginBottom: 4 }}>
                                                        {mod.data.type === "deadline_pin" ? "⏱" :
                                                            mod.data.type === "recurring_contract" ? "🔁" :
                                                                mod.data.type === "schedule_token" ? "📅" : "⚠️"}
                                                    </div>
                                                    <div style={{ fontWeight: 600, fontSize: 11 }}>
                                                        {mod.data.type.replace(/_/g, " ")}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div key={i} className={slot}>Empty slot</div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                );
            })()}
        </div>
    );
}
