package zombie

import "context"

type Repository interface {
	List(ctx context.Context) ([]Zombie, error)
	Add(ctx context.Context, z Zombie) error
	Count(ctx context.Context) (int, error)
	ExistsForTask(ctx context.Context, taskID int, reason string) (bool, error)
	Remove(ctx context.Context, id string) (bool, error)
}
