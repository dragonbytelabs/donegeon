import type { ModifierId, TaskId } from './ids.js';

export type ModifierType =
  | 'recurring_contract'
  | 'deadline_pin'
  | 'schedule_token'
  | 'importance_seal'
  // v0.2-ish (already referenced in docs/FEATURE_MATRIX.md)
  | 'waiting_on'
  | 'next_action'
  | 'review_cadence'
  | 'checklist';

export type ModifierStatus = 'active' | 'spent';

export interface ModifierCard {
  id: ModifierId;
  type: ModifierType;
  status: ModifierStatus;

  // Charges: 0 can mean “infinite” depending on card type (UI convention).
  charges: number;
  maxCharges: number;

  // Attachment (backend authoritative).
  attachedToTaskId?: TaskId;

  // Modifier-specific optional config
  unblockedAtIso?: string; // waiting_on
  reviewEveryDays?: number; // review_cadence
  reviewNextAtIso?: string; // review_cadence
  checklistTotal?: number; // checklist
  checklistCompleted?: number; // checklist
}

