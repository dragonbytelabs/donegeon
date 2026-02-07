package task

import (
	"time"

	"donegeon/internal/model"
)

const (
	habitTier1Threshold = 7
	habitTier2Threshold = 21
	habitTier3Threshold = 60
)

type HabitProgressResult struct {
	CountedCompletion bool
	NewTier           int
	TierUp            bool
	BecameHabit       bool
	BonusCoin         int
}

// BuildHabitCompletionUpdate computes task habit progression for a completion event.
// It is idempotent per task per local day to avoid toggling done/undone inflating counts.
func BuildHabitCompletionUpdate(cur model.Task, completedAt time.Time) (Patch, HabitProgressResult) {
	now := completedAt.In(time.Local)
	today := now.Format("2006-01-02")
	yesterday := now.AddDate(0, 0, -1).Format("2006-01-02")

	lastDate := ""
	if cur.LastCompletedDate != nil {
		lastDate = *cur.LastCompletedDate
	}

	nextCount := cur.CompletionCount
	nextStreak := cur.HabitStreak
	counted := false

	if lastDate != today {
		nextCount++
		counted = true
		if lastDate == yesterday && nextStreak > 0 {
			nextStreak++
		} else {
			nextStreak = 1
		}
	}

	nextTier := habitTierForCount(nextCount)
	becameHabit := !cur.Habit && nextTier > 0
	tierUp := nextTier > cur.HabitTier

	bonusCoin := 0
	if tierUp {
		switch nextTier {
		case 1:
			bonusCoin += 2
		case 2:
			bonusCoin += 4
		case 3:
			bonusCoin += 8
		}
	}
	if counted && nextStreak > 0 && nextStreak%7 == 0 {
		bonusCoin++
	}

	habit := nextTier > 0
	patch := Patch{
		Habit:       &habit,
		HabitTier:   &nextTier,
		HabitStreak: &nextStreak,
	}
	if counted {
		delta := nextCount - cur.CompletionCount
		patch.CompletionCountDelta = &delta
		patch.LastCompletedDate = &today
	}

	return patch, HabitProgressResult{
		CountedCompletion: counted,
		NewTier:           nextTier,
		TierUp:            tierUp,
		BecameHabit:       becameHabit,
		BonusCoin:         bonusCoin,
	}
}

func habitTierForCount(count int) int {
	switch {
	case count >= habitTier3Threshold:
		return 3
	case count >= habitTier2Threshold:
		return 2
	case count >= habitTier1Threshold:
		return 1
	default:
		return 0
	}
}
