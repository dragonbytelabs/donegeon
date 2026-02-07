package board

import (
	"strings"

	"donegeon/internal/model"
)

type spawnModifierSpec struct {
	DefID model.CardDefID
	Data  map[string]any
}

func normalizeModifierDefID(raw string) model.CardDefID {
	id := strings.TrimSpace(raw)
	if id == "" {
		return ""
	}
	if !strings.HasPrefix(id, "mod.") {
		id = "mod." + id
	}
	return model.CardDefID(id)
}

func cloneAnyMap(src map[string]any) map[string]any {
	if src == nil {
		return nil
	}
	out := make(map[string]any, len(src))
	for k, v := range src {
		out[k] = v
	}
	return out
}

func buildSpawnModifierSpecs(t model.Task) []spawnModifierSpec {
	out := make([]spawnModifierSpec, 0, 6)
	seen := map[model.CardDefID]bool{}
	add := func(defID model.CardDefID, data map[string]any) {
		if defID == "" || seen[defID] {
			return
		}
		seen[defID] = true
		out = append(out, spawnModifierSpec{
			DefID: defID,
			Data:  cloneAnyMap(data),
		})
	}

	for _, m := range t.Modifiers {
		add(normalizeModifierDefID(m.DefID), m.Data)
	}

	if t.DueDate != nil && strings.TrimSpace(*t.DueDate) != "" {
		add("mod.deadline_pin", nil)
	}
	if t.NextAction {
		add("mod.next_action", nil)
	}
	if t.Recurrence != nil {
		if !seen["mod.recurring"] && !seen["mod.recurring_contract"] {
			add("mod.recurring", nil)
		}
	}

	return out
}

func (h *Handler) modifierSingleUseOnTaskComplete(defID model.CardDefID) bool {
	s := string(defID)
	if !strings.HasPrefix(s, "mod.") {
		return false
	}
	modID := strings.TrimPrefix(s, "mod.")

	if h.cfg != nil {
		for _, mt := range h.cfg.Modifiers.Types {
			if mt.ID != modID {
				continue
			}
			consumesOnComplete := false
			for _, evt := range mt.Charges.ConsumeOn {
				if strings.EqualFold(strings.TrimSpace(evt), "task_complete") {
					consumesOnComplete = true
					break
				}
			}
			if !consumesOnComplete {
				return false
			}
			if strings.EqualFold(mt.Charges.Mode, "finite") && mt.Charges.MaxCharges == 1 {
				return true
			}
			return false
		}
	}

	// Fallback for card defs not in cfg modifiers.types.
	return defID == "mod.next_action"
}
