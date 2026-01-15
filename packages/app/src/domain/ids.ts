// Nominal typing for IDs while staying runtime-zero-cost.
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type TaskId = Brand<string, 'TaskId'>;
export type VillagerId = Brand<string, 'VillagerId'>;
export type ZombieId = Brand<string, 'ZombieId'>;
export type ModifierId = Brand<string, 'ModifierId'>;
export type DeckId = Brand<string, 'DeckId'>;
export type QuestId = Brand<string, 'QuestId'>;

