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
    TodaySummary,
} from "../lib/types";

// Stacklands-style board
const board = css`
  position: fixed;
  inset: 0;
  background-image: url("/background.png");
  background-size: cover;
  background-position: center;
  overflow: hidden;
  cursor: grab;
  user-select: none;

  &:active { cursor: grabbing; }
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

const debugPanel = css`
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 320px;
  max-height: 400px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 0, 0, 0.3);
  border-radius: 12px;
  padding: 16px;
  z-index: 100;
  color: white;
  font-size: 12px;
`;

const debugTitle = css`
  font-size: 14px;
  font-weight: 800;
  margin-bottom: 12px;
  color: #ff6b6b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const debugZombieItem = css`
  padding: 8px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 0, 0, 0.2);
  border-radius: 6px;
  font-size: 11px;
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
  transition: box-shadow 0.2s, transform 0.2s;
  display: flex;
  flex-direction: column;
  overflow: visible;
  pointer-events: auto;
  z-index: 1;
  animation: cardSpawn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);

  @keyframes cardSpawn {
    0% {
      transform: scale(0) rotate(-10deg);
      opacity: 0;
    }
    100% {
      transform: scale(1) rotate(0deg);
      opacity: 1;
    }
  }

  &:hover {
    box-shadow: 
      0 12px 32px rgba(0, 0, 0, 0.4),
      0 4px 8px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.8);
    z-index: 2;
    transform: translateY(-2px);
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
  opacity: 0.6;
  transition: all 0.2s;
  z-index: 1001;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  pointer-events: auto;

  &:hover {
    opacity: 1;
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
  width: 120px;
  height: 160px;
  border-radius: 12px;
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

const tooltip = css`
  position: absolute;
  background: rgba(0, 0, 0, 0.95);
  color: white;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
  max-width: 300px;
  z-index: 10000;
  pointer-events: none;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);

  &::before {
    content: "";
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 6px solid rgba(0, 0, 0, 0.95);
  }
`;

const helpButton = css`
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border: none;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: all 0.2s;
  z-index: 1000;

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const completedButton = css`
  position: fixed;
  bottom: 20px;
  right: 90px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  border: none;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: all 0.2s;
  z-index: 1000;

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const helpModal = css`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  padding: 32px;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  z-index: 10001;

  h2 {
    margin: 0 0 16px 0;
    font-size: 24px;
    color: #1a1a1a;
  }

  h3 {
    margin: 16px 0 8px 0;
    font-size: 16px;
    color: #374151;
  }

  p, li {
    font-size: 14px;
    line-height: 1.6;
    color: #4b5563;
    margin: 8px 0;
  }

  ul {
    margin: 8px 0;
    padding-left: 20px;
  }

  kbd {
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 2px 6px;
    font-family: monospace;
    font-size: 12px;
  }
`;

const helpOverlay = css`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
`;

type CardEntity = {
    id: string;
    type: "villager" | "task" | "zombie" | "loot" | "modifier" | "building" | "resource" | "food";
    x: number;
    y: number;
    data: any;
    parentId?: string; // Card this is stacked on
    // Resource gathering state
    gatherProgress?: number; // 0-1, progress of current gather
    gatherStartTime?: number; // timestamp when gathering started
    // Task work progress state
    workProgress?: number; // 0-1, progress of current work
    workStartTime?: number; // timestamp when work started
};

type Particle = {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    emoji: string;
    opacity: number;
    createdAt: number;
};

type State = {
    loading: boolean;
    error: string | null;

    // Camera
    cameraX: number;
    cameraY: number;

    // Entities
    cards: CardEntity[];
    particles: Particle[];

    // Resources
    inventory: Inventory | null;
    villagers: Villager[];
    tasks: Task[];
    zombies: Zombie[];
    quests: Quest[];
    decks: Deck[];
    buildings: Building[];
    todaySummary: TodaySummary | null;

    // Drag state
    dragging: string | null;
    dragOffsetX: number;
    dragOffsetY: number;
    hoverTarget: string | null; // Card being hovered over during drag

    // Detail panel
    detailPanelCard: string | null; // Card to show details for
    hoveredCard: string | null; // Card currently being hovered
    editingBlankTask: { name: string; description: string } | null; // Edit state for blank tasks
    
    // Help & Tooltips
    showHelp: boolean;
    showDebug: boolean;
    tooltip: { x: number; y: number; text: string } | null;
};

export default function BoardPage() {
    const [st, update] = useImmer<State>({
        loading: true,
        error: null,
        cameraX: 0,
        cameraY: 0,
        cards: [], // Start empty, will load positions in refresh()
        particles: [],
        inventory: null,
        villagers: [],
        tasks: [],
        zombies: [],
        quests: [],
        decks: [],
        buildings: [],
        todaySummary: null,
        dragging: null,
        dragOffsetX: 0,
        dragOffsetY: 0,
        hoverTarget: null,
        detailPanelCard: null,
        hoveredCard: null,
        editingBlankTask: null,
        showHelp: false,
        showDebug: false,
        tooltip: null,
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

    // Get recipe preview text for card combinations
    const getRecipePreview = (draggedCard: CardEntity, targetCard: CardEntity): string | null => {
        // Villager + Task = Assign villager to task
        if (draggedCard.type === "villager" && targetCard.type === "task") {
            const villager = draggedCard.data as Villager;
            const task = targetCard.data as Task;
            if (villager.stamina <= 0) {
                return "❌ No stamina - Villager needs food";
            }
            return `🧙 Assign ${villager.name} to work on task`;
        }

        // Modifier + Task = Attach modifier
        if (draggedCard.type === "modifier" && targetCard.type === "task") {
            const modifier = draggedCard.data as ModifierCard;
            const chargesText = modifier.charges === 0 ? "∞" : `${modifier.charges} charge${modifier.charges !== 1 ? 's' : ''}`;
            return `⚡ Attach modifier (${chargesText} remaining)`;
        }

        // Task + Task = Combine into project
        if (draggedCard.type === "task" && targetCard.type === "task") {
            return `📦 Combine tasks into project`;
        }

        // Villager + Resource = Gather food
        if (draggedCard.type === "villager" && targetCard.type === "resource") {
            const villager = draggedCard.data as Villager;
            const resource = targetCard.data as any;
            if (villager.stamina <= 0) {
                return "❌ No stamina - Villager needs food";
            }
            if (resource.charges <= 0) {
                return "❌ Resource depleted";
            }
            return `🌾 Gather food (+${resource.stamina_restore} stamina when ready)`;
        }

        // Food + Villager = Feed villager
        if (draggedCard.type === "food" && targetCard.type === "villager") {
            const food = draggedCard.data as any;
            const villager = targetCard.data as Villager;
            const restoredStamina = Math.min(food.stamina_restore, villager.max_stamina - villager.stamina);
            return `🍖 Feed ${villager.name} (+${restoredStamina} stamina)`;
        }

        // Loot + Collect deck handled separately
        return null;
    };

    // Restack cards dynamically - task at bottom, children stack upward above it
    const restackCards = (parentCard: CardEntity, cards: CardEntity[]) => {
        // Get direct children only
        const children = cards.filter(c => c.parentId === parentCard.id);
        if (children.length === 0) return;

        // Position each child ABOVE the parent to keep task visible at bottom
        // Cards stack upward from the parent (negative Y = up on screen)
        const CARD_OFFSET = 55; // Pixels to offset each card to show header
        
        children.forEach((child, index) => {
            child.x = parentCard.x;
            // Stack upward: each card goes ABOVE the previous one (negative Y)
            // Parent (task) stays at bottom, children stack up
            child.y = parentCard.y - (CARD_OFFSET * (index + 1));
        });
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
                gatherProgress: c.gatherProgress,
                gatherStartTime: c.gatherStartTime,
                workProgress: c.workProgress,
                workStartTime: c.workStartTime,
                // Save full data for modifier, loot, resource, and food cards since they're not reloaded from backend
                data: (c.type === 'modifier' || c.type === 'loot' || c.type === 'resource' || c.type === 'food') ? c.data : undefined
            }));
            
            // Save camera position too
            const state = {
                cards: positions,
                cameraX: st.cameraX,
                cameraY: st.cameraY,
            };
            
            localStorage.setItem("boardState", JSON.stringify(state));
            console.log("Saved board state to localStorage:", positions.length, "cards");
        } catch (err) {
            console.warn("Failed to save board state:", err);
        }
    };

    // Load saved positions from localStorage (returns Map of id -> {x, y, parentId, data?})
    const loadSavedPositions = (): Map<string, { x: number; y: number; parentId?: string; data?: any; gatherProgress?: number; gatherStartTime?: number; workProgress?: number; workStartTime?: number }> => {
        try {
            const saved = localStorage.getItem("boardState");
            if (saved) {
                const parsed = JSON.parse(saved);
                const posMap = new Map<string, { x: number; y: number; parentId?: string; data?: any; gatherProgress?: number; gatherStartTime?: number; workProgress?: number; workStartTime?: number }>();
                if (parsed.cards) {
                    for (const card of parsed.cards) {
                        posMap.set(card.id, { 
                            x: card.x, 
                            y: card.y, 
                            parentId: card.parentId, 
                            data: card.data,
                            gatherProgress: card.gatherProgress,
                            gatherStartTime: card.gatherStartTime,
                            workProgress: card.workProgress,
                            workStartTime: card.workStartTime,
                        });
                    }
                    console.log("Loaded", posMap.size, "saved card positions from localStorage");
                }
                
                // Restore camera position
                if (parsed.cameraX !== undefined && parsed.cameraY !== undefined) {
                    update((d) => {
                        d.cameraX = parsed.cameraX;
                        d.cameraY = parsed.cameraY;
                    });
                }
                
                return posMap;
            }
        } catch (err) {
            console.warn("Failed to load board state:", err);
        }
        return new Map();
    };

    // WARNING: refresh() wipes out blank tasks! Only use for major state changes like day tick.
    // For most card operations, update state locally instead.
    async function refresh() {
        update((d) => {
            d.loading = true;
            d.error = null;
        });

        try {
            const [inventory, villagers, tasks, zombies, decks, buildings, quests, todaySummary] = await Promise.all([
                api.loot(),
                api.villagers(),
                api.listTasks(),
                api.zombies(),
                api.listDecks(),
                api.listBuildings(),
                api.listQuests(),
                api.today(),
            ]);

            update((d) => {
                d.inventory = inventory;
                d.villagers = villagers;
                d.tasks = tasks;
                d.zombies = zombies;
                d.decks = decks;
                d.buildings = buildings;
                d.quests = quests;
                d.todaySummary = todaySummary;
                d.loading = false;

                // Filter to only live tasks that aren't completed
                const liveTasks = tasks.filter(t => t.zone === "live" && !t.completed);

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
                            workProgress: savedPos?.workProgress,
                            workStartTime: savedPos?.workStartTime,
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
                    
                    // Add building cards for built buildings
                    const builtBuildings = buildings.filter(b => b.status === "built");
                    builtBuildings.forEach((b, i) => {
                        const card = d.cards.find(c => c.id === `building-${b.type}`);
                        if (card) {
                            card.data = b;
                        } else {
                            // Add new buildings in a row
                            d.cards.push({
                                id: `building-${b.type}`,
                                type: "building",
                                x: 100 + i * 150,
                                y: 100,
                                data: b,
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

                    // Restore modifier, loot, resource, and food cards from localStorage if they're missing
                    const savedPositions = loadSavedPositions();
                    for (const [cardId, savedData] of savedPositions.entries()) {
                        // Check if this is a card from deck drops that's not in the current cards
                        if ((cardId.startsWith('drop-') || cardId.startsWith('food-')) && !d.cards.some(c => c.id === cardId) && savedData.data) {
                            console.log('Restoring saved card from localStorage:', cardId, savedData.data);

                            // Determine card type from saved data
                            let cardType: 'modifier' | 'loot' | 'task' | 'resource' | 'food' | null = null;
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
                            } else if (savedData.data.resource_type) {
                                cardType = 'resource';
                            } else if (savedData.data.food_type) {
                                cardType = 'food';
                            }

                            if (cardType) {
                                d.cards.push({
                                    id: cardId,
                                    type: cardType,
                                    x: savedData.x,
                                    y: savedData.y,
                                    data: cardData,
                                    parentId: savedData.parentId,
                                    gatherProgress: savedData.gatherProgress,
                                    gatherStartTime: savedData.gatherStartTime,
                                    workProgress: savedData.workProgress,
                                    workStartTime: savedData.workStartTime,
                                });
                            }
                        }
                    }

                    // Restack all cards that have parentIds to ensure proper positioning
                    const parentCards = d.cards.filter(c => !c.parentId);
                    parentCards.forEach(parentCard => {
                        if (d.cards.some(c => c.parentId === parentCard.id)) {
                            restackCards(parentCard, d.cards);
                        }
                    });
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

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger shortcuts when typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            switch (e.key.toLowerCase()) {
                case ' ': // Space - End day
                    e.preventDefault();
                    (async () => {
                        try {
                            await api.dayTick();
                            await refresh();
                        } catch (err) {
                            console.error('End day error:', err);
                        }
                    })();
                    break;

                case 'escape': // Escape - Close detail panel
                    update(d => { 
                        d.detailPanelCard = null;
                        if (d.showDebug) d.showDebug = false;
                    });
                    break;
                case 'd': // D - Toggle debug panel
                    if (e.shiftKey) {
                        e.preventDefault();
                        update(d => { d.showDebug = !d.showDebug; });
                    }
                    break;
                case '1': // 1 - Open First Day deck
                    void openDeck('deck_first_day');
                    break;
                case '2': // 2 - Open Organization deck
                    void openDeck('deck_organization');
                    break;
                case '3': // 3 - Open Maintenance deck
                    void openDeck('deck_maintenance');
                    break;
                case 'e': // E - Open first available deck
                    e.preventDefault();
                    const firstDayDeck = st.decks.find(d => d.type === 'first_day');
                    const orgDeck = st.decks.find(d => d.type === 'organization');
                    const maintDeck = st.decks.find(d => d.type === 'maintenance');
                    
                    if (firstDayDeck && firstDayDeck.times_opened < 5) {
                        void openDeck('deck_first_day');
                    } else if (orgDeck?.status === 'unlocked') {
                        void openDeck('deck_organization');
                    } else if (maintDeck?.status === 'unlocked') {
                        void openDeck('deck_maintenance');
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [refresh, openDeck, st.decks, update]);

    // Particle physics loop
    useEffect(() => {
        const interval = setInterval(() => {
            update((d) => {
                const now = Date.now();
                d.particles = d.particles.filter(p => {
                    const age = now - p.createdAt;
                    // Remove particles after 1 second
                    if (age > 1000) return false;
                    
                    // Update position
                    const dt = 0.016; // ~60fps
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    p.vy += 300 * dt; // Gravity
                    p.opacity = Math.max(0, 1 - (age / 1000));
                    
                    return true;
                });
            });
        }, 16); // ~60fps
        
        return () => clearInterval(interval);
    }, [update]);

    // Task work progress loop - update work progress when villagers are on tasks
    useEffect(() => {
        const interval = setInterval(() => {
            update((d) => {
                const now = Date.now();
                
                d.cards.forEach((taskCard) => {
                    if (taskCard.type !== "task") return;
                    if (!taskCard.workStartTime) return;
                    if (taskCard.data?.completed) return; // Don't update completed tasks
                    
                    const taskData = taskCard.data as { work_time: number; completed?: boolean };
                    const elapsed = now - taskCard.workStartTime;
                    const progress = Math.min(1, elapsed / (taskData.work_time * 1000));
                    
                    taskCard.workProgress = progress;
                    
                    // Work is complete when progress reaches 1
                    // The actual completion will be handled by the existing completeTask flow
                });
            });
        }, 100);
        
        return () => clearInterval(interval);
    }, [update]);

    // Gathering game loop - update progress and spawn food
    useEffect(() => {
        const interval = setInterval(() => {
            update((d) => {
                const now = Date.now();
                
                d.cards.forEach((resourceCard) => {
                    if (resourceCard.type !== "resource") return;
                    if (!resourceCard.gatherStartTime) return;
                    
                    const resData = resourceCard.data as { resource_type: string; charges: number; gather_time: number; produces: string; stamina_restore: number };
                    const elapsed = now - resourceCard.gatherStartTime;
                    const progress = Math.min(1, elapsed / (resData.gather_time * 1000));
                    
                    resourceCard.gatherProgress = progress;
                    
                    // If complete, spawn food
                    if (progress >= 1) {
                        // Find the villager on this resource
                        const villager = d.cards.find(c => c.parentId === resourceCard.id && c.type === "villager");
                        
                        if (!villager) {
                            // No villager found - clear the gathering state to prevent infinite loop
                            resourceCard.gatherStartTime = undefined;
                            resourceCard.gatherProgress = 0;
                            return;
                        }
                        
                        console.log(`Gathering complete! Spawning ${resData.produces}`);
                        
                        // Decrement resource charges
                        resData.charges = Math.max(0, resData.charges - 1);
                        
                        // Spawn food card
                        const foodId = `food-${Date.now()}`;
                        const foodX = resourceCard.x + 140;
                        const foodY = resourceCard.y;
                        d.cards.push({
                            id: foodId,
                            type: "food",
                            x: foodX,
                            y: foodY,
                            data: {
                                food_type: resData.produces,
                                stamina_restore: resData.stamina_restore,
                            },
                        });
                        
                        // Spawn particles at food location
                        const foodEmojis: Record<string, string> = {
                            berries: "🫐",
                            mushroom: "🍄",
                            bread: "🍞",
                            healing_herbs: "🌿",
                        };
                        for (let i = 0; i < 3; i++) {
                            const angle = (Math.random() * Math.PI * 2);
                            const speed = 50 + Math.random() * 50;
                            d.particles.push({
                                id: `particle-${Date.now()}-${i}`,
                                x: foodX + 60,
                                y: foodY + 80,
                                vx: Math.cos(angle) * speed,
                                vy: Math.sin(angle) * speed - 50,
                                emoji: foodEmojis[resData.produces] || "✨",
                                opacity: 1,
                                createdAt: Date.now(),
                            });
                        }
                        
                        // Check if resource has more charges
                        if (resData.charges > 0) {
                            // Resource still has charges - restart gathering immediately
                            resourceCard.gatherStartTime = Date.now();
                            resourceCard.gatherProgress = 0;
                            console.log(`${resData.resource_type} has ${resData.charges} charges left, continuing gathering`);
                        } else {
                            // Resource depleted - unparent villager and remove resource
                            villager.parentId = undefined;
                            resourceCard.gatherStartTime = undefined;
                            resourceCard.gatherProgress = 0;
                            
                            d.cards = d.cards.filter(c => c.id !== resourceCard.id);
                            d.error = `✓ ${resData.resource_type.replace(/_/g, " ")} depleted`;
                            setTimeout(() => update((d) => { d.error = null; }), 2000);
                        }
                    }
                });
            });
        }, 100);
        
        return () => clearInterval(interval);
    }, []);

    // Save board state periodically (every 2 seconds instead of every 100ms)
    useEffect(() => {
        const interval = setInterval(() => {
            saveBoardState(st.cards);
        }, 2000);
        
        return () => clearInterval(interval);
    }, [st.cards]);

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

                // Check if hovering over Collect deck (for loot cards and blank tasks)
                const isCollectable = draggedCard.type === "loot" || (draggedCard.type === "task" && draggedCard.data?.is_blank);
                if (isCollectable) {
                    const collectDeck = document.getElementById("collect-deck");
                    if (collectDeck) {
                        const deckRect = collectDeck.getBoundingClientRect();
                        const cardScreenX = draggedCard.x + d.cameraX;
                        const cardScreenY = draggedCard.y + d.cameraY + 60; // Account for top bar
                        
                        // Check if card center is over the deck
                        if (
                            cardScreenX >= deckRect.left - 40 &&
                            cardScreenX <= deckRect.right + 40 &&
                            cardScreenY >= deckRect.top - 40 &&
                            cardScreenY <= deckRect.bottom + 40
                        ) {
                            d.hoverTarget = "collect-deck";
                            currentHoverTarget = "collect-deck";
                            return; // Don't check other cards if hovering over collect
                        }
                    }
                }

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
                        
                        // Show recipe preview tooltip
                        const preview = getRecipePreview(draggedCard, otherCard);
                        if (preview) {
                            d.tooltip = {
                                x: me.clientX + 20,
                                y: me.clientY + 20,
                                text: preview
                            };
                        } else {
                            d.tooltip = null;
                        }
                        break;
                    }
                }
                
                // Clear tooltip if not hovering over anything
                if (d.hoverTarget === null) {
                    d.tooltip = null;
                }

                if (d.hoverTarget === null && currentHoverTarget !== null) {
                    console.log("No longer hovering");
                    currentHoverTarget = null;
                }
            });
        };

        const handleUp = async () => {
            console.log("Mouse up! Hover target was:", currentHoverTarget);

            // Get current state
            const draggedCard = st.cards.find(c => c.id === cardId);
            const targetCard = currentHoverTarget ? st.cards.find(c => c.id === currentHoverTarget) : null;

            console.log("Dragged card:", draggedCard?.type, "Target card:", targetCard?.type);

            // Handle loot collection
            if (draggedCard && currentHoverTarget === "collect-deck" && draggedCard.type === "loot") {
                const lootData = draggedCard.data as { loot_type: string; loot_amount: number };
                try {
                    // Update inventory via API
                    await api.collectLoot(lootData.loot_type, lootData.loot_amount);
                    
                    // Remove loot card from board and save
                    update((d) => {
                        d.cards = d.cards.filter(c => c.id !== draggedCard.id);
                        d.dragging = null;
                        d.hoverTarget = null;
                        // Update inventory locally to avoid refresh
                        if (d.inventory && lootData.loot_type in d.inventory) {
                            (d.inventory as any)[lootData.loot_type] = ((d.inventory as any)[lootData.loot_type] || 0) + lootData.loot_amount;
                        }
                        // Save immediately with the updated cards
                        saveBoardState(d.cards);
                    });
                    
                    console.log(`Collected ${lootData.loot_amount} ${lootData.loot_type}`);
                } catch (error) {
                    console.error("Failed to collect loot:", error);
                }
                
                window.removeEventListener("mousemove", handleMove);
                window.removeEventListener("mouseup", handleUp);
                return;
            }

            // Handle blank task recycling for coins
            if (draggedCard && currentHoverTarget === "collect-deck" && draggedCard.type === "task") {
                const taskData = draggedCard.data as any;
                if (taskData.is_blank) {
                    try {
                        // Give 1 coin for recycling a blank task
                        await api.collectLoot("coin", 1);
                        
                        // Remove blank task card from board and save
                        update((d) => {
                            d.cards = d.cards.filter(c => c.id !== draggedCard.id);
                            d.dragging = null;
                            d.hoverTarget = null;
                            // Update inventory locally instead of full refresh
                            if (d.inventory) {
                                d.inventory.coin = (d.inventory.coin || 0) + 1;
                            }
                            // Save immediately with the updated cards
                            saveBoardState(d.cards);
                        });
                        
                        console.log("Recycled blank task for 1 coin");
                    } catch (error) {
                        console.error("Failed to recycle blank task:", error);
                    }
                    
                    window.removeEventListener("mousemove", handleMove);
                    window.removeEventListener("mouseup", handleUp);
                    return;
                }
            }

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

            // Find the task card
            const taskCard = st.cards.find(c => c.id === `task-${taskId}`);
            if (!taskCard) {
                throw new Error('Task card not found');
            }

            const task = taskCard.data as Task;
            
            // Complete the task
            const result = await api.completeTask(taskId);
            console.log('Task completed successfully:', result);
            
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
            
            // Update the board: break up the entire stack and remove task
            update(d => {
                // First, find ALL cards in the stack (including parents of parents)
                const stackCardIds = new Set<string>();
                
                // Start with the task and work upwards to find the root
                let currentCard = taskCard;
                stackCardIds.add(currentCard.id);
                
                while (currentCard.parentId) {
                    const parent = d.cards.find(c => c.id === currentCard.parentId);
                    if (parent) {
                        stackCardIds.add(parent.id);
                        currentCard = parent;
                    } else {
                        break;
                    }
                }
                
                // Now find the root and get all descendants
                const rootCard = currentCard;
                const addDescendants = (parentId: string) => {
                    d.cards.filter(c => c.parentId === parentId).forEach(child => {
                        stackCardIds.add(child.id);
                        addDescendants(child.id);
                    });
                };
                addDescendants(rootCard.id);
                
                // Break up the entire stack - unparent ALL cards in the stack
                d.cards.forEach(c => {
                    if (stackCardIds.has(c.id)) {
                        c.parentId = undefined;
                    }
                });
                
                // Then filter out cards that should be removed
                d.cards = d.cards.filter(c => {
                    // Remove the task
                    if (c.id === `task-${taskId}`) return false;
                    
                    // Handle modifiers that were in the stack
                    if (c.type === 'modifier' && stackCardIds.has(c.id)) {
                        const modData = c.data as any;
                        
                        // Charge-based modifiers: decrement on use
                        if (modData.max_charges > 0) {
                            modData.charges = Math.max(0, (modData.charges || 0) - 1);
                            
                            // If spent (no charges left), remove it
                            if (modData.charges <= 0) {
                                return false;
                            }
                            
                            // Update the data
                            c.data = modData;
                        }
                    }
                    
                    // Keep everything else
                    return true;
                });
                
                d.error = rewardMsg;
                setTimeout(() => update((d) => { d.error = null; }), 4000);
                
                // Update villager stamina locally if there was a villager in the stack
                const villagerCard = d.cards.find(c => stackCardIds.has(c.id) && c.type === 'villager');
                if (villagerCard) {
                    const villagerData = villagerCard.data as Villager;
                    // Restore stamina based on task completion
                    villagerData.stamina = Math.min(villagerData.stamina + 1, villagerData.max_stamina);
                }
            });

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

                        // Stack cards: task is parent, villager becomes child
                        const taskCard = d.cards.find(c => c.id === `task-${task.id}`);
                        const villagerCard = d.cards.find(c => c.id === `villager-${villager.id}`);
                        if (taskCard && villagerCard) {
                            // Villager becomes child of task (not the other way around)
                            villagerCard.parentId = taskCard.id;
                            // Start work progress timer
                            taskCard.workStartTime = Date.now();
                            taskCard.workProgress = 0;
                            // Restack to position correctly
                            restackCards(taskCard, d.cards);
                        }
                    });
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
                // Look at all cards in the stack (task might have parentId pointing to villager)
                const rootCard = taskCard.parentId 
                    ? st.cards.find(c => c.id === taskCard.parentId)
                    : taskCard;
                const stackCards = rootCard 
                    ? st.cards.filter(c => c.parentId === rootCard.id || c.id === taskCard.id)
                    : [taskCard];
                    
                const existingModifiers = stackCards.filter(c => c.type === 'modifier');
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

                    // Attach modifier to task (task is always the parent/root)
                    const modCardIndex = d.cards.findIndex(c => c.id === modCard.id);
                    if (modCardIndex !== -1) {
                        d.cards[modCardIndex].parentId = taskCard.id;
                        // Restack all cards on this task stack
                        restackCards(taskCard, d.cards);
                    }
                });
            }

            // Task + Task = Check for recipe
            // Task + Task = Try recipe combination
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
                        
                        // Spawn celebration particles at target location
                        for (let i = 0; i < 8; i++) {
                            const angle = (i / 8) * Math.PI * 2;
                            const speed = 80 + Math.random() * 40;
                            d.particles.push({
                                id: `particle-${Date.now()}-${i}`,
                                x: targetCard.x + 60,
                                y: targetCard.y + 80,
                                vx: Math.cos(angle) * speed,
                                vy: Math.sin(angle) * speed - 70,
                                emoji: ["✨", "🎉", "⭐", "💫"][Math.floor(Math.random() * 4)],
                                opacity: 1,
                                createdAt: Date.now(),
                            });
                        }
                    });
                    // Recipe execution already updated backend, no need to refresh
                } catch (e: any) {
                    console.log("No recipe found:", e.message);
                    // No recipe found, ignore
                }
            }
            
            // Food + Modifier = Enhanced modifier (frontend-only recipe for now)
            else if ((draggedCard.type === "food" && targetCard.type === "modifier") ||
                (draggedCard.type === "modifier" && targetCard.type === "food")) {
                
                const foodCard = draggedCard.type === "food" ? draggedCard : targetCard;
                const modifierCard = draggedCard.type === "modifier" ? draggedCard : targetCard;
                const foodData = foodCard.data as { food_type: string; stamina_restore: number };
                const modifierData = modifierCard.data as any;
                
                // Enhance modifier by adding a charge (if it has charges)
                if (modifierData.max_charges && modifierData.max_charges > 0) {
                    update((d) => {
                        const mod = d.cards.find(c => c.id === modifierCard.id);
                        if (mod && mod.data.charges < mod.data.max_charges) {
                            mod.data.charges = Math.min(mod.data.max_charges, mod.data.charges + 1);
                            
                            // Remove food
                            d.cards = d.cards.filter(c => c.id !== foodCard.id);
                            
                            // Spawn particles
                            for (let i = 0; i < 5; i++) {
                                const angle = (Math.random() * Math.PI * 2);
                                const speed = 50 + Math.random() * 50;
                                d.particles.push({
                                    id: `particle-${Date.now()}-${i}`,
                                    x: modifierCard.x + 60,
                                    y: modifierCard.y + 80,
                                    vx: Math.cos(angle) * speed,
                                    vy: Math.sin(angle) * speed - 50,
                                    emoji: "⚡",
                                    opacity: 1,
                                    createdAt: Date.now(),
                                });
                            }
                            
                            d.error = `✓ Enhanced modifier with ${foodData.food_type}!`;
                            setTimeout(() => update((d) => { d.error = null; }), 2000);
                        } else {
                            d.error = `✗ Modifier is already at max charges`;
                            setTimeout(() => update((d) => { d.error = null; }), 2000);
                        }
                    });
                } else {
                    update((d) => {
                        d.error = `✗ This modifier cannot be enhanced`;
                        setTimeout(() => update((d) => { d.error = null; }), 2000);
                    });
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
                        // Remove zombie card from board after attack
                        const zombieCardId = draggedCard.type === 'zombie' ? draggedCard.id : targetCard.id;
                        d.cards = d.cards.filter(c => c.id !== zombieCardId);
                    });
                } else {
                    console.log("Villager has insufficient stamina");
                    update((d) => {
                        d.error = `✗ ${villager.name} needs 2 stamina to attack`;
                        setTimeout(() => update((d) => { d.error = null; }), 2000);
                    });
                }
            }

            // Food + Villager = Restore stamina (either direction)
            else if ((draggedCard.type === "food" && targetCard.type === "villager") ||
                (draggedCard.type === "villager" && targetCard.type === "food")) {

                const food = draggedCard.type === "food" ? draggedCard : targetCard;
                const foodData = food.data as { food_type: string; stamina_restore: number };
                const villager = draggedCard.type === "villager" ? draggedCard.data as Villager : targetCard.data as Villager;

                console.log(`${villager.name} eating ${foodData.food_type}`);

                update((d) => {
                    const villagerCard = d.cards.find(c => c.id === `villager-${villager.id}`);
                    if (villagerCard) {
                        const v = villagerCard.data as Villager;
                        const oldStamina = v.stamina;
                        v.stamina = Math.min(v.max_stamina, v.stamina + foodData.stamina_restore);
                        const gained = v.stamina - oldStamina;
                        
                        // Spawn particles at villager location
                        for (let i = 0; i < 5; i++) {
                            const angle = (Math.random() * Math.PI * 2);
                            const speed = 30 + Math.random() * 40;
                            d.particles.push({
                                id: `particle-${Date.now()}-${i}`,
                                x: villagerCard.x + 60,
                                y: villagerCard.y + 50,
                                vx: Math.cos(angle) * speed,
                                vy: Math.sin(angle) * speed - 60,
                                emoji: "✨",
                                opacity: 1,
                                createdAt: Date.now(),
                            });
                        }
                        
                        // Remove food card
                        d.cards = d.cards.filter(c => c.id !== food.id);
                        
                        d.error = `✓ ${villager.name} ate ${foodData.food_type} (+${gained} stamina)`;
                        setTimeout(() => update((d) => { d.error = null; }), 2000);
                    }
                });
            }

            // Villager + Resource = Start gathering (either direction)
            else if ((draggedCard.type === "villager" && targetCard.type === "resource") ||
                (draggedCard.type === "resource" && targetCard.type === "villager")) {

                const resource = draggedCard.type === "resource" ? draggedCard : targetCard;
                const resData = resource.data as { resource_type: string; charges: number; gather_time: number };
                const villager = draggedCard.type === "villager" ? draggedCard.data as Villager : targetCard.data as Villager;

                console.log(`${villager.name} gathering from ${resData.resource_type}`);

                // Check if resource has charges left
                if (resData.charges <= 0) {
                    update((d) => {
                        d.error = `✗ ${resData.resource_type.replace(/_/g, " ")} is depleted`;
                        setTimeout(() => update((d) => { d.error = null; }), 2000);
                    });
                    return;
                }

                // Check if villager has stamina
                if (villager.stamina <= 0) {
                    update((d) => {
                        d.error = `✗ ${villager.name} has no stamina to gather`;
                        setTimeout(() => update((d) => { d.error = null; }), 2000);
                    });
                    return;
                }

                // Stack villager on resource and start gathering timer
                update((d) => {
                    const villagerCard = d.cards.find(c => c.id === `villager-${villager.id}`);
                    const resourceCard = d.cards.find(c => c.id === resource.id);
                    
                    if (villagerCard && resourceCard) {
                        villagerCard.parentId = resourceCard.id;
                        
                        // Start gathering progress
                        resourceCard.gatherStartTime = Date.now();
                        resourceCard.gatherProgress = 0;
                        
                        // Restack cards on resource
                        restackCards(resourceCard, d.cards);
                        
                        d.error = `✓ ${villager.name} gathering from ${resData.resource_type.replace(/_/g, " ")}`;
                        setTimeout(() => update((d) => { d.error = null; }), 2000);
                    }
                });
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
        
        // Check if deck is locked
        const deck = st.decks.find(d => d.id === deckId);
        if (deck && deck.status === "locked") {
            update((d) => {
                d.error = `✗ ${deck.name} is locked. Process more tasks to unlock!`;
                setTimeout(() => update((d) => { d.error = null; }), 3000);
            });
            return;
        }
        
        try {
            const result = await api.openDeck(deckId);
            console.log("Deck opened, drops:", result.drops);
            console.log("Drop types:", result.drops.map(d => d.type));

            // Add new cards to board
            update((d) => {
                let x = 300;
                let y = 600;

                result.drops.forEach((drop, i) => {
                    console.log(`Processing drop ${i}:`, drop.type, drop);
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
                    } else if (drop.type === "resource" && drop.resource_card) {
                        d.cards.push({
                            id: cardId,
                            type: "resource",
                            x: x + i * 140,
                            y: y,
                            data: drop.resource_card,
                        });
                    } else if (drop.type === "blank_task") {
                        d.cards.push({
                            id: cardId,
                            type: "task",
                            x: x + i * 140,
                            y: y,
                            data: { 
                                id: Date.now() + i, // Unique temporary ID
                                name: "Blank Task", 
                                zone: "live", // Mark as live so it persists
                                completed: false,
                                is_blank: true // Flag to identify as editable blank task
                            },
                        });
                    }
                });
            });

            // Don't refresh here - it would remove blank task cards that aren't in the backend yet
            // Just update the decks list to reflect the new times_opened count
            const updatedDeck = st.decks.find(d => d.id === deckId);
            if (updatedDeck) {
                update(d => {
                    const deckToUpdate = d.decks.find(deck => deck.id === deckId);
                    if (deckToUpdate) {
                        deckToUpdate.times_opened++;
                    }
                });
            }
        } catch (e: any) {
            console.error("Failed to open deck:", e);
            update((d) => {
                d.error = `✗ ${String(e?.message ?? e)}`;
                setTimeout(() => update((d) => { d.error = null; }), 4000);
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

        // Calculate z-index dynamically based on Y position
        // Lower Y (higher on screen) = lower z-index (behind)
        // Higher Y (lower on screen) = higher z-index (in front)
        // This makes the bottom card fully visible, with cards above it progressively behind
        const baseZIndex = 10;
        const yOffset = Math.floor(c.y / 10); // Every 10px of Y adds 1 to z-index
        const zIndexOffset = baseZIndex + yOffset;

        const style: React.CSSProperties = {
            left: `${c.x}px`,
            top: `${c.y}px`,
            zIndex: isDragging ? 1000 : isHoverTarget ? 500 : zIndexOffset,
            boxShadow: isHoverTarget
                ? getRecipePreview(st.cards.find(card => card.id === st.dragging)!, c)
                    ? '0 0 0 4px rgba(34, 197, 94, 0.6), 0 12px 32px rgba(34, 197, 94, 0.3)' // Green for valid
                    : '0 0 0 4px rgba(239, 68, 68, 0.6), 0 12px 32px rgba(239, 68, 68, 0.3)' // Red for invalid
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
                        <>
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
                        </>
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
                    {isStackRoot && (
                        <>
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
                            <div
                                style={{
                                    position: 'absolute',
                                    left: `${grabHandleLeftOffset}px`,
                                    top: '15px',
                                    width: '28px',
                                    height: '28px',
                                    background: 'rgba(239, 68, 68, 0.95)',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    fontSize: '16px',
                                    fontWeight: 'bold',
                                    color: 'white',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                    transition: 'all 0.2s',
                                    zIndex: 1002,
                                }}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // Break up the stack - unparent and spread cards horizontally
                                    update(d => {
                                        const allCards: CardEntity[] = [];
                                        const collectDescendants = (parentId: string) => {
                                            const children = d.cards.filter(card => card.parentId === parentId);
                                            children.forEach(child => {
                                                allCards.push(child);
                                                collectDescendants(child.id);
                                            });
                                        };
                                        
                                        // Collect all descendants
                                        collectDescendants(c.id);
                                        
                                        // Unparent and spread them horizontally
                                        const CARD_SPACING = 180; // Horizontal spacing between cards
                                        allCards.forEach((card, index) => {
                                            card.parentId = undefined;
                                            // Position cards horizontally to the right of the root card
                                            card.x = c.x + (index + 1) * CARD_SPACING;
                                            card.y = c.y; // Same Y position as root
                                        });
                                    });
                                }}
                                onMouseEnter={(e) => {
                                    (e.target as HTMLElement).style.background = 'rgba(220, 38, 38, 1)';
                                    (e.target as HTMLElement).style.transform = 'scale(1.15)';
                                }}
                                onMouseLeave={(e) => {
                                    (e.target as HTMLElement).style.background = 'rgba(239, 68, 68, 0.95)';
                                    (e.target as HTMLElement).style.transform = 'scale(1)';
                                }}
                                title="Break up stack"
                            >
                                ✕
                            </div>
                        </>
                    )}
                    <div
                        className={detailButton}
                        onClick={(e) => {
                            e.stopPropagation();
                            update(d => { 
                                d.detailPanelCard = c.id;
                                // Initialize editing state for blank tasks
                                if ((c.data as any).is_blank) {
                                    d.editingBlankTask = { name: '', description: '' };
                                }
                            });
                        }}
                    >
                        ℹ️
                    </div>
                    {st.cards.some(card => card.parentId === c.id && card.type === "villager") && (
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
                        {(t as any).is_blank && (
                            <div
                                className={cardSubtitle}
                                style={{
                                    marginTop: "8px",
                                    color: "#f59e0b",
                                    fontWeight: 700,
                                    fontSize: "10px",
                                    background: "rgba(245, 158, 11, 0.1)",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    display: "inline-block"
                                }}
                            >
                                ✏️ Click ℹ️ to edit
                            </div>
                        )}
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
                        {c.workStartTime && !t.completed && (
                            <div
                                style={{
                                    position: "absolute",
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    height: "4px",
                                    background: "rgba(0,0,0,0.2)",
                                    overflow: "hidden",
                                }}
                            >
                                <div
                                    style={{
                                        height: "100%",
                                        background: "linear-gradient(to right, #10b981, #3b82f6)",
                                        width: `${(c.workProgress || 0) * 100}%`,
                                        transition: "width 0.1s linear",
                                    }}
                                />
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
        
        if (c.type === "building") {
            const b = c.data as Building;
            const buildingIcons: Record<string, string> = {
                rest_hall: "🛏️",
                farm: "🌾",
                workshop: "🔨",
                library: "📚",
            };
            
            return (
                <div
                    className={card}
                    style={{ ...style, background: "linear-gradient(180deg, #e0e7ff, #c7d2fe)", cursor: "default" }}
                >
                    <div className={cardHeader} style={{ background: "linear-gradient(180deg, rgba(79, 70, 229, 0.1), transparent)" }}>
                        Building
                    </div>
                    <div className={cardBody}>
                        <div className={cardIcon}>{buildingIcons[b.type] || "🏛️"}</div>
                        <div className={cardTitle}>{b.name}</div>
                        <div className={cardSubtitle}>
                            {b.description}
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

        if (c.type === "food") {
            const foodData = c.data as { food_type: string; stamina_restore: number };
            const foodIcons: Record<string, string> = {
                berries: "🫐",
                mushroom: "🍄",
                bread: "🍞",
                healing_herbs: "🌿",
            };

            return (
                <div
                    className={card}
                    style={{ ...style, background: "linear-gradient(180deg, #dcfce7, #bbf7d0)" }}
                    onMouseDown={(e) => handleCardMouseDown(c.id, e)}
                >
                    <div className={cardHeader}>Food</div>
                    <div className={cardBody}>
                        <div className={cardIcon}>{foodIcons[foodData.food_type] || "🍽"}</div>
                        <div className={cardTitle}>
                            {foodData.food_type.replace(/_/g, " ")}
                        </div>
                        <div className={cardSubtitle} style={{ color: "#10b981", fontWeight: 700 }}>
                            +{foodData.stamina_restore} ⚡
                        </div>
                    </div>
                </div>
            );
        }

        if (c.type === "resource") {
            const resData = c.data as { resource_type: string; charges: number; max_charges: number; gather_time: number; produces: string };
            const resourceIcons: Record<string, string> = {
                berry_bush: "🌿",
                mushroom_patch: "🍄",
                wheat_field: "🌾",
                herb_garden: "🪴",
            };
            
            const hasVillager = st.cards.some(card => card.parentId === c.id && card.type === "villager");
            const gatherProgress = c.gatherProgress || 0;

            return (
                <div
                    className={card}
                    style={{ ...style, background: "linear-gradient(180deg, #d1fae5, #a7f3d0)" }}
                    onMouseDown={(e) => handleCardMouseDown(c.id, e)}
                >
                    {/* Gather progress bar at top */}
                    {hasVillager && (
                        <div style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: "4px",
                            background: "rgba(0, 0, 0, 0.2)",
                            borderRadius: "12px 12px 0 0",
                            overflow: "hidden",
                        }}>
                            <div style={{
                                height: "100%",
                                width: `${gatherProgress * 100}%`,
                                background: "linear-gradient(90deg, #10b981, #059669)",
                                transition: "width 0.1s linear",
                            }} />
                        </div>
                    )}
                    <div className={cardHeader}>Resource</div>
                    <div className={cardBody}>
                        <div className={cardIcon}>{resourceIcons[resData.resource_type] || "🌾"}</div>
                        <div className={cardTitle}>
                            {resData.resource_type.replace(/_/g, " ")}
                        </div>
                        <div className={cardSubtitle}>
                            {hasVillager ? "Gathering..." : "Ready"}
                        </div>
                    </div>
                    {/* Stacklands-style charge indicator bottom-left */}
                    <div style={{
                        position: "absolute",
                        bottom: "6px",
                        left: "6px",
                        background: "rgba(0, 0, 0, 0.7)",
                        color: "white",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 700,
                    }}>
                        {resData.charges}
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
                            {m.type.replace(/_/g, " ")}
                        </div>
                        {m.max_charges > 0 && (
                            <div className={cardSubtitle}>
                                {m.charges}/{m.max_charges} uses
                            </div>
                        )}
                    </div>
                    {/* Stacklands-style charge indicator bottom-left */}
                    {m.max_charges > 0 && (
                        <div style={{
                            position: "absolute",
                            bottom: "6px",
                            left: "6px",
                            background: "rgba(0, 0, 0, 0.7)",
                            color: "white",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 700,
                        }}>
                            {m.charges}
                        </div>
                    )}
                </div>
            );
        }

        if (c.type === "zombie") {
            const z = c.data as Zombie;
            const reasonIcons: Record<string, string> = {
                deadline_missed: "⏰",
                important_ignored: "⚠️",
                recurring_no_charges: "🔁",
            };
            const reasonLabels: Record<string, string> = {
                deadline_missed: "Deadline Missed",
                important_ignored: "Important Ignored",
                recurring_no_charges: "Recurring Failed",
            };

            return (
                <div
                    className={card}
                    style={{
                        ...style,
                        background: "linear-gradient(180deg, #7f1d1d, #991b1b)",
                        borderColor: "#dc2626",
                        borderWidth: "3px",
                        color: "white",
                    }}
                    onMouseDown={(e) => handleCardMouseDown(c.id, e)}
                    onMouseEnter={() => update(d => { d.hoveredCard = c.id; })}
                    onMouseLeave={() => update(d => { d.hoveredCard = null; })}
                >
                    <div className={cardHeader} style={{ background: "linear-gradient(180deg, rgba(220, 38, 38, 0.3), transparent)", color: "white" }}>
                        Zombie
                    </div>
                    <div className={cardBody}>
                        <div className={cardIcon} style={{ fontSize: "40px" }}>🧟</div>
                        <div className={cardTitle} style={{ color: "white" }}>{reasonLabels[z.reason] || z.reason}</div>
                        <div className={cardSubtitle} style={{ color: "rgba(255, 255, 255, 0.7)", fontSize: "10px" }}>
                            {reasonIcons[z.reason] || "💀"} Task #{z.task_id}
                        </div>
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

                {st.todaySummary && (
                    <div className={hudSection}>
                        <div className={hudLabel}>Today Summary</div>
                        <div style={{ fontSize: 12, lineHeight: 1.7, color: "rgba(255,255,255,0.9)" }}>
                            <div style={{ 
                                marginBottom: 6, 
                                padding: "6px 8px",
                                background: st.todaySummary.danger_level === "safe" ? "rgba(34, 197, 94, 0.15)" :
                                           st.todaySummary.danger_level === "warning" ? "rgba(251, 191, 36, 0.15)" :
                                           st.todaySummary.danger_level === "danger" ? "rgba(239, 68, 68, 0.15)" :
                                           "rgba(127, 29, 29, 0.15)",
                                borderRadius: "4px",
                                border: st.todaySummary.danger_level === "safe" ? "1px solid rgba(34, 197, 94, 0.3)" :
                                        st.todaySummary.danger_level === "warning" ? "1px solid rgba(251, 191, 36, 0.3)" :
                                        st.todaySummary.danger_level === "danger" ? "1px solid rgba(239, 68, 68, 0.3)" :
                                        "1px solid rgba(127, 29, 29, 0.3)"
                            }}>
                                <strong>Danger:</strong> {st.todaySummary.danger_level.toUpperCase()}
                            </div>
                            <div><strong>Villagers:</strong> {st.todaySummary.villagers_free} free / {st.todaySummary.villagers_total} total</div>
                            <div><strong>Tasks:</strong> {st.todaySummary.tasks_live} live • {st.todaySummary.tasks_completed_today} completed today</div>
                            {st.todaySummary.zombies_active > 0 && (
                                <div style={{ color: "#ff4444" }}>
                                    <strong>⚠️ Zombies:</strong> {st.todaySummary.zombies_active} active
                                </div>
                            )}
                        </div>
                    </div>
                )}

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
                
                {/* Render particles */}
                {st.particles.map((p) => (
                    <div
                        key={p.id}
                        style={{
                            position: "absolute",
                            left: p.x,
                            top: p.y,
                            fontSize: 20,
                            opacity: p.opacity,
                            pointerEvents: "none",
                            userSelect: "none",
                        }}
                    >
                        {p.emoji}
                    </div>
                ))}
            </div>

            <div className={deckDisplay}>
                {/* Collect Deck - for collecting loot */}
                <div
                    id="collect-deck"
                    className={deckCard}
                    style={{
                        background: "linear-gradient(135deg, #10b981, #059669)",
                        cursor: "default"
                    }}
                    title="Drag loot cards here to collect them into your inventory"
                >
                    <div style={{ fontSize: 24 }}>💰</div>
                    <div className={deckName}>Collect</div>
                    <div className={deckCost} style={{ fontSize: 10 }}>Drop Loot</div>
                </div>
                
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
                                onClick={() => update(d => { 
                                    d.detailPanelCard = null;
                                    d.editingBlankTask = null;
                                })}
                            >
                                ×
                            </div>
                        </div>

                        {taskCard && (
                            <>
                                <div className={slotSection}>
                                    <div className={slotLabel}>Task</div>
                                    {(taskCard.data as any).is_blank ? (
                                        <div style={{ padding: '16px' }}>
                                            <div style={{ marginBottom: '12px' }}>
                                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>
                                                    Task Name
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="Enter task name..."
                                                    value={st.editingBlankTask?.name || ''}
                                                    onChange={(e) => update(d => {
                                                        if (!d.editingBlankTask) {
                                                            d.editingBlankTask = { name: e.target.value, description: '' };
                                                        } else {
                                                            d.editingBlankTask.name = e.target.value;
                                                        }
                                                    })}
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px 12px',
                                                        fontSize: '14px',
                                                        border: '2px solid #334155',
                                                        borderRadius: '6px',
                                                        background: '#1e293b',
                                                        color: 'white',
                                                        outline: 'none',
                                                    }}
                                                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                                    onBlur={(e) => e.target.style.borderColor = '#334155'}
                                                />
                                            </div>
                                            <div style={{ marginBottom: '12px' }}>
                                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>
                                                    Description (optional)
                                                </label>
                                                <textarea
                                                    placeholder="Enter description..."
                                                    value={st.editingBlankTask?.description || ''}
                                                    onChange={(e) => update(d => {
                                                        if (!d.editingBlankTask) {
                                                            d.editingBlankTask = { name: '', description: e.target.value };
                                                        } else {
                                                            d.editingBlankTask.description = e.target.value;
                                                        }
                                                    })}
                                                    rows={3}
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px 12px',
                                                        fontSize: '14px',
                                                        border: '2px solid #334155',
                                                        borderRadius: '6px',
                                                        background: '#1e293b',
                                                        color: 'white',
                                                        outline: 'none',
                                                        resize: 'vertical',
                                                        fontFamily: 'inherit',
                                                    }}
                                                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                                                    onBlur={(e) => e.target.style.borderColor = '#334155'}
                                                />
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    if (!st.editingBlankTask?.name?.trim()) {
                                                        update(d => { d.error = '✗ Task name is required'; });
                                                        setTimeout(() => update(d => { d.error = null; }), 3000);
                                                        return;
                                                    }
                                                    
                                                    try {
                                                        // Create the task via API
                                                        const newTask = await api.createTask(
                                                            st.editingBlankTask.name.trim(),
                                                            st.editingBlankTask.description.trim()
                                                        );
                                                        
                                                        // Move to live zone
                                                        await api.moveTaskToLive(newTask.id);
                                                        
                                                        // Update the card with the real task data
                                                        update(d => {
                                                            const cardIndex = d.cards.findIndex(c => c.id === taskCard.id);
                                                            if (cardIndex !== -1) {
                                                                const card = d.cards[cardIndex];
                                                                const oldCardId = card.id;
                                                                const newCardId = `task-${newTask.id}`;
                                                                
                                                                // Update card data and ID
                                                                card.id = newCardId;
                                                                card.data = { ...newTask, zone: 'live' };
                                                                delete (card.data as any).is_blank;
                                                                
                                                                // Update any child cards that reference this card
                                                                d.cards.forEach(c => {
                                                                    if (c.parentId === oldCardId) {
                                                                        c.parentId = newCardId;
                                                                    }
                                                                });
                                                                
                                                                console.log(`Updated blank task card from ${oldCardId} to ${newCardId}`);
                                                            }
                                                            d.editingBlankTask = null;
                                                            d.detailPanelCard = null;
                                                            d.error = '✓ Task created!';
                                                        });
                                                        
                                                        setTimeout(() => update(d => { d.error = null; }), 2000);
                                                    } catch (error: any) {
                                                        console.error('Failed to create task:', error);
                                                        update(d => { d.error = `✗ ${error.message || 'Failed to create task'}`; });
                                                        setTimeout(() => update(d => { d.error = null; }), 3000);
                                                    }
                                                }}
                                                style={{
                                                    width: '100%',
                                                    padding: '12px',
                                                    fontSize: '14px',
                                                    fontWeight: 700,
                                                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    transition: 'transform 0.1s',
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                            >
                                                💾 Save Task
                                            </button>
                                        </div>
                                    ) : (
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
                                    )}
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
            
            {/* Completed Button */}
            <Link to="/completed" style={{ textDecoration: 'none' }}>
                <button
                    className={completedButton}
                    title="View completed tasks"
                >
                    ✓
                </button>
            </Link>
            
            {/* Help Button */}
            <button
                className={helpButton}
                onClick={() => update(d => { d.showHelp = !d.showHelp; })}
                title="Show help and keyboard shortcuts"
            >
                ?
            </button>
            
            {/* Help Modal */}
            {st.showHelp && (
                <>
                    <div className={helpOverlay} onClick={() => update(d => { d.showHelp = false; })} />
                    <div className={helpModal}>
                        <h2>🎮 How to Play</h2>
                        
                        <h3>📋 Basics</h3>
                        <ul>
                            <li>Drag cards onto each other to combine them</li>
                            <li>Drag villagers onto tasks to assign work</li>
                            <li>Open decks to get new cards (costs coins after first 5)</li>
                            <li>Complete tasks to earn loot and progress quests</li>
                        </ul>
                        
                        <h3>🃏 Card Interactions</h3>
                        <ul>
                            <li><strong>Villager + Task:</strong> Assign villager to work on task</li>
                            <li><strong>Modifier + Task:</strong> Attach modifier to speed up or improve task</li>
                            <li><strong>Villager + Resource:</strong> Start gathering food</li>
                            <li><strong>Food + Villager:</strong> Restore villager stamina</li>
                            <li><strong>Task + Task:</strong> Combine two blank tasks into a project</li>
                            <li><strong>Loot + Collect Deck:</strong> Add loot to your inventory</li>
                        </ul>
                        
                        <h3>⚡ Resources & Stamina</h3>
                        <ul>
                            <li>Villagers need stamina to work on tasks</li>
                            <li>Gather food from resources (berry bush, wheat field, etc.)</li>
                            <li>Feed villagers to restore their stamina</li>
                            <li>Resources have limited charges and deplete over time</li>
                        </ul>
                        
                        <h3>⌨️ Keyboard Shortcuts</h3>
                        <ul>
                            <li><kbd>Space</kbd> - End the day</li>
                            <li><kbd>R</kbd> - Refresh board</li>
                            <li><kbd>E</kbd> - Open first available deck</li>
                            <li><kbd>1-4</kbd> - Open specific deck (First Day, Organization, Maintenance, Collect)</li>
                            <li><kbd>Esc</kbd> - Close detail panel</li>
                        </ul>
                        
                        <h3>💡 Tips</h3>
                        <ul>
                            <li>Modifiers show charges in bottom-left (0 = infinite)</li>
                            <li>Progress bars show work/gathering progress</li>
                            <li>Click ℹ️ button on cards to see stack details</li>
                            <li>Resources spawn food automatically when gathering completes</li>
                            <li>Higher stamina food takes longer to gather but restores more</li>
                        </ul>
                        
                        <button
                            className={button}
                            onClick={() => update(d => { d.showHelp = false; })}
                            style={{ marginTop: 16, width: "100%" }}
                        >
                            Got it!
                        </button>
                    </div>
                </>
            )}
            
            {/* Debug Panel (Shift+D) */}
            {st.showDebug && (
                <div className={debugPanel}>
                    <div className={debugTitle}>
                        <span>🐛 Zombie Debug</span>
                        <button
                            onClick={() => update(d => { d.showDebug = false; })}
                            style={{
                                background: "none",
                                border: "none",
                                color: "#ff6b6b",
                                cursor: "pointer",
                                fontSize: "16px",
                            }}
                        >
                            ✕
                        </button>
                    </div>
                    
                    <div style={{ marginBottom: 12 }}>
                        <strong>Total Zombies:</strong> {st.zombies.length}
                    </div>
                    
                    {st.zombies.length === 0 ? (
                        <div style={{ color: "rgba(255, 255, 255, 0.5)", fontStyle: "italic" }}>
                            No zombies active 🎉
                        </div>
                    ) : (
                        <>
                            {st.zombies.map((z) => (
                                <div key={z.id} className={debugZombieItem}>
                                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                                        🧟 {z.id}
                                    </div>
                                    <div style={{ color: "rgba(255, 255, 255, 0.7)" }}>
                                        <strong>Task:</strong> #{z.task_id}
                                    </div>
                                    <div style={{ color: "rgba(255, 255, 255, 0.7)" }}>
                                        <strong>Reason:</strong> {z.reason.replace(/_/g, " ")}
                                    </div>
                                    <div style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: "10px", marginTop: 4 }}>
                                        Spawned: {new Date(z.spawned_at).toLocaleString()}
                                    </div>
                                    <button
                                        className={button}
                                        style={{ 
                                            marginTop: 8, 
                                            padding: "4px 8px", 
                                            fontSize: "10px",
                                            background: "linear-gradient(180deg, #ef4444, #dc2626)"
                                        }}
                                        onClick={async () => {
                                            try {
                                                await api.clearZombie(z.id, 2);
                                                await refresh();
                                            } catch (e) {
                                                console.error("Failed to clear zombie:", e);
                                            }
                                        }}
                                    >
                                        Clear (costs 2 stamina)
                                    </button>
                                </div>
                            ))}
                            
                            <button
                                className={button}
                                style={{ 
                                    width: "100%", 
                                    marginTop: 12,
                                    background: "linear-gradient(180deg, #dc2626, #991b1b)"
                                }}
                                onClick={async () => {
                                    if (!confirm(`Clear all ${st.zombies.length} zombies?`)) return;
                                    try {
                                        for (const z of st.zombies) {
                                            await api.clearZombie(z.id, 2);
                                        }
                                        await refresh();
                                    } catch (e) {
                                        console.error("Failed to clear zombies:", e);
                                    }
                                }}
                            >
                                Clear All Zombies
                            </button>
                        </>
                    )}
                    
                    <div style={{ 
                        marginTop: 16, 
                        paddingTop: 12, 
                        borderTop: "1px solid rgba(255, 0, 0, 0.2)",
                        fontSize: "10px",
                        color: "rgba(255, 255, 255, 0.5)"
                    }}>
                        Press <kbd style={{ 
                            background: "rgba(255, 255, 255, 0.1)", 
                            padding: "2px 4px", 
                            borderRadius: "3px" 
                        }}>Shift+D</kbd> to toggle
                    </div>
                </div>
            )}
            
            {/* Tooltip */}
            {st.tooltip && (
                <div
                    className={tooltip}
                    style={{
                        left: st.tooltip.x,
                        top: st.tooltip.y - 60,
                    }}
                >
                    {st.tooltip.text}
                </div>
            )}
        </div>
    );
}
