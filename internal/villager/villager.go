package villager

type Villager struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	MaxStamina      int    `json:"max_stamina"`
	Stamina         int    `json:"stamina"`
	BlockedByZombie bool   `json:"blocked_by_zombie"`
}

func (v *Villager) ResetDay() {
	// Lose 1 stamina per day (burnout), min 0
	if v.Stamina > 0 {
		v.Stamina--
	}
	v.BlockedByZombie = false
}
