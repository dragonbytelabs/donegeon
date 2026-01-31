package board

import (
	"encoding/json"
	"fmt"
	"net/http"

	"donegeon/internal/config"
	"donegeon/internal/model"
)

// Handler handles board-related HTTP requests.
type Handler struct {
	repo      Repo
	validator *Validator
}

// NewHandler creates a new board handler.
func NewHandler(repo Repo, cfg *config.Config) *Handler {
	return &Handler{
		repo:      repo,
		validator: NewValidator(cfg),
	}
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]any{"error": msg})
}

func decodeJSON(r *http.Request, out any) error {
	dec := json.NewDecoder(r.Body)
	return dec.Decode(out)
}

// BoardStateResponse is the response for GET /api/board/state.
type BoardStateResponse struct {
	Stacks  map[model.StackID]*model.Stack `json:"stacks"`
	Cards   map[model.CardID]*model.Card   `json:"cards"`
	Version string                         `json:"version"`
}

// GET /api/board/state
func (h *Handler) GetState(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPut {
		// PUT /api/board/state - sync frontend state to server
		h.SyncState(w, r)
		return
	}

	if r.Method != http.MethodGet {
		writeErr(w, 405, "method not allowed")
		return
	}

	boardID := r.URL.Query().Get("board")
	if boardID == "" {
		boardID = "default"
	}

	state, err := h.repo.Load(boardID)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}

	resp := BoardStateResponse{
		Stacks:  state.Stacks,
		Cards:   state.Cards,
		Version: fmt.Sprintf("%d", state.NextZ), // Simple version based on Z counter
	}

	writeJSON(w, 200, resp)
}

// SyncStateRequest is the request body for PUT /api/board/state.
type SyncStateRequest struct {
	Stacks []SyncStack `json:"stacks"`
	MaxZ   int         `json:"maxZ"`
}

type SyncStack struct {
	ID    string      `json:"id"`
	Pos   model.Point `json:"pos"`
	Z     int         `json:"z"`
	Cards []SyncCard  `json:"cards"`
}

type SyncCard struct {
	ID    string         `json:"id"`
	DefID string         `json:"defId"`
	Data  map[string]any `json:"data"`
}

// PUT /api/board/state - sync frontend state to server
func (h *Handler) SyncState(w http.ResponseWriter, r *http.Request) {
	boardID := r.URL.Query().Get("board")
	if boardID == "" {
		boardID = "default"
	}

	var req SyncStateRequest
	if err := decodeJSON(r, &req); err != nil {
		writeErr(w, 400, "invalid json")
		return
	}

	// Build new board state from frontend data
	state := model.NewBoardState()
	state.NextZ = req.MaxZ

	for _, ss := range req.Stacks {
		// Create cards first
		cardIDs := make([]model.CardID, 0, len(ss.Cards))
		for _, sc := range ss.Cards {
			card := model.NewCard(model.CardID(sc.ID), model.CardDefID(sc.DefID), sc.Data)
			state.Cards[card.ID] = card
			cardIDs = append(cardIDs, card.ID)
		}

		// Create stack
		stack := model.NewStack(model.StackID(ss.ID), ss.Pos, cardIDs)
		stack.Z = ss.Z
		state.Stacks[stack.ID] = stack
	}

	if err := h.repo.Save(boardID, state); err != nil {
		writeErr(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, map[string]any{
		"ok":      true,
		"version": fmt.Sprintf("%d", state.NextZ),
	})
}

// CommandRequest is the request body for POST /api/board/cmd.
type CommandRequest struct {
	Cmd           string         `json:"cmd"`
	Args          map[string]any `json:"args"`
	ClientVersion string         `json:"clientVersion,omitempty"`
}

// CommandResponse is the response for POST /api/board/cmd.
type CommandResponse struct {
	OK         bool   `json:"ok"`
	NewVersion string `json:"newVersion"`
	Patch      any    `json:"patch,omitempty"`
	Error      string `json:"error,omitempty"`
}

// POST /api/board/cmd
func (h *Handler) Command(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, 405, "method not allowed")
		return
	}

	boardID := r.URL.Query().Get("board")
	if boardID == "" {
		boardID = "default"
	}

	var req CommandRequest
	if err := decodeJSON(r, &req); err != nil {
		writeErr(w, 400, "invalid json")
		return
	}

	state, err := h.repo.Load(boardID)
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}

	patch, err := h.executeCommand(state, req.Cmd, req.Args)
	if err != nil {
		writeJSON(w, 400, CommandResponse{
			OK:    false,
			Error: err.Error(),
		})
		return
	}

	if err := h.repo.Save(boardID, state); err != nil {
		writeErr(w, 500, err.Error())
		return
	}

	writeJSON(w, 200, CommandResponse{
		OK:         true,
		NewVersion: fmt.Sprintf("%d", state.NextZ),
		Patch:      patch,
	})
}

// executeCommand dispatches the command to the appropriate handler.
func (h *Handler) executeCommand(state *model.BoardState, cmd string, args map[string]any) (any, error) {
	switch cmd {
	case "stack.move":
		return h.cmdStackMove(state, args)
	case "stack.bringToFront":
		return h.cmdStackBringToFront(state, args)
	case "stack.merge":
		return h.cmdStackMerge(state, args)
	case "stack.split":
		return h.cmdStackSplit(state, args)
	case "stack.unstack":
		return h.cmdStackUnstack(state, args)
	case "task.create_blank":
		return h.cmdTaskCreateBlank(state, args)
	default:
		return nil, fmt.Errorf("unknown command: %s", cmd)
	}
}

