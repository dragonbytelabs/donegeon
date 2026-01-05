package quest

import (
	"context"
)

type Repository interface {
	Seed(ctx context.Context, quests []Quest) error

	List(ctx context.Context) ([]Quest, error)
	Get(ctx context.Context, id string) (Quest, bool, error)

	ListActive(ctx context.Context) ([]Quest, error)
	ListByType(ctx context.Context, qtype QuestType) ([]Quest, error)

	Activate(ctx context.Context, id string) error
	Complete(ctx context.Context, id string) error
	UpdateProgress(ctx context.Context, id string, progress []Progress) error
}
