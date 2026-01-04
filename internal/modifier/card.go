package modifier

import "time"

type Type string

const (
	RecurringContract Type = "recurring_contract"
	DeadlinePin       Type = "deadline_pin"
	ScheduleToken     Type = "schedule_token"
	ImportanceSeal    Type = "importance_seal"
)

type Status string

const (
	StatusActive Status = "active"
	StatusSpent  Status = "spent"
)

type Card struct {
	ID        string    `json:"id"`
	Type      Type      `json:"type"`
	CreatedAt time.Time `json:"created_at"`

	// Charges: if MaxCharges == 0 => persistent (not consumed)
	MaxCharges int `json:"max_charges"`
	Charges    int `json:"charges"`

	Status Status `json:"status"`

	// Optional payload data depending on Type
	DeadlineAt         *time.Time `json:"deadline_at,omitempty"`          // DeadlinePin
	ScheduledAt        *time.Time `json:"scheduled_at,omitempty"`         // ScheduleToken (v0.1 mostly for UI)
	RecurringEveryDays int        `json:"recurring_every_days,omitempty"` // RecurringContract
	RecurringNextAt    *time.Time `json:"recurring_next_at,omitempty"`    // RecurringContract
}

func (c Card) Persistent() bool { return c.MaxCharges == 0 }

// Spent means: non-persistent AND charges are empty.
// Status is treated as a derived truth you keep in sync (see Normalize()).
func (c Card) Spent() bool {
	return !c.Persistent() && c.MaxCharges > 0 && c.Charges <= 0
}

// Normalize keeps Status consistent with Charges/Persistent.
// Call this any time you mutate Charges/MaxCharges.
func (c *Card) Normalize() {
	// persistent cards don’t get spent by charges
	if c.Persistent() {
		if c.Status == "" {
			c.Status = StatusActive
		}
		return
	}

	if c.Charges <= 0 {
		c.Charges = 0
		c.Status = StatusSpent
		return
	}

	// charges > 0
	if c.Status == "" || c.Status == StatusSpent {
		c.Status = StatusActive
	}
}

// Spend tries to spend n charges.
// Returns true if it actually spent charges. Returns false if persistent or empty.
func (c *Card) Spend(n int) bool {
	if c.Persistent() {
		return false
	}
	if n <= 0 {
		return false
	}
	if c.Charges <= 0 {
		c.Normalize()
		return false
	}
	c.Charges -= n
	c.Normalize()
	return true
}
