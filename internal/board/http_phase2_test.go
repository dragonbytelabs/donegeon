package board

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"donegeon/internal/config"
	"donegeon/internal/model"
	"donegeon/internal/task"
)

func testBoardConfig() *config.Config {
	return &config.Config{
		SeededRNG: config.SeededRNG{
			Enabled:                true,
			DeterministicDeckDraws: true,
		},
		Modifiers: config.Modifiers{
			GlobalRules: config.GlobalModifierRules{
				MaxModifiersPerTask: 4,
			},
		},
		Rules: config.Rules{
			Stacking: config.StackingRules{},
			Uniqueness: config.UniquenessRules{
				GlobalUniqueModifiers: []string{},
			},
		},
		Decks: config.Decks{
			List: []config.Deck{
				{
					ID: "deck.first_day",
					Draws: config.DeckDraws{
						Count: 9,
						RNGPool: []config.DeckRNGEntry{
							{
								CardType: "blank",
								Weight:   1,
							},
						},
					},
				},
			},
		},
	}
}

func newTestBoardHandler() (*Handler, *MemoryRepo) {
	repo := NewMemoryRepo()
	h := NewHandler(repo, task.NewMemoryRepo(), testBoardConfig())
	return h, repo
}

func topDefID(state *model.BoardState, stack *model.Stack) model.CardDefID {
	if stack == nil || len(stack.Cards) == 0 {
		return ""
	}
	top := state.GetCard(stack.Cards[len(stack.Cards)-1])
	if top == nil {
		return ""
	}
	return top.DefID
}

func findStackWithTopDef(state *model.BoardState, want model.CardDefID) string {
	for id, s := range state.Stacks {
		if topDefID(state, s) == want {
			return string(id)
		}
	}
	return ""
}

func TestGetState_PutIsDeprecated(t *testing.T) {
	h, _ := newTestBoardHandler()

	req := httptest.NewRequest(http.MethodPut, "/api/board/state", bytes.NewBufferString(`{"stacks":[],"maxZ":10}`))
	rec := httptest.NewRecorder()
	h.GetState(rec, req)

	if rec.Code != http.StatusGone {
		t.Fatalf("expected %d, got %d", http.StatusGone, rec.Code)
	}
}

func TestCommand_VersionConflict(t *testing.T) {
	h, _ := newTestBoardHandler()

	body := []byte(`{"cmd":"board.seed_default","clientVersion":"9","args":{"deckRowY":500}}`)
	req := httptest.NewRequest(http.MethodPost, "/api/board/cmd", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.Command(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected %d, got %d", http.StatusConflict, rec.Code)
	}

	var out CommandResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if out.OK {
		t.Fatalf("expected ok=false")
	}
	if out.NewVersion != "10" {
		t.Fatalf("expected server version 10, got %q", out.NewVersion)
	}
}

func TestDeckCommands_OpenPackLifecycle(t *testing.T) {
	h, _ := newTestBoardHandler()
	state := model.NewBoardState()

	if _, err := h.executeCommand(state, nil, nil, "board.seed_default", map[string]any{"deckRowY": float64(500)}); err != nil {
		t.Fatalf("seed default: %v", err)
	}

	firstDayStack := findStackWithTopDef(state, "deck.first_day")
	if firstDayStack == "" {
		t.Fatalf("expected deck.first_day stack")
	}

	if _, err := h.executeCommand(state, nil, nil, "deck.spawn_pack", map[string]any{
		"deckStackId": firstDayStack,
		"x":           float64(300),
		"y":           float64(300),
		"packDefId":   "deck.first_day_pack",
	}); err != nil {
		t.Fatalf("spawn pack: %v", err)
	}

	packStack := findStackWithTopDef(state, "deck.first_day_pack")
	if packStack == "" {
		t.Fatalf("expected deck.first_day_pack stack")
	}

	stacksBefore := len(state.Stacks)

	if _, err := h.executeCommand(state, nil, nil, "deck.open_pack", map[string]any{
		"packStackId": packStack,
		"deckId":      "deck.first_day",
		"radius":      float64(170),
		"seed":        float64(1337),
	}); err != nil {
		t.Fatalf("open pack: %v", err)
	}

	if findStackWithTopDef(state, "deck.first_day_pack") != "" {
		t.Fatalf("expected pack stack to be removed after open")
	}

	drawCount := testBoardConfig().Decks.List[0].Draws.Count
	wantStacks := stacksBefore - 1 + drawCount
	if got := len(state.Stacks); got != wantStacks {
		t.Fatalf("unexpected stack count after open: got %d want %d", got, wantStacks)
	}
}
