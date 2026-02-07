package blueprint

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
	Users map[string]map[model.BlueprintID]model.Blueprint `json:"users"`
}

type fileStore struct {
	mu   sync.RWMutex
	path string
	s    fileState
}

// FileRepo is a persistent blueprint repo scoped by user.
type FileRepo struct {
	store  *fileStore
	userID string
}

func NewFileRepo(dataDir string) (*FileRepo, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}
	st := &fileStore{
		path: filepath.Join(dataDir, "blueprints.json"),
		s: fileState{
			Users: map[string]map[model.BlueprintID]model.Blueprint{},
		},
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
			s.s.Users = map[string]map[model.BlueprintID]model.Blueprint{}
			return nil
		}
		return err
	}
	var loaded fileState
	if err := json.Unmarshal(b, &loaded); err != nil {
		return err
	}
	if loaded.Users == nil {
		loaded.Users = map[string]map[model.BlueprintID]model.Blueprint{}
	}
	for uid, m := range loaded.Users {
		if m == nil {
			loaded.Users[uid] = map[model.BlueprintID]model.Blueprint{}
		}
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

func (r *FileRepo) userMapLocked() map[model.BlueprintID]model.Blueprint {
	m, ok := r.store.s.Users[r.userID]
	if !ok || m == nil {
		m = map[model.BlueprintID]model.Blueprint{}
		r.store.s.Users[r.userID] = m
	}
	return m
}

func (r *FileRepo) Create(b model.Blueprint) (model.Blueprint, error) {
	r.store.mu.Lock()
	defer r.store.mu.Unlock()

	m := r.userMapLocked()
	if strings.TrimSpace(string(b.ID)) == "" {
		b.ID = newID("bp")
	}
	normalizeBlueprint(&b)
	b.CreatedAt = b.CreatedAt.UTC()
	if b.CreatedAt.IsZero() {
		b.CreatedAt = nowUTC()
	}
	b.UpdatedAt = nowUTC()
	m[b.ID] = b
	if err := r.store.saveLocked(); err != nil {
		return model.Blueprint{}, err
	}
	return b, nil
}

func (r *FileRepo) Get(id model.BlueprintID) (model.Blueprint, error) {
	r.store.mu.RLock()
	defer r.store.mu.RUnlock()

	m, ok := r.store.s.Users[r.userID]
	if !ok {
		return model.Blueprint{}, ErrNotFound
	}
	b, ok := m[id]
	if !ok {
		return model.Blueprint{}, ErrNotFound
	}
	normalizeBlueprint(&b)
	return b, nil
}

func (r *FileRepo) List() ([]model.Blueprint, error) {
	r.store.mu.RLock()
	defer r.store.mu.RUnlock()

	m, ok := r.store.s.Users[r.userID]
	if !ok {
		return []model.Blueprint{}, nil
	}
	out := make([]model.Blueprint, 0, len(m))
	for _, b := range m {
		bCopy := b
		normalizeBlueprint(&bCopy)
		out = append(out, bCopy)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].UpdatedAt.After(out[j].UpdatedAt)
	})
	return out, nil
}

func nowUTC() time.Time {
	return time.Now().UTC()
}
