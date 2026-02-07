package plugin

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

type userState struct {
	Installed map[model.PluginID]model.InstalledPlugin `json:"installed"`
	Community map[model.PluginID]model.PluginManifest  `json:"community"`
}

type fileState struct {
	Users map[string]userState `json:"users"`
}

type fileStore struct {
	mu   sync.RWMutex
	path string
	s    fileState
}

type FileRepo struct {
	store       *fileStore
	corePlugins map[model.PluginID]model.PluginManifest
	userID      string
}

func NewFileRepo(dataDir string) (*FileRepo, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}
	st := &fileStore{
		path: filepath.Join(dataDir, "plugins.json"),
		s:    fileState{Users: map[string]userState{}},
	}
	if err := st.load(); err != nil {
		return nil, err
	}

	core := map[model.PluginID]model.PluginManifest{}
	for _, m := range defaultCorePlugins() {
		mm := m
		normalizeManifest(&mm)
		mm.Source = model.PluginSourceCore
		core[mm.ID] = mm
	}

	return &FileRepo{
		store:       st,
		corePlugins: core,
		userID:      "default",
	}, nil
}

func (s *fileStore) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	b, err := os.ReadFile(s.path)
	if err != nil {
		if os.IsNotExist(err) {
			s.s = fileState{Users: map[string]userState{}}
			return nil
		}
		return err
	}
	var loaded fileState
	if err := json.Unmarshal(b, &loaded); err != nil {
		return err
	}
	if loaded.Users == nil {
		loaded.Users = map[string]userState{}
	}
	for uid, st := range loaded.Users {
		loaded.Users[uid] = normalizeUserState(st)
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

func normalizeUserState(st userState) userState {
	if st.Installed == nil {
		st.Installed = map[model.PluginID]model.InstalledPlugin{}
	}
	if st.Community == nil {
		st.Community = map[model.PluginID]model.PluginManifest{}
	}
	for id, install := range st.Installed {
		if install.PluginID == "" {
			install.PluginID = id
		}
		if install.Source != model.PluginSourceCore && install.Source != model.PluginSourceCommunity {
			install.Source = model.PluginSourceCommunity
		}
		if install.InstalledAt.IsZero() {
			install.InstalledAt = time.Now().UTC()
		}
		if !install.Enabled {
			install.Enabled = true
		}
		st.Installed[id] = install
	}
	for id, manifest := range st.Community {
		m := manifest
		if m.ID == "" {
			m.ID = id
		}
		normalizeManifest(&m)
		m.Source = model.PluginSourceCommunity
		st.Community[m.ID] = m
		if m.ID != id {
			delete(st.Community, id)
		}
	}
	return st
}

func (r *FileRepo) ForUser(userID string) *FileRepo {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		userID = "default"
	}
	return &FileRepo{
		store:       r.store,
		corePlugins: r.corePlugins,
		userID:      userID,
	}
}

func (r *FileRepo) userStateLocked() userState {
	st, ok := r.store.s.Users[r.userID]
	if !ok {
		st = normalizeUserState(userState{})
		r.store.s.Users[r.userID] = st
		return st
	}
	st = normalizeUserState(st)
	r.store.s.Users[r.userID] = st
	return st
}

func cloneManifest(m model.PluginManifest) model.PluginManifest {
	return model.PluginManifest{
		ID:           m.ID,
		Name:         m.Name,
		Description:  m.Description,
		Provider:     m.Provider,
		Category:     m.Category,
		Version:      m.Version,
		CardDefID:    m.CardDefID,
		CardTitle:    m.CardTitle,
		CardIcon:     m.CardIcon,
		InstallCost:  m.InstallCost,
		Capabilities: append([]string{}, m.Capabilities...),
		Source:       m.Source,
		CreatedAt:    m.CreatedAt,
		UpdatedAt:    m.UpdatedAt,
	}
}

func cloneInstall(in model.InstalledPlugin) model.InstalledPlugin {
	return model.InstalledPlugin{
		PluginID:    in.PluginID,
		Source:      in.Source,
		InstalledAt: in.InstalledAt,
		Enabled:     in.Enabled,
	}
}

func (r *FileRepo) coreManifest(id model.PluginID) (model.PluginManifest, bool) {
	m, ok := r.corePlugins[id]
	if !ok {
		return model.PluginManifest{}, false
	}
	return cloneManifest(m), true
}

