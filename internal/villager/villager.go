package villager

type Villager struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	StaminaPerDay   int    `json:"stamina_per_day"`
	SlotsRemaining  int    `json:"slots_remaining"`
	BlockedByZombie bool   `json:"blocked_by_zombie"`
}

func (v *Villager) ResetDay() {
	v.SlotsRemaining = v.StaminaPerDay
	v.BlockedByZombie = false
}
