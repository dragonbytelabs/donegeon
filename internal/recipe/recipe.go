package recipe

import "time"

type Status string

const (
	StatusLocked   Status = "locked"
	StatusUnlocked Status = "unlocked"
)

type IngredientType string

const (
	IngTaskNamed     IngredientType = "task_named"
	IngTaskTagged    IngredientType = "task_tagged"
	IngTaskCompleted IngredientType = "task_completed"
	IngTaskCount     IngredientType = "task_count"
)

type IngredientMode string

const (
	ModeConsume IngredientMode = "consume"
	ModeRequire IngredientMode = "require"
)

type Ingredient struct {
	Type  IngredientType
	Name  string // for task_named
	Tag   string // for task_tagged
	Count int    // for all

	Mode IngredientMode
}

type OutputType string

const (
	OutCreateTask OutputType = "create_task"
)

type Output struct {
	Type        OutputType
	Name        string
	Description string
	Count       int
}

type Recipe struct {
	ID          string
	Title       string
	Description string

	Ingredients []Ingredient
	Outputs     []Output

	Status     Status
	UnlockedAt *time.Time
}
