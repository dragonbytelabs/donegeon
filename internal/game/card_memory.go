package game

import (
	"context"
	"errors"
	"sync"
	"time"
)

type MemoryCardRepo struct {
	mu    sync.RWMutex
	cards map[string]*Card
}

func NewMemoryCardRepo() *MemoryCardRepo {
	return &MemoryCardRepo{
		cards: make(map[string]*Card),
	}
}

func (r *MemoryCardRepo) Get(ctx context.Context, id string) (*Card, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	card, exists := r.cards[id]
	if !exists {
		return nil, errors.New("card not found")
	}

	cardCopy := *card
	return &cardCopy, nil
}

func (r *MemoryCardRepo) List(ctx context.Context) ([]*Card, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	cards := make([]*Card, 0, len(r.cards))
	for _, card := range r.cards {
		cardCopy := *card
		cards = append(cards, &cardCopy)
	}

	return cards, nil
}

func (r *MemoryCardRepo) ListByZone(ctx context.Context, zone CardZone) ([]*Card, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	cards := make([]*Card, 0)
	for _, card := range r.cards {
		if card.Zone == zone {
			cardCopy := *card
			cards = append(cards, &cardCopy)
		}
	}

	return cards, nil
}

func (r *MemoryCardRepo) ListByType(ctx context.Context, cardType CardType) ([]*Card, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	cards := make([]*Card, 0)
	for _, card := range r.cards {
		if card.Type == cardType {
			cardCopy := *card
			cards = append(cards, &cardCopy)
		}
	}

	return cards, nil
}

func (r *MemoryCardRepo) Create(ctx context.Context, card *Card) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if card == nil {
		return errors.New("card cannot be nil")
	}

	if _, exists := r.cards[card.ID]; exists {
		return errors.New("card already exists")
	}

	now := time.Now()
	card.CreatedAt = now
	card.UpdatedAt = now

	r.cards[card.ID] = card
	return nil
}

func (r *MemoryCardRepo) Update(ctx context.Context, card *Card) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if card == nil {
		return errors.New("card cannot be nil")
	}

	if _, exists := r.cards[card.ID]; !exists {
		return errors.New("card not found")
	}

	card.UpdatedAt = time.Now()
	r.cards[card.ID] = card
	return nil
}

func (r *MemoryCardRepo) Delete(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.cards[id]; !exists {
		return errors.New("card not found")
	}

	delete(r.cards, id)
	return nil
}

func (r *MemoryCardRepo) DeleteMany(ctx context.Context, ids []string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, id := range ids {
		delete(r.cards, id)
	}

	return nil
}
