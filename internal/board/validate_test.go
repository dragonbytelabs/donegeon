package board

import (
	"testing"

	"donegeon/internal/config"
	"donegeon/internal/model"
)

func testStackingConfig() *config.Config {
	return &config.Config{
		Rules: config.Rules{
			Stacking: config.StackingRules{
				AllowedPairs: [][]string{
					{"villager", "task"},
					{"task", "modifier"},
				},
				Disallowed: [][]string{
					{"modifier", "villager"},
				},
			},
		},
	}
}

func TestExtractKind_MapsModPrefixToModifier(t *testing.T) {
	if got := extractKind("mod.recurring"); got != "modifier" {
		t.Fatalf("expected mod.* to map to modifier, got %q", got)
	}
	if got := extractKind("task.blank"); got != "task" {
		t.Fatalf("expected task.* to map to task, got %q", got)
	}
}

func TestValidateStackMerge_AllowsTaskModifierPair(t *testing.T) {
	v := NewValidator(testStackingConfig())
	state := model.NewBoardState()

	taskCard := state.CreateCard("task.blank", nil)
	taskStack := state.CreateStack(model.Point{X: 100, Y: 100}, []model.CardID{taskCard.ID})

	modCard := state.CreateCard("mod.recurring", nil)
	modStack := state.CreateStack(model.Point{X: 140, Y: 100}, []model.CardID{modCard.ID})

	if err := v.ValidateStackMerge(state, taskStack.ID, modStack.ID); err != nil {
		t.Fatalf("expected task+modifier merge to be allowed, got error: %v", err)
	}
}

func TestValidateStackMerge_AllowsModifierOntoTaskVillagerStack(t *testing.T) {
	v := NewValidator(testStackingConfig())
	state := model.NewBoardState()

	taskCard := state.CreateCard("task.blank", nil)
	villagerCard := state.CreateCard("villager.basic", nil)
	taskVillagerStack := state.CreateStack(model.Point{X: 100, Y: 100}, []model.CardID{
		taskCard.ID,
		villagerCard.ID,
	})

	modCard := state.CreateCard("mod.recurring", nil)
	modStack := state.CreateStack(model.Point{X: 140, Y: 100}, []model.CardID{modCard.ID})

	if err := v.ValidateStackMerge(state, taskVillagerStack.ID, modStack.ID); err != nil {
		t.Fatalf("expected modifier merge to be allowed on task+villager stack, got error: %v", err)
	}
}

func TestValidateStackMerge_AllowsSameModifierStacks(t *testing.T) {
	v := NewValidator(testStackingConfig())
	state := model.NewBoardState()

	target := state.CreateCard("mod.next_action", nil)
	source := state.CreateCard("mod.next_action", nil)

	targetStack := state.CreateStack(model.Point{X: 100, Y: 100}, []model.CardID{target.ID})
	sourceStack := state.CreateStack(model.Point{X: 130, Y: 100}, []model.CardID{source.ID})

	if err := v.ValidateStackMerge(state, targetStack.ID, sourceStack.ID); err != nil {
		t.Fatalf("expected same modifier stacks to merge, got error: %v", err)
	}
}
