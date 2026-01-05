package quest

import (
	"context"
	"time"
)

// QuestType categorizes quests
type QuestType string

const (
	TypeDaily    QuestType = "daily"
	TypeStory    QuestType = "story"
	TypeSeasonal QuestType = "seasonal"
	TypeBoss     QuestType = "boss"
	TypeFailure  QuestType = "failure"
)

// QuestStatus tracks the state of a quest
type QuestStatus string

const (
	StatusLocked     QuestStatus = "locked"
	StatusActive     QuestStatus = "active"
	StatusInProgress QuestStatus = "in_progress"
	StatusComplete   QuestStatus = "complete"
	StatusFailed     QuestStatus = "failed"
)

// QuestScope defines when a quest is relevant
type QuestScope string

const (
	ScopeDay     QuestScope = "day"
	ScopeWeek    QuestScope = "week"
	ScopeSeason  QuestScope = "season"
	ScopeYear    QuestScope = "year"
	ScopeDynamic QuestScope = "dynamic"
)

// Season represents the game's seasonal structure
type Season string

const (
	SeasonSpring Season = "spring"
	SeasonSummer Season = "summer"
	SeasonAutumn Season = "autumn"
	SeasonWinter Season = "winter"
)

// Quest represents a game objective with rewards
type Quest struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Type        QuestType  `json:"type"`
	Scope       QuestScope `json:"scope"`
	Season      Season     `json:"season,omitempty"`
	Difficulty  string     `json:"difficulty"` // "intro", "easy", "medium", "hard"

	// Objectives to complete
	Objectives []Objective `json:"objectives"`

	// What you get for completing
	Rewards []Reward `json:"rewards"`
	Unlocks []Unlock `json:"unlocks,omitempty"`

	// State tracking
	Status      QuestStatus `json:"status"`
	Progress    []Progress  `json:"progress,omitempty"`
	ActivatedAt *time.Time  `json:"activated_at,omitempty"`
	CompletedAt *time.Time  `json:"completed_at,omitempty"`

	// Week/Day tracking
	Week int `json:"week,omitempty"` // 1-52
	Day  int `json:"day,omitempty"`  // 1-365
}

// IsComplete checks if all objectives are met
func (q *Quest) IsComplete() bool {
	if len(q.Progress) != len(q.Objectives) {
		return false
	}

	for _, p := range q.Progress {
		if !p.Complete {
			return false
		}
	}

	return true
}

// UpdateProgress recalculates progress for all objectives
func (q *Quest) UpdateProgress(ctx context.Context, eval Evaluator) error {
	q.Progress = make([]Progress, len(q.Objectives))

	for i, obj := range q.Objectives {
		progress, err := eval.EvaluateObjective(ctx, obj)
		if err != nil {
			return err
		}

		progress.ObjectiveIndex = i
		q.Progress[i] = progress
	}

	// Check if quest just completed
	if q.IsComplete() && q.Status == StatusInProgress {
		now := time.Now()
		q.CompletedAt = &now
		q.Status = StatusComplete
	}

	return nil
}
