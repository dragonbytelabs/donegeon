package task

import "context"

type Repository interface {
	Create(ctx context.Context, name, description string) (Task, error)
	Get(ctx context.Context, id int) (Task, bool, error)
	List(ctx context.Context) ([]Task, error)
	Delete(ctx context.Context, id int) (bool, error)

	AddTag(ctx context.Context, id int, tag string) (Task, bool, error)
	Complete(ctx context.Context, id int) (Task, bool, error)

	Process(ctx context.Context, id int) (Task, bool, error) // moves Inbox -> Live
	ListByZone(ctx context.Context, zone Zone) ([]Task, error)

	Update(ctx context.Context, t Task) (Task, error)
	Reorder(ctx context.Context, sourceID int, targetID int) error

	// Quest progress tracking
	CountCreatedToday(ctx context.Context) (int, error)
	CountCompletedToday(ctx context.Context) (int, error)
}
