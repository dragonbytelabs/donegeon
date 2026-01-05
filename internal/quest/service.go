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

// UnlockNextStoryQuest unlocks the next story quest in sequence
func (s *Service) UnlockNextStoryQuest(ctx context.Context) error {
	// Get all quests
	allQuests, err := s.repo.List(ctx)
	if err != nil {
		return err
	}

	// Find completed story quests and locked story quests
	var completedStory []Quest
	var lockedStory []Quest

	for _, q := range allQuests {
		if q.Type == TypeStory {
			if q.Status == StatusComplete {
				completedStory = append(completedStory, q)
			} else if q.Status == StatusLocked {
				lockedStory = append(lockedStory, q)
			}
		}
	}

	// If no locked story quests, nothing to unlock
	if len(lockedStory) == 0 {
		return nil
	}

	// Find the next quest to unlock (by day number)
	var nextQuest *Quest
	for i := range lockedStory {
		if nextQuest == nil || lockedStory[i].Day < nextQuest.Day {
			nextQuest = &lockedStory[i]
		}
	}

	// Unlock it
	if nextQuest != nil {
		return s.repo.Activate(ctx, nextQuest.ID)
	}

	return nil
}

// ProcessDayEnd handles end-of-day quest progression
func (s *Service) ProcessDayEnd(ctx context.Context) error {
	// Auto-complete any quests with met objectives
	if err := s.RefreshProgress(ctx); err != nil {
		return err
	}

	// Unlock next story quest if current one is complete
	if err := s.UnlockNextStoryQuest(ctx); err != nil {
		return err
	}

	// Reset or activate new daily quests (deactivate old ones, activate new ones)
	// For now, just activate one daily quest if none are active
	active, err := s.repo.ListActive(ctx)
	if err != nil {
		return err
	}

	hasActiveDaily := false
	for _, q := range active {
		if q.Type == TypeDaily {
			hasActiveDaily = true
			break
		}
	}

	if !hasActiveDaily {
		_, err = s.ActivateDaily(ctx, 1)
		return err
	}

	return nil
}
