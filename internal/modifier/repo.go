package modifier

import "context"

type Repository interface {
	Seed(ctx context.Context, cards []Card) error
	List(ctx context.Context) ([]Card, error)
	Get(ctx context.Context, id string) (Card, bool, error)
	Create(ctx context.Context, c Card) (Card, error)
	Update(ctx context.Context, c Card) (Card, error)
	Delete(ctx context.Context, id string) (bool, error)
}
