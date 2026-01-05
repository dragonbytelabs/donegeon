package loot

import (
	"context"
	"sync"
)

// Inventory tracks accumulated loot
type Inventory struct {
	Coin           int `json:"coin"`
	Paper          int `json:"paper"`
	Ink            int `json:"ink"`
	Gear           int `json:"gear"`
	Parts          int `json:"parts"`
	BlueprintShard int `json:"blueprint_shard"`
}

// Add adds drops to the inventory
func (inv *Inventory) Add(drops []Drop) {
	for _, drop := range drops {
		switch drop.Type {
		case Coin:
			inv.Coin += drop.Amount
		case Paper:
			inv.Paper += drop.Amount
		case Ink:
			inv.Ink += drop.Amount
		case Gear:
			inv.Gear += drop.Amount
		case Parts:
			inv.Parts += drop.Amount
		case BlueprintShard:
			inv.BlueprintShard += drop.Amount
		}
	}
}

// Spend removes items from inventory
func (inv *Inventory) Spend(lootType Type, amount int) bool {
	if amount <= 0 {
		return true
	}

	switch lootType {
	case Coin:
		if inv.Coin >= amount {
			inv.Coin -= amount
			return true
		}
	case Paper:
		if inv.Paper >= amount {
			inv.Paper -= amount
			return true
		}
	case Ink:
		if inv.Ink >= amount {
			inv.Ink -= amount
			return true
		}
	case Gear:
		if inv.Gear >= amount {
			inv.Gear -= amount
			return true
		}
	case Parts:
		if inv.Parts >= amount {
			inv.Parts -= amount
			return true
		}
	case BlueprintShard:
		if inv.BlueprintShard >= amount {
			inv.BlueprintShard -= amount
			return true
		}
	}

	return false
}

// Has checks if inventory contains at least the specified amount
func (inv *Inventory) Has(lootType Type, amount int) bool {
	switch lootType {
	case Coin:
		return inv.Coin >= amount
	case Paper:
		return inv.Paper >= amount
	case Ink:
		return inv.Ink >= amount
	case Gear:
		return inv.Gear >= amount
	case Parts:
		return inv.Parts >= amount
	case BlueprintShard:
		return inv.BlueprintShard >= amount
	}
	return false
}

// Repository for inventory persistence
type Repository interface {
	Get(ctx context.Context) (Inventory, error)
	Update(ctx context.Context, inv Inventory) error
}

// MemoryRepo is an in-memory inventory repository
type MemoryRepo struct {
	mu  sync.RWMutex
	inv Inventory
}

func NewMemoryRepo() *MemoryRepo {
	return &MemoryRepo{
		inv: Inventory{},
	}
}

func (r *MemoryRepo) Get(ctx context.Context) (Inventory, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.inv, nil
}

func (r *MemoryRepo) Update(ctx context.Context, inv Inventory) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.inv = inv
	return nil
}
