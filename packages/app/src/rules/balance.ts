export type BalanceConfig = {
  firstDayFreeOpenLimit: number;
  deckUnlockOrganizationTasks: number;
  deckUnlockMaintenanceTasks: number;
  deckUnlockPlanningTasks: number;
  deckUnlockIntegrationTasks: number;
  deckOpenDrawCount: number;
  // v0.7 economy
  sellCardCoinReward: number;
  sellLootPassthrough: boolean; // if true, selling loot cards gives their loot value, not coins
  workTimerDurationMs: number;
  gatherTimerDurationMs: number;
  workRewardCoin: number;
  gatherRewardCoin: number;
};

export const defaultBalance: BalanceConfig = {
  firstDayFreeOpenLimit: 5,
  deckUnlockOrganizationTasks: 10,
  deckUnlockMaintenanceTasks: 25,
  deckUnlockPlanningTasks: 50,
  deckUnlockIntegrationTasks: 100,
  // For v0.1 we draw 5 to support the intended "fan-out" animation.
  deckOpenDrawCount: 5,
  // v0.7 economy
  sellCardCoinReward: 1,
  sellLootPassthrough: true,
  workTimerDurationMs: 4500,
  gatherTimerDurationMs: 5500,
  workRewardCoin: 1,
  gatherRewardCoin: 1
};

