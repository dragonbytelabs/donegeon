package villager

import "context"

type Repository interface {
	Seed(ctx context.Context, vs []Villager) error
	List(ctx context.Context) ([]Villager, error)
	Get(ctx context.Context, id string) (Villager, bool, error)
	Update(ctx context.Context, v Villager) (Villager, error)
	UpdateMany(ctx context.Context, vs []Villager) error
}
