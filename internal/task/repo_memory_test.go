package task

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMemoryRepo_CreateGetList(t *testing.T) {
	nextId.Store(0)

	repo := NewMemoryRepo()
	ctx := context.Background()

	t1, err := repo.Create(ctx, "pick up eggs", "from store")
	assert.NoError(t, err)
	assert.Equal(t, 1, t1.ID)

	got, ok, err := repo.Get(ctx, t1.ID)
	assert.NoError(t, err)
	assert.True(t, ok)
	assert.Equal(t, t1, got)

	t2, err := repo.Create(ctx, "water plants", "front porch")
	assert.NoError(t, err)
	assert.Equal(t, 2, t2.ID)

	list, err := repo.List(ctx)
	assert.NoError(t, err)
	assert.Len(t, list, 2)
}
