package task

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"donegeon/internal/model"
)

type fileState struct {
	Users map[string]userTaskState `json:"users"`
}

type userTaskState struct {
	Tasks     map[model.TaskID]model.Task `json:"tasks"`
	LiveIndex map[model.TaskID]bool       `json:"liveIndex"`
}

func newFileState() fileState {
	return fileState{
		Users: map[string]userTaskState{},
	}
}

func newUserTaskState() userTaskState {
	return userTaskState{
		Tasks:     map[model.TaskID]model.Task{},
		LiveIndex: map[model.TaskID]bool{},
	}
}

type fileStore struct {
	mu   sync.RWMutex
	path string
	s    fileState
}

// FileRepo is a persistent task repository.
// It is user-scoped; call ForUser(userID) to get a scoped view.
type FileRepo struct {
	store  *fileStore
	userID string
}

func NewFileRepo(dataDir string) (*FileRepo, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}
	st := &fileStore{
		path: filepath.Join(dataDir, "tasks.json"),
		s:    newFileState(),
	}
	if err := st.load(); err != nil {
		return nil, err
	}
	return &FileRepo{
		store:  st,
		userID: "default",
	}, nil
}

func (s *fileStore) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	b, err := os.ReadFile(s.path)
	if err != nil {
		if os.IsNotExist(err) {
			s.s = newFileState()
			return nil
		}
		return err
	}

	var loaded fileState
	if err := json.Unmarshal(b, &loaded); err != nil {
		return err
	}
	if loaded.Users == nil {
		loaded.Users = map[string]userTaskState{}
	}
	for uid, us := range loaded.Users {
		if us.Tasks == nil {
			us.Tasks = map[model.TaskID]model.Task{}
		}
		if us.LiveIndex == nil {
			us.LiveIndex = map[model.TaskID]bool{}
		}
		loaded.Users[uid] = us
	}
	s.s = loaded
	return nil
}

func (s *fileStore) saveLocked() error {
	b, err := json.MarshalIndent(s.s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, b, 0o644)
}

func (r *FileRepo) ForUser(userID string) *FileRepo {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		userID = "default"
	}
	return &FileRepo{
		store:  r.store,
		userID: userID,
	}
}

func (r *FileRepo) userStateLocked() userTaskState {
	us, ok := r.store.s.Users[r.userID]
	if !ok {
		us = newUserTaskState()
		r.store.s.Users[r.userID] = us
		return us
	}
	if us.Tasks == nil {
		us.Tasks = map[model.TaskID]model.Task{}
	}
	if us.LiveIndex == nil {
		us.LiveIndex = map[model.TaskID]bool{}
	}
	r.store.s.Users[r.userID] = us
	return us
}

func (r *FileRepo) writeUserStateLocked(us userTaskState) {
	r.store.s.Users[r.userID] = us
}

func (r *FileRepo) SyncLive(taskIDs []model.TaskID) error {
	r.store.mu.Lock()
	defer r.store.mu.Unlock()

	us := r.userStateLocked()

	next := make(map[model.TaskID]bool, len(taskIDs))
	for _, id := range taskIDs {
		if id == "" {
			continue
		}
		if t, ok := us.Tasks[id]; ok && !t.Done {
			next[id] = true
		}
	}
	us.LiveIndex = next
	r.writeUserStateLocked(us)
	return r.store.saveLocked()
}

func (r *FileRepo) SetLive(id model.TaskID, live bool) error {
	r.store.mu.Lock()
	defer r.store.mu.Unlock()

	us := r.userStateLocked()
	t, ok := us.Tasks[id]
	if !ok {
		return ErrNotFound
	}

	if t.Done {
		delete(us.LiveIndex, id)
		r.writeUserStateLocked(us)
		return r.store.saveLocked()
	}

	if live {
		us.LiveIndex[id] = true
	} else {
		delete(us.LiveIndex, id)
	}
	r.writeUserStateLocked(us)
	return r.store.saveLocked()
}

