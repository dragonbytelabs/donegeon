#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GOCACHE_DIR="${GOCACHE:-/tmp/go-build}"

echo "==> UAT smoke: server integration"
(
  cd "${ROOT_DIR}"
  GOCACHE="${GOCACHE_DIR}" go test ./cmd/server -run 'TestServer_.*' -count=1
)

echo "==> UAT smoke: board regression suite"
(
  cd "${ROOT_DIR}"
  GOCACHE="${GOCACHE_DIR}" go test ./internal/board -run 'TestCommand_TaskSetTitlePromotesBlankCardAndSyncsTask|TestCommand_TaskSetTitle_ReMarksTaskLive|TestCommand_TaskSpawnExistingConsumesCoinAndMarksLive|TestCommand_TaskAssignVillagerSyncsTaskAssignment|TestCommand_TaskCompleteStack_RemovesTaskAndSingleUseButKeepsVillager|TestCommand_TaskCompleteByTaskID_RemovesBoardStackAndCompletesTask|TestCommand_StackMerge_TaskRemainsFaceCard|TestCommand_LootCollectStack_BlankTaskRecyclesIntoCoinOrParts|TestCommand_LootCollectStack_ModifierSalvagesToLoot|TestValidateStackMerge_AllowsSameModifierStacks|TestCommand_WorldEndDay_SpawnsOverdueZombiesAndResetsState|TestCommand_ZombieClear_RemovesZombieAndGrantsReward|TestCommand_ResourceGather_ConsumesChargeSpawnsProductsAndAwardsXP|TestCommand_FoodConsume_RestoresStaminaAndConsumesFood' -count=1
)

echo "==> UAT smoke: task + player + plugin + quest suites"
(
  cd "${ROOT_DIR}"
  GOCACHE="${GOCACHE_DIR}" go test ./internal/task ./internal/player ./internal/plugin ./internal/quest -count=1
)

echo "UAT smoke suite passed."
