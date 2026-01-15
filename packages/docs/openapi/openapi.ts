export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Donegeon API",
    version: "0.1.0"
  },
  servers: [{ url: "http://localhost:3000" }],
  // NOTE: source of truth is kept in docs so backend stays API-only.
  // Keep this in sync with implemented routes in @donegeon/backend.
  paths: {
    "/healthz": {
      get: {
        operationId: "healthz",
        summary: "Health check",
        responses: {
          "200": {
            description: "OK",
            content: { "text/plain": { schema: { type: "string", example: "ok" } } }
          }
        }
      }
    },
    "/api/version": {
      get: {
        operationId: "version",
        summary: "API version",
        responses: { "200": { description: "OK" } }
      }
    },

    "/api/tasks": {
      get: { operationId: "listTasks", summary: "List tasks", responses: { "200": { description: "OK" } } },
      post: { operationId: "createTask", summary: "Create task", responses: { "200": { description: "OK" }, "400": { description: "Bad Request" } } }
    },
    "/api/tasks/tag": {
      post: { operationId: "tagTask", summary: "Add tag to task", responses: { "200": { description: "OK" }, "404": { description: "Not Found" } } }
    },
    "/api/tasks/priority": {
      post: { operationId: "setTaskPriority", summary: "Set task priority", responses: { "200": { description: "OK" }, "400": { description: "Bad Request" } } }
    },
    "/api/tasks/complete": {
      post: { operationId: "completeTask", summary: "Complete task", responses: { "200": { description: "OK" } } }
    },
    "/api/tasks/move-to-live": {
      post: { operationId: "moveTaskToLive", summary: "Move inbox task to live", responses: { "200": { description: "OK" }, "404": { description: "Not Found" } } }
    },
    "/api/tasks/process": {
      post: { operationId: "processTask", summary: "Process a task (worked today)", responses: { "200": { description: "OK" } } }
    },
    "/api/tasks/set-project": {
      post: { operationId: "setTaskProject", summary: "Assign task to project", responses: { "200": { description: "OK" } } }
    },
    "/api/tasks/reorder": {
      post: { operationId: "reorderTasks", summary: "Reorder tasks", responses: { "200": { description: "OK" } } }
    },
    "/api/tasks/inbox": {
      get: { operationId: "listInboxTasks", summary: "List inbox tasks", responses: { "200": { description: "OK" } } }
    },
    "/api/tasks/live": {
      get: { operationId: "listLiveTasks", summary: "List live tasks", responses: { "200": { description: "OK" } } }
    },
    "/api/tasks/completed": {
      get: { operationId: "listCompletedTasks", summary: "List completed tasks", responses: { "200": { description: "OK" } } }
    },
    "/api/tasks/{id}/modifiers": {
      get: {
        operationId: "listTaskModifiers",
        summary: "List modifiers for a task",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK" }, "404": { description: "Not Found" } }
      }
    },
    "/api/tasks/assign": {
      post: { operationId: "assignTask", summary: "Assign task to villager", responses: { "200": { description: "OK" } } }
    },

    "/api/quests": { get: { operationId: "listQuests", summary: "List quests", responses: { "200": { description: "OK" } } } },
    "/api/quests/active": { get: { operationId: "listActiveQuests", summary: "List active quests", responses: { "200": { description: "OK" } } } },
    "/api/quests/daily": { get: { operationId: "listDailyQuests", summary: "List daily quests", responses: { "200": { description: "OK" } } } },
    "/api/quests/{id}/complete": {
      post: {
        operationId: "completeQuest",
        summary: "Complete and claim quest",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" }, "404": { description: "Not Found" } }
      }
    },
    "/api/quests/refresh": { post: { operationId: "refreshQuestProgress", summary: "Refresh quest progress", responses: { "200": { description: "OK" } } } },

    "/api/recipes": { get: { operationId: "listRecipes", summary: "List recipes", responses: { "200": { description: "OK" } } } },
    "/api/recipes/craft": { post: { operationId: "craftRecipe", summary: "Craft a recipe", responses: { "200": { description: "OK" }, "400": { description: "Bad Request" } } } },

    "/api/progress": { post: { operationId: "progress", summary: "Refresh quest progress (alias)", responses: { "200": { description: "OK" } } } },

    "/api/villagers": { get: { operationId: "listVillagers", summary: "List villagers", responses: { "200": { description: "OK" } } } },
    "/api/zombies": { get: { operationId: "listZombies", summary: "List zombies", responses: { "200": { description: "OK" } } } },
    "/api/zombies/clear": { post: { operationId: "clearZombie", summary: "Clear a zombie", responses: { "200": { description: "OK" }, "400": { description: "Bad Request" } } } },

    "/api/world": { get: { operationId: "getWorld", summary: "Get world state", responses: { "200": { description: "OK" } } } },
    "/api/day/tick": { post: { operationId: "dayTick", summary: "Advance day", responses: { "200": { description: "OK" } } } },

    "/api/modifiers": { get: { operationId: "listModifiers", summary: "List all modifiers", responses: { "200": { description: "OK" } } } },
    "/api/tasks/modifiers/add": { post: { operationId: "addModifier", summary: "Create+attach modifier to task", responses: { "200": { description: "OK" }, "400": { description: "Bad Request" } } } },
    "/api/tasks/modifiers/remove": { post: { operationId: "removeModifier", summary: "Detach modifier from task", responses: { "200": { description: "OK" }, "400": { description: "Bad Request" } } } },
    "/api/tasks/modifiers/attach": { post: { operationId: "attachModifier", summary: "Attach modifier card to task", responses: { "200": { description: "OK" }, "400": { description: "Bad Request" } } } },
    "/api/modifiers/waiting-on/set": { post: { operationId: "setWaitingOn", summary: "Set waiting_on unblocked date", responses: { "200": { description: "OK" }, "404": { description: "Not Found" } } } },
    "/api/modifiers/checklist/increment": { post: { operationId: "incrementChecklist", summary: "Increment checklist", responses: { "200": { description: "OK" }, "404": { description: "Not Found" } } } },
    "/api/modifiers/review/set": { post: { operationId: "setReviewCadence", summary: "Set review cadence", responses: { "200": { description: "OK" }, "404": { description: "Not Found" } } } },

    "/api/loot": { get: { operationId: "getLoot", summary: "Get loot inventory", responses: { "200": { description: "OK" } } } },
    "/api/loot/collect": { post: { operationId: "collectLoot", summary: "Collect loot", responses: { "200": { description: "OK" }, "400": { description: "Bad Request" } } } },

    "/api/decks": { get: { operationId: "listDecks", summary: "List decks", responses: { "200": { description: "OK" } } } },
    "/api/decks/{id}/preview": {
      get: {
        operationId: "previewDeck",
        summary: "Preview deck contents",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" }, "404": { description: "Not Found" } }
      }
    },
    "/api/decks/{id}/open": {
      post: {
        operationId: "openDeck",
        summary: "Open a deck",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" }, "500": { description: "Server Error" } }
      }
    },

    "/api/buildings": { get: { operationId: "listBuildings", summary: "List buildings", responses: { "200": { description: "OK" } } } },
    "/api/buildings/construct": { post: { operationId: "constructBuilding", summary: "Construct building", responses: { "200": { description: "OK" } } } },

    "/api/projects": {
      get: { operationId: "listProjects", summary: "List projects", responses: { "200": { description: "OK" } } },
      post: { operationId: "createProject", summary: "Create project", responses: { "200": { description: "OK" } } }
    },
    "/api/projects/{id}/archive": {
      post: {
        operationId: "archiveProject",
        summary: "Archive project",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK" }, "404": { description: "Not Found" } }
      }
    },

    "/api/game/state": { get: { operationId: "getGameState", summary: "Get game state", responses: { "200": { description: "OK" } } } },
    "/api/game/remaining-undrawn": { get: { operationId: "remainingUndrawn", summary: "Remaining undrawn tasks", responses: { "200": { description: "OK" } } } },
    "/api/today": { get: { operationId: "todaySummary", summary: "Today's summary", responses: { "200": { description: "OK" } } } },

    "/api/cards": { get: { operationId: "listCards", summary: "List cards", responses: { "200": { description: "OK" } } } },
    "/api/cards/zone/{zone}": {
      get: {
        operationId: "listCardsByZone",
        summary: "List cards by zone",
        parameters: [{ name: "zone", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" } }
      }
    },

    "/api/dev/stats": { get: { operationId: "devStats", summary: "Dev stats (telemetry)", responses: { "200": { description: "OK" } } } },
    "/api/dev/config": { get: { operationId: "devConfig", summary: "Dev config", responses: { "200": { description: "OK" } } } }
  }
} as const;