func (r *FileRepo) Create(t model.Task) (model.Task, error) {
	r.store.mu.Lock()
	defer r.store.mu.Unlock()

	us := r.userStateLocked()

	now := time.Now()
	t.ID = newID("task")
	t.CreatedAt = now
	t.UpdatedAt = now
	normalizeTask(&t)

	us.Tasks[t.ID] = t
	r.writeUserStateLocked(us)
	if err := r.store.saveLocked(); err != nil {
		return model.Task{}, err
	}
	return t, nil
}

func (r *FileRepo) Get(id model.TaskID) (model.Task, error) {
	r.store.mu.RLock()
	defer r.store.mu.RUnlock()

	us, ok := r.store.s.Users[r.userID]
	if !ok || us.Tasks == nil {
		return model.Task{}, ErrNotFound
	}
	t, ok := us.Tasks[id]
	if !ok {
		return model.Task{}, ErrNotFound
	}
	normalizeTask(&t)
	return t, nil
}

func (r *FileRepo) Update(id model.TaskID, p Patch) (model.Task, error) {
	r.store.mu.Lock()
	defer r.store.mu.Unlock()

	us := r.userStateLocked()
	t, ok := us.Tasks[id]
	if !ok {
		return model.Task{}, ErrNotFound
	}
	if err := applyPatch(&t, p); err != nil {
		return model.Task{}, err
	}
	if t.Done {
		us.LiveIndex[t.ID] = false
	}
	t.UpdatedAt = time.Now()
	normalizeTask(&t)
	us.Tasks[id] = t
	r.writeUserStateLocked(us)
	if err := r.store.saveLocked(); err != nil {
		return model.Task{}, err
	}
	return t, nil
}

func (r *FileRepo) List(filter ListFilter) ([]model.Task, error) {
	r.store.mu.RLock()
	defer r.store.mu.RUnlock()

	us, ok := r.store.s.Users[r.userID]
	if !ok || us.Tasks == nil {
		return []model.Task{}, nil
	}

	today := time.Now().Format("2006-01-02")
	status := strings.ToLower(strings.TrimSpace(filter.Status))
	projectFilter := strings.TrimSpace(filter.Project)
	projectFilterLower := strings.ToLower(projectFilter)

	out := make([]model.Task, 0, len(us.Tasks))
	for _, t0 := range us.Tasks {
		t := t0
		normalizeTask(&t)

		if t.Done {
			t.Live = false
		} else {
			t.Live = us.LiveIndex[t.ID] && !t.Done
		}

		if filter.Live != nil && t.Live != *filter.Live {
			continue
		}

		p := ""
		if t.Project != nil {
			p = strings.TrimSpace(*t.Project)
		}
		switch projectFilterLower {
		case "", "any":
		case "inbox":
			if p != "inbox" {
				continue
			}
		case "projects":
			if p == "" || p == "inbox" {
				continue
			}
		default:
			if p != projectFilter {
				continue
			}
		}

		switch status {
		case "", "all":
		case "pending":
			if t.Done {
				continue
			}
		case "done":
			if !t.Done {
				continue
			}
		case "due_today":
			if t.Done || t.DueDate == nil || *t.DueDate != today {
				continue
			}
		case "overdue":
			if t.Done || t.DueDate == nil || *t.DueDate >= today {
				continue
			}
		case "upcoming":
			if t.Done || t.DueDate == nil || *t.DueDate <= today {
				continue
			}
		}

		out = append(out, t)
	}

	sort.Slice(out, func(i, j int) bool {
		di, dj := out[i].DueDate, out[j].DueDate
		switch {
		case di == nil && dj == nil:
			return out[i].UpdatedAt.After(out[j].UpdatedAt)
		case di == nil:
			return false
		case dj == nil:
			return true
		case *di != *dj:
			return *di < *dj
		default:
			return out[i].UpdatedAt.After(out[j].UpdatedAt)
		}
	})

	return out, nil
}

func (r *FileRepo) SetModifiers(id model.TaskID, mods []model.TaskModifierSlot) (model.Task, error) {
	p := Patch{Modifiers: &mods}
	return r.Update(id, p)
}
