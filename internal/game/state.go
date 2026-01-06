package game

import (
	"context"
	"time"
)

// GameState represents the current state of the game world
type GameState struct {
	ID           string    `json:"id"`
	CurrentDay   time.Time `json:"current_day"`
	OverrunLevel int       `json:"overrun_level"`
	LastTickAt   time.Time `json:"last_tick_at"`
	DrawnTaskIDs []int     `json:"drawn_task_ids"` // Tasks already drawn from decks
	TotalCoins   int       `json:"total_coins"`    // Total coins earned
	CoinsSpent   int       `json:"coins_spent"`    // Coins spent on packs
}

// GameStateRepository handles persistence of game state
type GameStateRepository interface {
	Get(ctx context.Context) (*GameState, error)
	Update(ctx context.Context, state *GameState) error
	AddDrawnTaskID(ctx context.Context, taskID int) error
	HasDrawnTask(ctx context.Context, taskID int) (bool, error)
}
