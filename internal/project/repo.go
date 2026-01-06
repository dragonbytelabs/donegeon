package project

import "context"

type Repository interface {
	Create(ctx context.Context, name, description string) (Project, error)
	Get(ctx context.Context, id int) (Project, bool, error)
	List(ctx context.Context) ([]Project, error)
	Update(ctx context.Context, p Project) (Project, error)
	Delete(ctx context.Context, id int) error
}
