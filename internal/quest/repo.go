package quest

import (
	"context"

	"donegeon/internal/task"
)

type Repository interface {
	Seed(ctx context.Context, quests []Quest) error

	List(ctx context.Context) ([]Quest, error)
	Get(ctx context.Context, id string) (Quest, bool, error)

	// Progress recomputes statuses based on current tasks.
	// Typically: active quests can complete; rewards unlock locked quests.
	Progress(ctx context.Context, tasks []task.Task) ([]Quest, error)
}