func (r *FileRepo) ListMarketplace() ([]model.PluginManifest, error) {
	r.store.mu.RLock()
	defer r.store.mu.RUnlock()

	out := make([]model.PluginManifest, 0, len(r.corePlugins)+8)
	for _, m := range r.corePlugins {
		out = append(out, cloneManifest(m))
	}

	user, ok := r.store.s.Users[r.userID]
	if ok {
		for _, m := range user.Community {
			mm := m
			normalizeManifest(&mm)
			mm.Source = model.PluginSourceCommunity
			out = append(out, mm)
		}
	}

	sort.Slice(out, func(i, j int) bool {
		if out[i].Source != out[j].Source {
			return out[i].Source == model.PluginSourceCore
		}
		if out[i].Name != out[j].Name {
			return out[i].Name < out[j].Name
		}
		return out[i].ID < out[j].ID
	})
	return out, nil
}

func (r *FileRepo) ListInstalled() ([]model.InstalledPlugin, error) {
	r.store.mu.RLock()
	defer r.store.mu.RUnlock()

	user, ok := r.store.s.Users[r.userID]
	if !ok {
		return []model.InstalledPlugin{}, nil
	}
	out := make([]model.InstalledPlugin, 0, len(user.Installed))
	for _, in := range user.Installed {
		out = append(out, cloneInstall(in))
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].InstalledAt.Equal(out[j].InstalledAt) {
			return out[i].PluginID < out[j].PluginID
		}
		return out[i].InstalledAt.After(out[j].InstalledAt)
	})
	return out, nil
}

func (r *FileRepo) GetMarketplace(id model.PluginID) (model.PluginManifest, error) {
	id = model.PluginID(slugify(string(id)))
	if id == "" {
		return model.PluginManifest{}, ErrPluginNotFound
	}

	if m, ok := r.coreManifest(id); ok {
		return m, nil
	}

	r.store.mu.RLock()
	defer r.store.mu.RUnlock()
	if user, ok := r.store.s.Users[r.userID]; ok {
		if m, ok := user.Community[id]; ok {
			mm := m
			normalizeManifest(&mm)
			mm.Source = model.PluginSourceCommunity
			return mm, nil
		}
	}
	return model.PluginManifest{}, ErrPluginNotFound
}

func (r *FileRepo) IsInstalled(id model.PluginID) (bool, error) {
	id = model.PluginID(slugify(string(id)))
	if id == "" {
		return false, nil
	}
	r.store.mu.RLock()
	defer r.store.mu.RUnlock()
	user, ok := r.store.s.Users[r.userID]
	if !ok {
		return false, nil
	}
	_, installed := user.Installed[id]
	return installed, nil
}

func (r *FileRepo) Register(manifest model.PluginManifest) (model.PluginManifest, error) {
	manifest.Source = model.PluginSourceCommunity
	normalizeManifest(&manifest)
	if err := validateManifest(manifest); err != nil {
		return model.PluginManifest{}, err
	}
	if _, exists := r.coreManifest(manifest.ID); exists {
		return model.PluginManifest{}, ErrPluginIDConflict
	}

	r.store.mu.Lock()
	defer r.store.mu.Unlock()

	user := r.userStateLocked()
	if _, exists := user.Community[manifest.ID]; exists {
		return model.PluginManifest{}, ErrPluginIDConflict
	}
	user.Community[manifest.ID] = manifest
	r.store.s.Users[r.userID] = user
	if err := r.store.saveLocked(); err != nil {
		return model.PluginManifest{}, err
	}
	return cloneManifest(manifest), nil
}

func (r *FileRepo) Install(id model.PluginID) (bool, model.InstalledPlugin, model.PluginManifest, error) {
	id = model.PluginID(slugify(string(id)))
	manifest, err := r.GetMarketplace(id)
	if err != nil {
		return false, model.InstalledPlugin{}, model.PluginManifest{}, err
	}

	r.store.mu.Lock()
	defer r.store.mu.Unlock()
	user := r.userStateLocked()
	if existing, ok := user.Installed[id]; ok {
		return true, cloneInstall(existing), cloneManifest(manifest), nil
	}
	install := model.InstalledPlugin{
		PluginID:    id,
		Source:      manifest.Source,
		InstalledAt: time.Now().UTC(),
		Enabled:     true,
	}
	user.Installed[id] = install
	r.store.s.Users[r.userID] = user
	if err := r.store.saveLocked(); err != nil {
		return false, model.InstalledPlugin{}, model.PluginManifest{}, err
	}
	return false, cloneInstall(install), cloneManifest(manifest), nil
}

func (r *FileRepo) Uninstall(id model.PluginID) (bool, error) {
	id = model.PluginID(slugify(string(id)))
	if id == "" {
		return false, nil
	}
	r.store.mu.Lock()
	defer r.store.mu.Unlock()
	user := r.userStateLocked()
	if _, ok := user.Installed[id]; !ok {
		return false, nil
	}
	delete(user.Installed, id)
	r.store.s.Users[r.userID] = user
	if err := r.store.saveLocked(); err != nil {
		return false, err
	}
	return true, nil
}
