package task

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewTask(t *testing.T) {
	nextId.Store(0)

	task := NewTask("pick up eggs", "from the store")

	assert.Equal(t, 1, task.ID)
	assert.Equal(t, "pick up eggs", task.Name)
	assert.Equal(t, "from the store", task.Description)
}

func TestNewTask_InitialState(t *testing.T) {
	nextId.Store(0)

	task := NewTask("slay dragon", "clear level 1")

	assert.NotZero(t, task.ID)
	assert.NotEmpty(t, task.Name)
	assert.NotEmpty(t, task.Description)
}

func TestNewTask_IncrementsID(t *testing.T) {
	nextId.Store(0)

	t1 := NewTask("a", "a")
	t2 := NewTask("b", "b")
	t3 := NewTask("c", "c")

	assert.Equal(t, 1, t1.ID)
	assert.Equal(t, 2, t2.ID)
	assert.Equal(t, 3, t3.ID)
}

func TestNewTask_UniqueIDs(t *testing.T) {
	nextId.Store(0)

	seen := map[int]bool{}
	for range 100 {
		task := NewTask("x", "y")
		assert.False(t, seen[task.ID])
		seen[task.ID] = true
	}
}
