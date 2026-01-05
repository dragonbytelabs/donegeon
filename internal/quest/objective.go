package quest

import (
	"context"
	"fmt"
)

// ObjectiveOp defines the type of objective to complete
type ObjectiveOp string

const (
	OpCreateTask     ObjectiveOp = "create_task"
	OpCompleteTask   ObjectiveOp = "complete_task"
	OpProcessTask    ObjectiveOp = "process_task"
	OpAssignVillager ObjectiveOp = "assign_villager"
	OpClearZombie    ObjectiveOp = "clear_zombie"
	OpOpenDeck       ObjectiveOp = "open_deck"
	OpMoveToProject  ObjectiveOp = "move_task_to_project"
	OpAddModifier    ObjectiveOp = "add_modifier"
	OpCompleteCount  ObjectiveOp = "complete_task_count"
	OpInboxCount     ObjectiveOp = "process_inbox_count"
)

// TimeWindow defines the time scope for objectives
type TimeWindow string

const (
	TimeToday      TimeWindow = "today"
	TimeThisWeek   TimeWindow = "this_week"
	TimeThisSeason TimeWindow = "this_season"
	TimeRolling7d  TimeWindow = "rolling_7d"
	TimeAllTime    TimeWindow = "all_time"
)

// Objective represents a single goal within a quest
type Objective struct {
	Op         ObjectiveOp `json:"op"`
	Count      int         `json:"count"`
	TimeWindow TimeWindow  `json:"time_window"`

	// Optional filters
	ProjectID string `json:"project_id,omitempty"`
	TaskZone  string `json:"task_zone,omitempty"`
}

// Progress tracks how much of an objective is complete
type Progress struct {
	ObjectiveIndex int  `json:"objective_index"`
	Current        int  `json:"current"`
	Required       int  `json:"required"`
	Complete       bool `json:"complete"`
}

// Evaluator checks if objectives are met
type Evaluator interface {
	EvaluateObjective(ctx context.Context, obj Objective) (Progress, error)
}

// SimpleEvaluator is a basic implementation
type SimpleEvaluator struct {
	// Stats from game state
	TasksCreatedToday   int
	TasksCompletedToday int
	TasksProcessedToday int
	VillagersAssigned   int
	ZombiesCleared      int
	DecksOpened         int
	TasksMovedToProject int
	ModifiersAdded      int
}

// TaskCounter provides task count statistics for quest evaluation
type TaskCounter interface {
	CountCreatedToday(ctx context.Context) (int, error)
	CountCompletedToday(ctx context.Context) (int, error)
}

// RepoBasedEvaluator evaluates based on repository queries
type RepoBasedEvaluator struct {
	taskCounter TaskCounter
}

func NewRepoBasedEvaluator(tc TaskCounter) *RepoBasedEvaluator {
	return &RepoBasedEvaluator{taskCounter: tc}
}

func (e *RepoBasedEvaluator) EvaluateObjective(ctx context.Context, obj Objective) (Progress, error) {
	var current int
	var err error

	switch obj.Op {
	case OpCreateTask:
		if e.taskCounter != nil {
			current, err = e.taskCounter.CountCreatedToday(ctx)
			if err != nil {
				return Progress{}, err
			}
		}
	case OpCompleteTask:
		if e.taskCounter != nil {
			current, err = e.taskCounter.CountCompletedToday(ctx)
			if err != nil {
				return Progress{}, err
			}
		}
	// Other ops default to 0 for now
	case OpProcessTask, OpAssignVillager, OpClearZombie, OpOpenDeck, OpMoveToProject, OpAddModifier, OpCompleteCount, OpInboxCount:
		current = 0
	default:
		return Progress{}, fmt.Errorf("unknown objective op: %s", obj.Op)
	}

	return Progress{
		Current:  current,
		Required: obj.Count,
		Complete: current >= obj.Count,
	}, nil
}

func (e *SimpleEvaluator) EvaluateObjective(ctx context.Context, obj Objective) (Progress, error) {
	var current int

	switch obj.Op {
	case OpCreateTask:
		current = e.TasksCreatedToday
	case OpCompleteTask:
		current = e.TasksCompletedToday
	case OpProcessTask:
		current = e.TasksProcessedToday
	case OpAssignVillager:
		current = e.VillagersAssigned
	case OpClearZombie:
		current = e.ZombiesCleared
	case OpOpenDeck:
		current = e.DecksOpened
	case OpMoveToProject:
		current = e.TasksMovedToProject
	case OpAddModifier:
		current = e.ModifiersAdded
	case OpCompleteCount:
		current = e.TasksCompletedToday
	case OpInboxCount:
		current = e.TasksProcessedToday
	default:
		return Progress{}, fmt.Errorf("unknown objective op: %s", obj.Op)
	}

	return Progress{
		Current:  current,
		Required: obj.Count,
		Complete: current >= obj.Count,
	}, nil
}
