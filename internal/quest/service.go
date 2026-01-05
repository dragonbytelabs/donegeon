package quest

import (
	"context"
	"fmt"
	"time"
)

// Service handles quest business logic
type Service struct {
	repo Repository
	eval Evaluator
}

func NewService(repo Repository, eval Evaluator) *Service {
	return &Service{
		repo: repo,
		eval: eval,
	}
}

// RefreshProgress updates progress for all active quests
func (s *Service) RefreshProgress(ctx context.Context) error {
	active, err := s.repo.ListActive(ctx)
	if err != nil {
		return err
	}

	for _, q := range active {
		if err := q.UpdateProgress(ctx, s.eval); err != nil {
			return fmt.Errorf("update progress for %s: %w", q.ID, err)
		}

		if err := s.repo.UpdateProgress(ctx, q.ID, q.Progress); err != nil {
			return err
		}

		// Auto-complete if all objectives met
		if q.IsComplete() {
			if err := s.repo.Complete(ctx, q.ID); err != nil {
				return err
			}
		}
	}

	return nil
}

// ClaimRewards grants rewards for a completed quest
func (s *Service) ClaimRewards(ctx context.Context, questID string) ([]Reward, error) {
	q, ok, err := s.repo.Get(ctx, questID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("quest not found: %s", questID)
	}

	if q.Status != StatusComplete {
		return nil, fmt.Errorf("quest not complete: %s", questID)
	}

	// Return rewards to be processed by game engine
	return q.Rewards, nil
}

// ActivateDaily selects and activates daily quests
func (s *Service) ActivateDaily(ctx context.Context, count int) ([]Quest, error) {
	all, err := s.repo.ListByType(ctx, TypeDaily)
	if err != nil {
		return nil, err
	}

	// Filter locked/completed quests
	var available []Quest
	for _, q := range all {
		if q.Status == StatusLocked {
			available = append(available, q)
		}
	}

	// Pick first N (in production, this would be random/weighted)
	selected := available
	if len(selected) > count {
		selected = selected[:count]
	}

	// Activate them
	var activated []Quest
	for _, q := range selected {
		if err := s.repo.Activate(ctx, q.ID); err != nil {
			return nil, err
		}
		q.Status = StatusActive
		now := time.Now()
		q.ActivatedAt = &now
		activated = append(activated, q)
	}

	return activated, nil
}

// GetActiveQuests returns all currently active quests with updated progress
func (s *Service) GetActiveQuests(ctx context.Context) ([]Quest, error) {
	// Refresh progress first
	if err := s.RefreshProgress(ctx); err != nil {
		return nil, err
	}

	return s.repo.ListActive(ctx)
}
