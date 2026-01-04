package villager

import "context"

type Repository interface {
	Seed(ctx context.Context, vs []Villager) error
	List(ctx context.Context) ([]Villager, error)
	UpdateMany(ctx context.Context, vs []Villager) error
}
