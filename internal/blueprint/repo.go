package blueprint

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"donegeon/internal/model"
)

var (
	ErrNotFound = errors.New("blueprint not found")
)

type Repo interface {
	Create(b model.Blueprint) (model.Blueprint, error)
	Get(id model.BlueprintID) (model.Blueprint, error)
	List() ([]model.Blueprint, error)
}

func newID(prefix string) model.BlueprintID {
	var b [8]byte
	_, _ = rand.Read(b[:])
	return model.BlueprintID(prefix + "_" + hex.EncodeToString(b[:]))
}

func normalizeBlueprint(in *model.Blueprint) {
	if in.ModifierSlots == nil {
		in.ModifierSlots = []string{}
	}
	if in.Steps == nil {
		in.Steps = []string{}
	}
	in.Title = strings.TrimSpace(in.Title)
	in.Description = strings.TrimSpace(in.Description)

	slots := make([]string, 0, len(in.ModifierSlots))
	for _, s := range in.ModifierSlots {
		s = strings.TrimSpace(strings.ToLower(s))
		if s == "" {
			continue
		}
		if !strings.HasPrefix(s, "mod.") {
			s = "mod." + s
		}
		slots = append(slots, s)
	}
	in.ModifierSlots = slots

	steps := make([]string, 0, len(in.Steps))
	for _, s := range in.Steps {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		steps = append(steps, s)
	}
	in.Steps = steps
}

func newBlueprintFromUpsert(u model.BlueprintUpsert) model.Blueprint {
	now := time.Now()
	b := model.Blueprint{
		ID:            newID("bp"),
		Title:         u.Title,
		Description:   u.Description,
		ModifierSlots: append([]string{}, u.ModifierSlots...),
		Steps:         append([]string{}, u.Steps...),
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	normalizeBlueprint(&b)
	return b
}
