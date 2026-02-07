package board

import (
	"errors"
	"fmt"

	"donegeon/internal/config"
	"donegeon/internal/model"
)

var (
	ErrTooManyModifiers      = errors.New("too many modifiers on task")
	ErrDuplicateModifier     = errors.New("duplicate modifier type not allowed")
	ErrGlobalUniqueViolation = errors.New("modifier is globally unique and already exists")
	ErrInvalidStackPair      = errors.New("these card types cannot be stacked together")
)

// Validator validates board operations against config rules.
type Validator struct {
	cfg *config.Config
}

// NewValidator creates a new board validator.
func NewValidator(cfg *config.Config) *Validator {
	return &Validator{cfg: cfg}
}

// ValidateModifierAdd checks if a modifier can be added to a task stack.
// Returns an error if the operation would violate constraints.
func (v *Validator) ValidateModifierAdd(
	state *model.BoardState,
	taskStackID model.StackID,
	modifierDefID model.CardDefID,
) error {
	stack := state.GetStack(taskStackID)
	if stack == nil {
		return fmt.Errorf("stack not found: %s", taskStackID)
	}

	// Count current modifiers on this stack
	modifierCount := 0
	modifierTypes := make(map[model.CardDefID]bool)

	for _, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil {
			continue
		}
		// Check if this is a modifier card (defId starts with "mod.")
		if isModifierDef(card.DefID) {
			modifierCount++
			modifierTypes[card.DefID] = true
		}
	}

	// Check max modifiers
	maxMods := v.cfg.Modifiers.GlobalRules.MaxModifiersPerTask
	if maxMods > 0 && modifierCount >= maxMods {
		return ErrTooManyModifiers
	}

	// Check duplicate types
	if modifierTypes[modifierDefID] {
		// Check if duplicates are allowed
		if !v.cfg.Modifiers.GlobalRules.AllowDuplicateTypes {
			// Check allowlist
			allowed := false
			for _, allowedType := range v.cfg.Modifiers.GlobalRules.DuplicateTypeAllowlist {
				if string(modifierDefID) == allowedType {
					allowed = true
					break
				}
			}
			if !allowed {
				return ErrDuplicateModifier
			}
		}
	}

	// Check global uniqueness
	if v.isGloballyUnique(modifierDefID) {
		// Check if this modifier exists anywhere on the board
		for _, s := range state.Stacks {
			for _, cardID := range s.Cards {
				card := state.GetCard(cardID)
				if card != nil && card.DefID == modifierDefID {
					return ErrGlobalUniqueViolation
				}
			}
		}
	}

	return nil
}

// ValidateStackMerge checks if two stacks can be merged.
func (v *Validator) ValidateStackMerge(
	state *model.BoardState,
	targetID, sourceID model.StackID,
) error {
	target := state.GetStack(targetID)
	source := state.GetStack(sourceID)

	if target == nil || source == nil {
		return nil // Let the operation handle missing stacks
	}

	// Get the kinds of cards involved
	targetKinds := v.getStackCardKinds(state, target)
	sourceKinds := v.getStackCardKinds(state, source)
	hasTaskAcrossMerge := targetKinds["task"] || sourceKinds["task"]

	// Check disallowed pairs
	for _, pair := range v.cfg.Rules.Stacking.Disallowed {
		if len(pair) != 2 {
			continue
		}
		// Special case: modifiers should still be attachable to task stacks
		// even if a villager is already in that stack.
		if hasTaskAcrossMerge &&
			((pair[0] == "modifier" && pair[1] == "villager") || (pair[0] == "villager" && pair[1] == "modifier")) {
			continue
		}
		// Check if any target kind + source kind matches a disallowed pair
		for tk := range targetKinds {
			for sk := range sourceKinds {
				if (tk == pair[0] && sk == pair[1]) || (tk == pair[1] && sk == pair[0]) {
					return ErrInvalidStackPair
				}
			}
		}
	}

	// If allowed_pairs is specified, check that the merge is in the allowed list
	if len(v.cfg.Rules.Stacking.AllowedPairs) > 0 {
		allowed := false
		for _, pair := range v.cfg.Rules.Stacking.AllowedPairs {
			if len(pair) != 2 {
				continue
			}
			for tk := range targetKinds {
				for sk := range sourceKinds {
					if (tk == pair[0] && sk == pair[1]) || (tk == pair[1] && sk == pair[0]) {
						allowed = true
						break
					}
				}
				if allowed {
					break
				}
			}
			if allowed {
				break
			}
		}
		if !allowed {
			return ErrInvalidStackPair
		}
	}

	return nil
}

// getStackCardKinds returns all unique card kinds in a stack.
func (v *Validator) getStackCardKinds(state *model.BoardState, stack *model.Stack) map[string]bool {
	kinds := make(map[string]bool)
	for _, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card != nil {
			// Extract kind from defID (e.g., "task.blank" -> "task")
			kind := extractKind(card.DefID)
			kinds[kind] = true
		}
	}
	return kinds
}

// isGloballyUnique checks if a modifier is globally unique.
func (v *Validator) isGloballyUnique(defID model.CardDefID) bool {
	for _, uniqueMod := range v.cfg.Rules.Uniqueness.GlobalUniqueModifiers {
		if string(defID) == uniqueMod {
			return true
		}
	}
	return false
}

// isModifierDef checks if a card def ID is a modifier.
func isModifierDef(defID model.CardDefID) bool {
	return len(defID) > 4 && string(defID)[:4] == "mod."
}

// extractKind extracts the kind from a def ID (e.g., "task.blank" -> "task").
func extractKind(defID model.CardDefID) string {
	s := string(defID)
	prefix := s
	for i, c := range s {
		if c == '.' {
			prefix = s[:i]
			break
		}
	}
	switch prefix {
	case "mod":
		return "modifier"
	default:
		return prefix
	}
}
