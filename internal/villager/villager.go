package villager

import "time"

type Villager struct {
	ID              string     `json:"id"`
	Name            string     `json:"name"`
	MaxStamina      int        `json:"max_stamina"`
	Stamina         int        `json:"stamina"`
	Speed           int        `json:"speed"`       // Work speed multiplier
	Level           int        `json:"level"`       // Villager level
	TiredUntil      *time.Time `json:"tired_until"` // When villager recovers from fatigue
	BlockedByZombie bool       `json:"blocked_by_zombie"`
}

func (v *Villager) ResetDay() {
	// Reset to max stamina at start of new day
	v.Stamina = v.MaxStamina
	v.BlockedByZombie = false

	// Check if still tired
	if v.TiredUntil != nil && time.Now().After(*v.TiredUntil) {
		v.TiredUntil = nil
	}
}

func (v *Villager) IsAvailable() bool {
	return v.Stamina > 0 && !v.BlockedByZombie && (v.TiredUntil == nil || time.Now().After(*v.TiredUntil))
}
