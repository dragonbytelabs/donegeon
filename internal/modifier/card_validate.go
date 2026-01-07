package modifier

import "fmt"

func (c Card) Validate() error {
	if c.ID == "" {
		return fmt.Errorf("modifier id is required")
	}
	if c.Type == "" {
		return fmt.Errorf("modifier type is required")
	}

	switch c.Type {
	case DeadlinePin:
		if c.DeadlineAt == nil {
			return fmt.Errorf("deadline_at is required for %s", DeadlinePin)
		}

	case RecurringContract:
		if c.RecurringEveryDays <= 0 {
			return fmt.Errorf("recurring_every_days must be > 0 for %s", RecurringContract)
		}
		if c.RecurringNextAt == nil {
			return fmt.Errorf("recurring_next_at is required for %s", RecurringContract)
		}

	case ImportanceSeal:
		// no required payload

	case ScheduleToken:
		// no required payload (ScheduledAt optional for now)

	case WaitingOn:
		if c.UnblockedAt == nil {
			return fmt.Errorf("unblocked_at is required for %s", WaitingOn)
		}

	case NextAction:
		// no required payload - just marks task as next action

	case ReviewCadence:
		if c.ReviewEveryDays <= 0 {
			return fmt.Errorf("review_every_days must be > 0 for %s", ReviewCadence)
		}
		if c.ReviewNextAt == nil {
			return fmt.Errorf("review_next_at is required for %s", ReviewCadence)
		}

	case Checklist:
		if c.ChecklistTotal <= 0 {
			return fmt.Errorf("checklist_total must be > 0 for %s", Checklist)
		}
		if c.ChecklistCompleted < 0 || c.ChecklistCompleted > c.ChecklistTotal {
			return fmt.Errorf("checklist_completed must be between 0 and total for %s", Checklist)
		}

	default:
		return fmt.Errorf("unknown modifier type: %s", c.Type)
	}

	// normalize sanity
	if c.MaxCharges < 0 || c.Charges < 0 {
		return fmt.Errorf("charges must be >= 0")
	}
	if c.MaxCharges == 0 && c.Charges != 0 {
		return fmt.Errorf("persistent modifiers must have charges=0")
	}
	if c.MaxCharges > 0 && c.Charges > c.MaxCharges {
		return fmt.Errorf("charges cannot exceed max_charges")
	}

	return nil
}
