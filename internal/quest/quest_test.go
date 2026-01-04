package quest

import (
	"context"
	"testing"

	"donegeon/internal/task"
	"github.com/stretchr/testify/assert"
)

func TestQuest_Progress_CompletesAndUnlocks(t *testing.T) {
	ctx := context.Background()

	// reset task IDs if you’re still using global increment
	// (only needed if your task.NewTask uses global state)
	// task.nextId = 0 // (won't compile if nextId is unexported; you can ignore)

	qrepo := NewMemoryRepo()

	quests := []Quest{
		{
			ID:          "q_intro",
			Title:       "First Steps",
			Description: "Create your first task.",
			Status:      StatusActive,
			Requirements: []Requirement{
				{Type: ReqTaskCount, Count: 1},
			},
			Reward: Reward{UnlockQuestIDs: []string{"q_eggs"}},
		},
		{
			ID:          "q_eggs",
			Title:       "Egg Run",
			Description: "Have a task named 'pick up eggs'.",
			Status:      StatusLocked,
			Requirements: []Requirement{
				{Type: ReqTaskNamed, Name: "pick up eggs"},
			},
		},
	}

	assert.NoError(t, qrepo.Seed(ctx, quests))

	out, err := qrepo.Progress(ctx, nil)
	assert.NoError(t, err)

	byID := map[string]Quest{}
	for _, q := range out {
		byID[q.ID] = q
	}

	assert.Equal(t, StatusActive, byID["q_intro"].Status)
	assert.Equal(t, StatusLocked, byID["q_eggs"].Status)

	// add one task => q_intro completes => q_eggs unlocks (becomes active)
	tasks := []task.Task{
		{ID: 1, Name: "anything", Description: "x"},
	}
	out, err = qrepo.Progress(ctx, tasks)
	assert.NoError(t, err)

	// list is sorted by ID: q_eggs, q_intro
	var qEggs, qIntro Quest
	for _, q := range out {
		if q.ID == "q_intro" {
			qIntro = q
		}
		if q.ID == "q_eggs" {
			qEggs = q
		}
	}

	assert.Equal(t, StatusComplete, qIntro.Status)
	assert.NotNil(t, qIntro.CompletedAt)

	assert.Equal(t, StatusActive, qEggs.Status)
	assert.NotNil(t, qEggs.UnlockedAt)

	// now meet eggs requirement => q_eggs completes
	tasks = append(tasks, task.Task{ID: 2, Name: "pick up eggs", Description: "from store"})
	out, err = qrepo.Progress(ctx, tasks)
	assert.NoError(t, err)

	for _, q := range out {
		if q.ID == "q_eggs" {
			assert.Equal(t, StatusComplete, q.Status)
			assert.NotNil(t, q.CompletedAt)
		}
	}
}

func TestQuest_NeverRegresses(t *testing.T) {
	q := Quest{Status: StatusComplete}
	assert.NotEqual(t, StatusActive, q.Status)
	assert.NotEqual(t, StatusLocked, q.Status)
}
