package board

import (
	"strings"

	"donegeon/internal/model"
)

func isTaskCardDef(defID model.CardDefID) bool {
	return strings.HasPrefix(string(defID), "task.")
}

// ensureTaskFaceCard keeps a task card on top (face card) for task-containing stacks.
// Returns true if it reordered cards.
func ensureTaskFaceCard(state *model.BoardState, stack *model.Stack) bool {
	if stack == nil || len(stack.Cards) <= 1 {
		return false
	}

	taskIdx := -1
	for i := len(stack.Cards) - 1; i >= 0; i-- {
		c := state.GetCard(stack.Cards[i])
		if c == nil {
			continue
		}
		if isTaskCardDef(c.DefID) {
			taskIdx = i
			break
		}
	}
	if taskIdx < 0 || taskIdx == len(stack.Cards)-1 {
		return false
	}

	taskCardID := stack.Cards[taskIdx]
	stack.Cards = append(stack.Cards[:taskIdx], stack.Cards[taskIdx+1:]...)
	stack.Cards = append(stack.Cards, taskCardID)
	return true
}
