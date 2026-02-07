package task

import (
	"testing"
	"time"

	"donegeon/internal/model"
)

func TestBuildHabitCompletionUpdate_ProgressesTierAndAwardsBonus(t *testing.T) {
	cur := model.Task{
		CompletionCount: 6,
		Habit:           false,
		HabitTier:       0,
		HabitStreak:     6,
	}
	now := time.Date(2026, 2, 7, 9, 0, 0, 0, time.Local)
	yesterday := now.AddDate(0, 0, -1).Format("2006-01-02")
	cur.LastCompletedDate = &yesterday

	patch, res := BuildHabitCompletionUpdate(cur, now)

	if !res.CountedCompletion {
		t.Fatalf("expected completion to be counted")
	}
	if !res.BecameHabit || !res.TierUp || res.NewTier != 1 {
		t.Fatalf("unexpected tier result: %+v", res)
	}
	if res.BonusCoin < 2 {
		t.Fatalf("expected habit tier bonus, got %d", res.BonusCoin)
	}
	if patch.CompletionCountDelta == nil || *patch.CompletionCountDelta != 1 {
		t.Fatalf("expected completion delta +1, got %+v", patch.CompletionCountDelta)
	}
	if patch.HabitTier == nil || *patch.HabitTier != 1 {
		t.Fatalf("expected habit tier 1 patch, got %+v", patch.HabitTier)
	}
}

func TestBuildHabitCompletionUpdate_SameDayIsIdempotent(t *testing.T) {
	today := time.Date(2026, 2, 7, 10, 0, 0, 0, time.Local)
	todayStr := today.Format("2006-01-02")
	cur := model.Task{
		CompletionCount:   9,
		Habit:             true,
		HabitTier:         1,
		HabitStreak:       4,
		LastCompletedDate: &todayStr,
	}

	patch, res := BuildHabitCompletionUpdate(cur, today)
	if res.CountedCompletion {
		t.Fatalf("expected same-day completion to be ignored")
	}
	if patch.CompletionCountDelta != nil {
		t.Fatalf("did not expect completion delta on same day, got %+v", patch.CompletionCountDelta)
	}
	if patch.HabitStreak == nil || *patch.HabitStreak != cur.HabitStreak {
		t.Fatalf("expected streak unchanged")
	}
	if res.BonusCoin != 0 {
		t.Fatalf("expected no bonus on same-day toggle, got %d", res.BonusCoin)
	}
}
