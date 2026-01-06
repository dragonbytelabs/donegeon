package villager

import "time"

type Villager struct {
	ID              string     `json:"id"`
	Name            string     `json:"name"`
	MaxStamina      int        `json:"max_stamina"`
	Stamina         int        `json:"stamina"`
	Speed           int        `json:"speed"`           // Work speed multiplier
	Level           int        `json:"level"`           // Villager level
	TasksCompleted  int        `json:"tasks_completed"` // Total tasks completed
	TiredUntil      *time.Time `json:"tired_until"`     // When villager recovers from fatigue
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

// CompleteTask increments tasks completed and checks for level up
// Returns true if villager leveled up
func (v *Villager) CompleteTask() bool {
	v.TasksCompleted++

	// Level up every 5 tasks
	tasksForNextLevel := v.Level * 5
	if v.TasksCompleted >= tasksForNextLevel {
		v.Level++
		// Increase max stamina on level up
		v.MaxStamina++
		v.Stamina = v.MaxStamina // Restore stamina on level up
		return true
	}
	return false
}

// MakeTired sets the villager to tired until the specified time
func (v *Villager) MakeTired(until time.Time) {
	v.TiredUntil = &until
}
