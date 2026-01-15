export type BalanceConfig = {
  firstDayFreeOpenLimit: number;
  deckUnlockOrganizationTasks: number;
  deckUnlockMaintenanceTasks: number;
  deckUnlockPlanningTasks: number;
  deckUnlockIntegrationTasks: number;
  deckOpenDrawCount: number;
};

export const defaultBalance: BalanceConfig = {
  firstDayFreeOpenLimit: 5,
  deckUnlockOrganizationTasks: 10,
  deckUnlockMaintenanceTasks: 25,
  deckUnlockPlanningTasks: 50,
  deckUnlockIntegrationTasks: 100,
  // For v0.1 we draw 5 to support the intended “fan-out” animation.
  deckOpenDrawCount: 5
};

