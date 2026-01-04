package recipe

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRecipeMemoryRepo_Unlock(t *testing.T) {
	ctx := context.Background()
	r := NewMemoryRepo()

	assert.NoError(t, r.Seed(ctx, []Recipe{
		{ID: "r_make_omelet", Title: "Make Omelet", Description: "Turn eggs into omelet.", Status: StatusLocked},
	}))

	unlocked, err := r.IsUnlocked(ctx, "r_make_omelet")
	assert.NoError(t, err)
	assert.False(t, unlocked)

	rec, ok, err := r.Unlock(ctx, "r_make_omelet")
	assert.NoError(t, err)
	assert.True(t, ok)
	assert.Equal(t, StatusUnlocked, rec.Status)
	assert.NotNil(t, rec.UnlockedAt)

	unlocked, err = r.IsUnlocked(ctx, "r_make_omelet")
	assert.NoError(t, err)
	assert.True(t, unlocked)
}
