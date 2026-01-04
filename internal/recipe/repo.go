package recipe

import "context"

type Repository interface {
	Seed(ctx context.Context, recipes []Recipe) error

	List(ctx context.Context) ([]Recipe, error)
	Get(ctx context.Context, id string) (Recipe, bool, error)

	Unlock(ctx context.Context, id string) (Recipe, bool, error)
	IsUnlocked(ctx context.Context, id string) (bool, error)
}
