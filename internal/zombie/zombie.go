package zombie

import "time"

type Zombie struct {
	ID        string    `json:"id"`
	TaskID    int       `json:"task_id"`
	Reason    string    `json:"reason"`
	SpawnedAt time.Time `json:"spawned_at"`
}
