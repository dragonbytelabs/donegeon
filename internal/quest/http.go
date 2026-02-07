package quest

import (
	"encoding/json"
	"net/http"
	"sort"
	"strings"
	"time"

	"donegeon/internal/model"
	"donegeon/internal/player"
	"donegeon/internal/task"
)

type QuestItem struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Scope       string `json:"scope"`
	Progress    int    `json:"progress"`
	Target      int    `json:"target"`
	Completed   bool   `json:"completed"`
}

type YearlyReview struct {
	TasksCompleted int    `json:"tasksCompleted"`
	ZombiesCleared int    `json:"zombiesCleared"`
	DeckOpens      int    `json:"deckOpens"`
	OverrunLevel   int    `json:"overrunLevel"`
	Title          string `json:"title"`
}

type StateResponse struct {
	Daily        []QuestItem  `json:"daily"`
	Weekly       []QuestItem  `json:"weekly"`
	Monthly      []QuestItem  `json:"monthly"`
	Seasonal     []QuestItem  `json:"seasonal"`
	YearlyReview YearlyReview `json:"yearlyReview"`
}

type Handler struct {
	taskRepoResolver func(*http.Request) task.Repo
	playerResolver   func(*http.Request) *player.FileRepo
}

func NewHandler() *Handler {
	return &Handler{}
}

func (h *Handler) SetTaskRepoResolver(fn func(*http.Request) task.Repo) {
	h.taskRepoResolver = fn
}

func (h *Handler) SetPlayerResolver(fn func(*http.Request) *player.FileRepo) {
	h.playerResolver = fn
}

func (h *Handler) tasksForRequest(r *http.Request) ([]model.Task, error) {
	if h.taskRepoResolver == nil {
		return []model.Task{}, nil
	}
	repo := h.taskRepoResolver(r)
	if repo == nil {
		return []model.Task{}, nil
	}
	return repo.List(task.ListFilter{Status: "all"})
}