// Helper to get string from args
func getString(args map[string]any, key string) (string, error) {
	v, ok := args[key]
	if !ok {
		return "", fmt.Errorf("missing required field: %s", key)
	}
	s, ok := v.(string)
	if !ok {
		return "", fmt.Errorf("field %s must be a string", key)
	}
	return s, nil
}

// Helper to get int from args (JSON numbers are float64)
func getInt(args map[string]any, key string) (int, error) {
	v, ok := args[key]
	if !ok {
		return 0, fmt.Errorf("missing required field: %s", key)
	}
	f, ok := v.(float64)
	if !ok {
		return 0, fmt.Errorf("field %s must be a number", key)
	}
	return int(f), nil
}

// Helper to get optional int with default
func getIntOr(args map[string]any, key string, def int) int {
	v, ok := args[key]
	if !ok {
		return def
	}
	f, ok := v.(float64)
	if !ok {
		return def
	}
	return int(f)
}

// stack.move { stackId, x, y }
func (h *Handler) cmdStackMove(state *model.BoardState, args map[string]any) (any, error) {
	stackID, err := getString(args, "stackId")
	if err != nil {
		return nil, err
	}
	x, err := getInt(args, "x")
	if err != nil {
		return nil, err
	}
	y, err := getInt(args, "y")
	if err != nil {
		return nil, err
	}

	stack := state.GetStack(model.StackID(stackID))
	if stack == nil {
		return nil, fmt.Errorf("stack not found: %s", stackID)
	}

	state.MoveStack(model.StackID(stackID), model.Point{X: x, Y: y})

	return map[string]any{
		"stack": stack,
	}, nil
}

// stack.bringToFront { stackId }
func (h *Handler) cmdStackBringToFront(state *model.BoardState, args map[string]any) (any, error) {
	stackID, err := getString(args, "stackId")
	if err != nil {
		return nil, err
	}

	stack := state.GetStack(model.StackID(stackID))
	if stack == nil {
		return nil, fmt.Errorf("stack not found: %s", stackID)
	}

	state.BringToFront(model.StackID(stackID))

	return map[string]any{
		"stack": stack,
	}, nil
}

// stack.merge { targetId, sourceId }
func (h *Handler) cmdStackMerge(state *model.BoardState, args map[string]any) (any, error) {
	targetID, err := getString(args, "targetId")
	if err != nil {
		return nil, err
	}
	sourceID, err := getString(args, "sourceId")
	if err != nil {
		return nil, err
	}

	target := state.GetStack(model.StackID(targetID))
	if target == nil {
		return nil, fmt.Errorf("target stack not found: %s", targetID)
	}
	source := state.GetStack(model.StackID(sourceID))
	if source == nil {
		return nil, fmt.Errorf("source stack not found: %s", sourceID)
	}

	// Validate stacking rules
	if h.validator != nil {
		if err := h.validator.ValidateStackMerge(state, model.StackID(targetID), model.StackID(sourceID)); err != nil {
			return nil, err
		}
	}

	state.MergeStacks(model.StackID(targetID), model.StackID(sourceID))

	return map[string]any{
		"target":        target,
		"removedSource": sourceID,
	}, nil
}

// stack.split { stackId, index, offsetX, offsetY }
func (h *Handler) cmdStackSplit(state *model.BoardState, args map[string]any) (any, error) {
	stackID, err := getString(args, "stackId")
	if err != nil {
		return nil, err
	}
	index, err := getInt(args, "index")
	if err != nil {
		return nil, err
	}
	offsetX := getIntOr(args, "offsetX", 12)
	offsetY := getIntOr(args, "offsetY", 12)

	stack := state.GetStack(model.StackID(stackID))
	if stack == nil {
		return nil, fmt.Errorf("stack not found: %s", stackID)
	}

	newStack := state.SplitStack(model.StackID(stackID), index, model.Point{X: offsetX, Y: offsetY})
	if newStack == nil {
		return nil, fmt.Errorf("could not split stack at index %d", index)
	}

	return map[string]any{
		"source":   stack,
		"newStack": newStack,
	}, nil
}

// stack.unstack { stackId, positions: [{x,y}, ...] }
func (h *Handler) cmdStackUnstack(state *model.BoardState, args map[string]any) (any, error) {
	stackID, err := getString(args, "stackId")
	if err != nil {
		return nil, err
	}

	stack := state.GetStack(model.StackID(stackID))
	if stack == nil {
		return nil, fmt.Errorf("stack not found: %s", stackID)
	}

	// Parse positions array
	var positions []model.Point
	if posArg, ok := args["positions"]; ok {
		if posArr, ok := posArg.([]any); ok {
			for _, p := range posArr {
				if pm, ok := p.(map[string]any); ok {
					x := getIntOr(pm, "x", 0)
					y := getIntOr(pm, "y", 0)
					positions = append(positions, model.Point{X: x, Y: y})
				}
			}
		}
	}

	created := state.Unstack(model.StackID(stackID), positions)

	return map[string]any{
		"removedStack":  stackID,
		"createdStacks": created,
	}, nil
}

// task.create_blank { x, y }
func (h *Handler) cmdTaskCreateBlank(state *model.BoardState, args map[string]any) (any, error) {
	x, err := getInt(args, "x")
	if err != nil {
		return nil, err
	}
	y, err := getInt(args, "y")
	if err != nil {
		return nil, err
	}

	// Create a blank task card
	card := state.CreateCard("task.blank", map[string]any{
		"title":       "",
		"description": "",
	})

	// Create a stack with the task card
	stack := state.CreateStack(model.Point{X: x, Y: y}, []model.CardID{card.ID})

	return map[string]any{
		"stack": stack,
		"card":  card,
	}, nil
}
