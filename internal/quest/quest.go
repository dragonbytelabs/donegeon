package quest

import (
	"time"

	"donegeon/internal/task"
)

type Status string

const (
	StatusLocked   Status = "locked"
	StatusActive   Status = "active"
	StatusComplete Status = "complete"
)

type RequirementType string

const (
	ReqTaskCount RequirementType = "task_count" // e.g. have >= N tasks
	ReqTaskNamed RequirementType = "task_named" // e.g. have a task with exact name
)

type Requirement struct {
	Type  RequirementType
	Count int    // for ReqTaskCount
	Name  string // for ReqTaskNamed
}

type Reward struct {
	UnlockQuestIDs  []string
	UnlockRecipeIDs []string
}

type Quest struct {
	ID           string
	Title        string
	Description  string
	Requirements []Requirement
	Reward       Reward

	Status      Status
	UnlockedAt  *time.Time
	CompletedAt *time.Time
}

// Evaluate returns whether the quest requirements are satisfied given current tasks.
func (q Quest) Evaluate(tasks []task.Task) bool {
	for _, req := range q.Requirements {
		switch req.Type {
		case ReqTaskCount:
			if len(tasks) < req.Count {
				return false
			}
		case ReqTaskNamed:
			found := false
			for _, t := range tasks {
				if t.Name == req.Name {
					found = true
					break
				}
			}
			if !found {
				return false
			}
		default:
			// unknown requirement type => fail closed
			return false
		}
	}
	return true
}
