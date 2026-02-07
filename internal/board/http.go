package board

import (
	"encoding/json"
	"fmt"
	"net/http"

	"donegeon/internal/config"
	"donegeon/internal/model"
	"donegeon/internal/player"
	"donegeon/internal/task"
)

// Handler handles board-related HTTP requests.
type Handler struct {
	repo             Repo
	taskRepo         task.Repo
	validator        *Validator
	cfg              *config.Config
	boardIDResolver  func(*http.Request) string
	taskRepoResolver func(*http.Request) task.Repo
	playerResolver   func(*http.Request) *player.FileRepo
}

// NewHandler creates a new board handler.
func NewHandler(repo Repo, taskRepo task.Repo, cfg *config.Config) *Handler {
	return &Handler{
		repo:      repo,
		taskRepo:  taskRepo,
		validator: NewValidator(cfg),
		cfg:       cfg,
	}
}

func (h *Handler) SetBoardIDResolver(fn func(*http.Request) string) {
	h.boardIDResolver = fn
}

func (h *Handler) SetTaskRepoResolver(fn func(*http.Request) task.Repo) {
	h.taskRepoResolver = fn
}

func (h *Handler) SetPlayerResolver(fn func(*http.Request) *player.FileRepo) {
	h.playerResolver = fn
}

func (h *Handler) boardIDFromRequest(r *http.Request) string {
	if h.boardIDResolver != nil {
		if id := h.boardIDResolver(r); id != "" {
			return id
		}
	}
	boardID := r.URL.Query().Get("board")
	if boardID == "" {
		boardID = "default"
	}
	return boardID
}

func (h *Handler) taskRepoFromRequest(r *http.Request) task.Repo {
	if h.taskRepoResolver != nil {
		if repo := h.taskRepoResolver(r); repo != nil {
			return repo
		}
	}
	return h.taskRepo
}