func (h *Handler) playerStateForRequest(r *http.Request) player.UserState {
	if h.playerResolver == nil {
		return player.UserState{}
	}
	repo := h.playerResolver(r)
	if repo == nil {
		return player.UserState{}
	}
	return repo.GetState()
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func (h *Handler) State(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	allTasks, err := h.tasksForRequest(r)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	playerState := h.playerStateForRequest(r)
	now := time.Now().In(time.Local)

	doneToday := 0
	doneThisWeek := 0
	doneThisMonth := 0
	doneThisSeason := 0
	assignedPending := 0

	weekStart, weekEnd := timeWindowWeek(now)
	monthStart, monthEnd := timeWindowMonth(now)
	seasonStart, seasonEnd := timeWindowSeason(now)

	for _, t := range allTasks {
		if !t.Done && t.AssignedVillagerID != nil && strings.TrimSpace(*t.AssignedVillagerID) != "" {
			assignedPending++
		}
		if !t.Done {
			continue
		}
		updated := t.UpdatedAt.In(time.Local)
		if isSameLocalDay(updated, now) {
			doneToday++
		}
		if isWithinWindow(updated, weekStart, weekEnd) {
			doneThisWeek++
		}
		if isWithinWindow(updated, monthStart, monthEnd) {
			doneThisMonth++
		}
		if isWithinWindow(updated, seasonStart, seasonEnd) {
			doneThisSeason++
		}
	}

	deckOpens := 0
	for _, n := range playerState.DeckOpens {
		deckOpens += n
	}
	metrics := playerState.Metrics
	tasksCompleted := metrics[player.MetricTasksCompleted]
	if tasksCompleted < doneThisSeason {
		tasksCompleted = doneThisSeason
	}
	zombiesCleared := metrics[player.MetricZombiesCleared]
	overrunLevel := metrics[player.MetricOverrunLevel]

	resp := StateResponse{
		Daily: []QuestItem{
			quest("DQ_AssignVillager", "Assign A Villager", "Daily", assignedPending, 1, "Attach a villager card to a pending task."),
			quest("DQ_CompleteTask", "Complete One Task", "Daily", doneToday, 1, "Finish one real-world task today."),
			quest("DQ_NoOverrun", "Keep Danger Low", "Daily", boolToProgress(overrunLevel == 0), 1, "End the day with no overrun pressure."),
		},
		Weekly: []QuestItem{
			quest("WQ_Complete5", "Complete 5 Tasks", "Weekly", doneThisWeek, 5, "Build momentum through the week."),
			quest("WQ_Open3Decks", "Open 3 Decks", "Weekly", deckOpens, 3, "Draw new cards to expand options."),
		},
		Monthly: []QuestItem{
			quest("MQ_Complete20", "Complete 20 Tasks", "Monthly", doneThisMonth, 20, "Sustain consistency this month."),
		},
		Seasonal: []QuestItem{
			quest("SQ_Complete60", "Complete 60 Tasks", "Seasonal", doneThisSeason, 60, "Finish a full seasonal arc."),
			quest("SQ_Clear10Zombies", "Clear 10 Zombies", "Seasonal", zombiesCleared, 10, "Stay ahead of overdue pressure."),
		},
		YearlyReview: YearlyReview{
			TasksCompleted: tasksCompleted,
			ZombiesCleared: zombiesCleared,
			DeckOpens:      deckOpens,
			OverrunLevel:   overrunLevel,
			Title:          yearlyTitle(tasksCompleted, zombiesCleared),
		},
	}

	sort.Slice(resp.Daily, func(i, j int) bool { return resp.Daily[i].ID < resp.Daily[j].ID })
	sort.Slice(resp.Weekly, func(i, j int) bool { return resp.Weekly[i].ID < resp.Weekly[j].ID })
	sort.Slice(resp.Monthly, func(i, j int) bool { return resp.Monthly[i].ID < resp.Monthly[j].ID })
	sort.Slice(resp.Seasonal, func(i, j int) bool { return resp.Seasonal[i].ID < resp.Seasonal[j].ID })

	writeJSON(w, http.StatusOK, resp)
}

func quest(id, title, scope string, progress, target int, desc string) QuestItem {
	if target <= 0 {
		target = 1
	}
	if progress < 0 {
		progress = 0
	}
	if progress > target {
		progress = target
	}
	return QuestItem{
		ID:          id,
		Title:       title,
		Description: desc,
		Scope:       scope,
		Progress:    progress,
		Target:      target,
		Completed:   progress >= target,
	}
}

func boolToProgress(v bool) int {
	if v {
		return 1
	}
	return 0
}

func yearlyTitle(tasksCompleted, zombiesCleared int) string {
	switch {
	case tasksCompleted >= 250 && zombiesCleared >= 25:
		return "Legend Of The Board"
	case tasksCompleted >= 120:
		return "System Builder"
	case tasksCompleted >= 40:
		return "Momentum Keeper"
	default:
		return "Awakening"
	}
}

func isSameLocalDay(a, b time.Time) bool {
	return a.Year() == b.Year() && a.Month() == b.Month() && a.Day() == b.Day()
}

func isWithinWindow(t, start, end time.Time) bool {
	return (t.Equal(start) || t.After(start)) && t.Before(end)
}

func timeWindowWeek(now time.Time) (time.Time, time.Time) {
	wd := int(now.Weekday())
	if wd == 0 {
		wd = 7
	}
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).AddDate(0, 0, -(wd - 1))
	return start, start.AddDate(0, 0, 7)
}

func timeWindowMonth(now time.Time) (time.Time, time.Time) {
	start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	return start, start.AddDate(0, 1, 0)
}

func timeWindowSeason(now time.Time) (time.Time, time.Time) {
	month := int(now.Month())
	seasonStartMonth := ((month-1)/3)*3 + 1
	start := time.Date(now.Year(), time.Month(seasonStartMonth), 1, 0, 0, 0, 0, now.Location())
	return start, start.AddDate(0, 3, 0)
}