func (h *Handler) playerRepoFromRequest(r *http.Request) *player.FileRepo {
	if h.playerResolver == nil {
		return nil
	}
	return h.playerResolver(r)
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
		// Deprecated: server-authoritative mutations must go through /api/board/cmd.
		writeErr(w, http.StatusGone, "PUT /api/board/state is deprecated; use POST /api/board/cmd")
		return
	}

	if r.Method != http.MethodGet {
		writeErr(w, 405, "method not allowed")
		return
	}

	boardID := h.boardIDFromRequest(r)

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
	boardID := h.boardIDFromRequest(r)

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

	boardID := h.boardIDFromRequest(r)

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
	serverVersion := fmt.Sprintf("%d", state.NextZ)
	if req.ClientVersion != "" && req.ClientVersion != serverVersion {
		writeJSON(w, http.StatusConflict, CommandResponse{
			OK:         false,
			NewVersion: serverVersion,
			Error:      "board version conflict",
		})
		return
	}

	patch, err := h.executeCommand(state, h.taskRepoFromRequest(r), h.playerRepoFromRequest(r), req.Cmd, req.Args)
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
func (h *Handler) executeCommand(state *model.BoardState, taskRepo task.Repo, playerRepo *player.FileRepo, cmd string, args map[string]any) (any, error) {
	switch cmd {
	case "board.seed_default":
		return h.cmdBoardSeedDefault(state, args)
	case "card.spawn":
		return h.cmdCardSpawn(state, args)
	case "deck.spawn_pack":
		return h.cmdDeckSpawnPack(state, args)
	case "deck.open_pack":
		return h.cmdDeckOpenPack(state, taskRepo, playerRepo, args)
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
	case "stack.remove":
		return h.cmdStackRemove(state, args)
	case "task.create_blank":
		return h.cmdTaskCreateBlank(state, taskRepo, args)
	case "task.spawn_existing":
		return h.cmdTaskSpawnExisting(state, taskRepo, playerRepo, args)
	case "task.set_title":
		return h.cmdTaskSetTitle(state, taskRepo, args)
	case "task.set_description":
		return h.cmdTaskSetDescription(state, taskRepo, args)
	case "task.set_task_id":
		return h.cmdTaskSetTaskID(state, taskRepo, args)
	case "task.add_modifier":
		return h.cmdTaskAddModifier(state, args)
	case "task.assign_villager":
		return h.cmdTaskAssignVillager(state, taskRepo, args)
	case "task.complete_stack":
		return h.cmdTaskCompleteStack(state, taskRepo, playerRepo, args)
	case "task.complete_by_task_id":
		return h.cmdTaskCompleteByTaskID(state, taskRepo, playerRepo, args)
	case "world.end_day":
		return h.cmdWorldEndDay(state, taskRepo, playerRepo, args)
	case "zombie.clear":
		return h.cmdZombieClear(state, playerRepo, args)
	case "resource.gather":
		return h.cmdResourceGather(state, playerRepo, args)
	case "food.consume":
		return h.cmdFoodConsume(state, playerRepo, args)
	case "loot.collect_stack":
		return h.cmdLootCollectStack(state, taskRepo, playerRepo, args)
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

// Helper to get optional string.
func getStringOr(args map[string]any, key string) (string, error) {
	v, ok := args[key]
	if !ok {
		return "", nil
	}
	if v == nil {
		return "", nil
	}
	s, ok := v.(string)
	if !ok {
		return "", fmt.Errorf("field %s must be a string", key)
	}
	return s, nil
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

// Helper to get optional int.
func getIntPtr(args map[string]any, key string) (*int, error) {
	v, ok := args[key]
	if !ok {
		return nil, nil
	}
	f, ok := v.(float64)
	if !ok {
		return nil, fmt.Errorf("field %s must be a number", key)
	}
	n := int(f)
	return &n, nil
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
	ensureTaskFaceCard(state, target)

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
	newX, err := getIntPtr(args, "newX")
	if err != nil {
		return nil, err
	}
	newY, err := getIntPtr(args, "newY")
	if err != nil {
		return nil, err
	}

	stack := state.GetStack(model.StackID(stackID))
	if stack == nil {
		return nil, fmt.Errorf("stack not found: %s", stackID)
	}

	var newStack *model.Stack
	if index == 0 {
		newStack = state.PopBottom(model.StackID(stackID), model.Point{X: offsetX, Y: offsetY})
	} else {
		newStack = state.SplitStack(model.StackID(stackID), index, model.Point{X: offsetX, Y: offsetY})
	}
	if newStack == nil {
		return nil, fmt.Errorf("could not split stack at index %d", index)
	}
	if newX != nil && newY != nil {
		newStack.Pos = model.Point{X: *newX, Y: *newY}
	}

	return map[string]any{
		"source":   stack,
		"newStack": newStack,
	}, nil
}

// stack.remove { stackId }
func (h *Handler) cmdStackRemove(state *model.BoardState, args map[string]any) (any, error) {
	stackID, err := getString(args, "stackId")
	if err != nil {
		return nil, err
	}
	stack := state.GetStack(model.StackID(stackID))
	if stack == nil {
		return nil, fmt.Errorf("stack not found: %s", stackID)
	}
	for _, cardID := range stack.Cards {
		state.RemoveCard(cardID)
	}
	state.RemoveStack(model.StackID(stackID))
	return map[string]any{
		"removedStack": stackID,
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
func (h *Handler) cmdTaskCreateBlank(state *model.BoardState, taskRepo task.Repo, args map[string]any) (any, error) {
	x, err := getInt(args, "x")
	if err != nil {
		return nil, err
	}
	y, err := getInt(args, "y")
	if err != nil {
		return nil, err
	}

	// Create task in task repo first (so it appears in /tasks view)
	var taskID model.TaskID
	if taskRepo != nil {
		inbox := "inbox"
		t, err := taskRepo.Create(model.Task{
			Title:       "",
			Description: "",
			Project:     &inbox,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create task: %w", err)
		}
		taskID = t.ID

		// Mark as live (on board)
		_ = taskRepo.SetLive(taskID, true)
	}

	// Create a blank task card with inbox as default zone
	card := state.CreateCard("task.blank", map[string]any{
		"title":       "",
		"description": "",
		"project":     "inbox",
		"taskId":      string(taskID), // Link to task repo
	})

	// Create a stack with the task card
	stack := state.CreateStack(model.Point{X: x, Y: y}, []model.CardID{card.ID})

	return map[string]any{
		"stack":  stack,
		"card":   card,
		"taskId": taskID,
	}, nil
}

// task.set_title { taskCardId, title }
func (h *Handler) cmdTaskSetTitle(state *model.BoardState, taskRepo task.Repo, args map[string]any) (any, error) {
	cardID, err := getString(args, "taskCardId")
	if err != nil {
		return nil, err
	}
	title, err := getString(args, "title")
	if err != nil {
		return nil, err
	}

	card := state.GetCard(model.CardID(cardID))
	if card == nil {
		return nil, fmt.Errorf("card not found: %s", cardID)
	}

	if card.Data == nil {
		card.Data = make(map[string]any)
	}
	card.DefID = "task.instance"
	card.Data["title"] = title

	// Sync to task repo if linked
	if taskRepo != nil {
		if taskIDStr, ok := card.Data["taskId"].(string); ok && taskIDStr != "" {
			_, _ = taskRepo.Update(model.TaskID(taskIDStr), task.Patch{Title: &title})
			_ = taskRepo.SetLive(model.TaskID(taskIDStr), true)
		}
	}

	return map[string]any{
		"card": card,
	}, nil
}

// task.set_description { taskCardId, description }
func (h *Handler) cmdTaskSetDescription(state *model.BoardState, taskRepo task.Repo, args map[string]any) (any, error) {
	cardID, err := getString(args, "taskCardId")
	if err != nil {
		return nil, err
	}
	description, err := getString(args, "description")
	if err != nil {
		return nil, err
	}

	card := state.GetCard(model.CardID(cardID))
	if card == nil {
		return nil, fmt.Errorf("card not found: %s", cardID)
	}

	if card.Data == nil {
		card.Data = make(map[string]any)
	}
	card.DefID = "task.instance"
	card.Data["description"] = description

	// Sync to task repo if linked
	if taskRepo != nil {
		if taskIDStr, ok := card.Data["taskId"].(string); ok && taskIDStr != "" {
			_, _ = taskRepo.Update(model.TaskID(taskIDStr), task.Patch{Description: &description})
			_ = taskRepo.SetLive(model.TaskID(taskIDStr), true)
		}
	}

	return map[string]any{
		"card": card,
	}, nil
}

// task.add_modifier { taskStackId, modifierDefId }
func (h *Handler) cmdTaskAddModifier(state *model.BoardState, args map[string]any) (any, error) {
	stackID, err := getString(args, "taskStackId")
	if err != nil {
		return nil, err
	}
	modifierDefID, err := getString(args, "modifierDefId")
	if err != nil {
		return nil, err
	}

	stack := state.GetStack(model.StackID(stackID))
	if stack == nil {
		return nil, fmt.Errorf("stack not found: %s", stackID)
	}

	// Validate modifier can be added
	if h.validator != nil {
		if err := h.validator.ValidateModifierAdd(state, model.StackID(stackID), model.CardDefID(modifierDefID)); err != nil {
			return nil, err
		}
	}

	// Create modifier card
	modCard := state.CreateCard(model.CardDefID(modifierDefID), nil)

	// Add to stack
	stack.Cards = append(stack.Cards, modCard.ID)
	ensureTaskFaceCard(state, stack)

	return map[string]any{
		"stack":    stack,
		"modifier": modCard,
	}, nil
}

// task.assign_villager { taskStackId, villagerStackId }
func (h *Handler) cmdTaskAssignVillager(state *model.BoardState, taskRepo task.Repo, args map[string]any) (any, error) {
	taskStackID, err := getString(args, "taskStackId")
	if err != nil {
		return nil, err
	}
	villagerStackID, err := getString(args, "villagerStackId")
	if err != nil {
		return nil, err
	}

	taskStack := state.GetStack(model.StackID(taskStackID))
	if taskStack == nil {
		return nil, fmt.Errorf("task stack not found: %s", taskStackID)
	}

	villagerStack := state.GetStack(model.StackID(villagerStackID))
	if villagerStack == nil {
		return nil, fmt.Errorf("villager stack not found: %s", villagerStackID)
	}
	targetStackID, err := getStringOr(args, "targetStackId")
	if err != nil {
		return nil, err
	}
	if targetStackID != "" && targetStackID != taskStackID && targetStackID != villagerStackID {
		return nil, fmt.Errorf("targetStackId must match task or villager stack")
	}

	taskCardID := ""
	taskID := ""
	for _, cid := range taskStack.Cards {
		c := state.GetCard(cid)
		if c == nil {
			continue
		}
		if c.DefID == "task.blank" || c.DefID == "task.instance" {
			taskCardID = string(c.ID)
			if c.Data != nil {
				if v, ok := c.Data["taskId"].(string); ok {
					taskID = v
				}
			}
			break
		}
	}

	// Merge villager stack into task stack
	if targetStackID == villagerStackID {
		// Preserve "receiver" position when the user drops task onto villager.
		taskStack.Pos = villagerStack.Pos
	}
	state.MergeStacks(model.StackID(taskStackID), model.StackID(villagerStackID))
	ensureTaskFaceCard(state, taskStack)
	if taskCardID != "" {
		if taskCard := state.GetCard(model.CardID(taskCardID)); taskCard != nil {
			if taskCard.Data == nil {
				taskCard.Data = map[string]any{}
			}
			taskCard.Data["assignedVillagerId"] = villagerStackID
		}
	}
	if taskRepo != nil && taskID != "" {
		assigned := villagerStackID
		_, _ = taskRepo.Update(model.TaskID(taskID), task.Patch{AssignedVillagerID: &assigned})
	}

	return map[string]any{
		"stack":           taskStack,
		"removedVillager": villagerStackID,
	}, nil
}
