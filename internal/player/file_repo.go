package player

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

type store struct {
	mu   sync.RWMutex
	path string
	s    fileState
}

type FileRepo struct {
	store  *store
	userID string
}

func NewFileRepo(dataDir string) (*FileRepo, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}
	st := &store{
		path: filepath.Join(dataDir, "state.json"),
		s: fileState{
			Users: map[string]UserState{},
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

func (s *store) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	b, err := os.ReadFile(s.path)
	if err != nil {
		if os.IsNotExist(err) {
			s.s = fileState{Users: map[string]UserState{}}
			return nil
		}
		return err
	}

	var loaded fileState
	if err := json.Unmarshal(b, &loaded); err != nil {
		return err
	}
	if loaded.Users == nil {
		loaded.Users = map[string]UserState{}
	}
	for uid, us := range loaded.Users {
		loaded.Users[uid] = normalizeUserState(us)
	}
	s.s = loaded
	return nil
}

func (s *store) saveLocked() error {
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

func (r *FileRepo) userStateLocked() UserState {
	us, ok := r.store.s.Users[r.userID]
	if !ok {
		us = defaultUserState()
		r.store.s.Users[r.userID] = us
		return us
	}
	us = normalizeUserState(us)
	r.store.s.Users[r.userID] = us
	return us
}

func cloneMapInt(src map[string]int) map[string]int {
	out := make(map[string]int, len(src))
	for k, v := range src {
		out[k] = v
	}
	return out
}

func cloneMapBool(src map[string]bool) map[string]bool {
	out := make(map[string]bool, len(src))
	for k, v := range src {
		out[k] = v
	}
	return out
}

func cloneUserState(src UserState) UserState {
	return UserState{
		Loot:            cloneMapInt(src.Loot),
		Unlocks:         cloneMapBool(src.Unlocks),
		VillagerStamina: cloneMapInt(src.VillagerStamina),
	}
}

func (r *FileRepo) GetState() UserState {
	r.store.mu.Lock()
	defer r.store.mu.Unlock()
	us := r.userStateLocked()
	return cloneUserState(us)
}

func (r *FileRepo) AddLoot(kind string, amount int) (UserState, error) {
	if amount <= 0 {
		return r.GetState(), nil
	}
	r.store.mu.Lock()
	defer r.store.mu.Unlock()
	us := r.userStateLocked()
	us.Loot[kind] = us.Loot[kind] + amount
	r.store.s.Users[r.userID] = us
	if err := r.store.saveLocked(); err != nil {
		return UserState{}, err
	}
	return cloneUserState(us), nil
}

func (r *FileRepo) SpendLoot(kind string, amount int) (bool, UserState, error) {
	if amount <= 0 {
		return true, r.GetState(), nil
	}
	r.store.mu.Lock()
	defer r.store.mu.Unlock()
	us := r.userStateLocked()
	if us.Loot[kind] < amount {
		return false, cloneUserState(us), nil
	}
	us.Loot[kind] = us.Loot[kind] - amount
	r.store.s.Users[r.userID] = us
	if err := r.store.saveLocked(); err != nil {
		return false, UserState{}, err
	}
	return true, cloneUserState(us), nil
}

func (r *FileRepo) IsUnlocked(feature string) bool {
	r.store.mu.Lock()
	defer r.store.mu.Unlock()
	us := r.userStateLocked()
	return us.Unlocks[feature]
}

func (r *FileRepo) UnlockFeature(feature string, coinCost int) (already, unlocked bool, state UserState, err error) {
	r.store.mu.Lock()
	defer r.store.mu.Unlock()

	us := r.userStateLocked()
	if us.Unlocks[feature] {
		return true, true, cloneUserState(us), nil
	}
	if coinCost > 0 && us.Loot[LootCoin] < coinCost {
		return false, false, cloneUserState(us), nil
	}
	if coinCost > 0 {
		us.Loot[LootCoin] = us.Loot[LootCoin] - coinCost
	}
	us.Unlocks[feature] = true
	r.store.s.Users[r.userID] = us
	if err := r.store.saveLocked(); err != nil {
		return false, false, UserState{}, err
	}
	return false, true, cloneUserState(us), nil
}

func (r *FileRepo) SpendVillagerStamina(villagerID string, cost, maxStamina int) (ok bool, remaining int, state UserState, err error) {
	villagerID = strings.TrimSpace(villagerID)
	if villagerID == "" {
		return false, 0, r.GetState(), nil
	}
	if maxStamina <= 0 {
		maxStamina = 6
	}
	if cost <= 0 {
		s := r.GetState()
		cur, ok := s.VillagerStamina[villagerID]
		if !ok {
			cur = maxStamina
		}
		return true, cur, s, nil
	}

	r.store.mu.Lock()
	defer r.store.mu.Unlock()

	us := r.userStateLocked()
	cur, ok := us.VillagerStamina[villagerID]
	if !ok {
		cur = maxStamina
	}
	if cur < cost {
		return false, cur, cloneUserState(us), nil
	}
	cur -= cost
	us.VillagerStamina[villagerID] = cur
	r.store.s.Users[r.userID] = us
	if err := r.store.saveLocked(); err != nil {
		return false, cur, UserState{}, err
	}
	return true, cur, cloneUserState(us), nil
}

func (r *FileRepo) ResetVillagerStamina(villagerIDs []string, maxStamina int, mode string) (UserState, error) {
	if maxStamina <= 0 {
		maxStamina = 6
	}

	ids := make([]string, 0, len(villagerIDs))
	seen := map[string]bool{}
	for _, id := range villagerIDs {
		id = strings.TrimSpace(id)
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		ids = append(ids, id)
	}
	sort.Strings(ids)

	r.store.mu.Lock()
	defer r.store.mu.Unlock()

	us := r.userStateLocked()
	next := map[string]int{}

	mode = strings.ToLower(strings.TrimSpace(mode))
	if mode == "" {
		mode = "full"
	}

	partialGain := maxStamina / 2
	if partialGain <= 0 {
		partialGain = 1
	}

	for _, id := range ids {
		cur, ok := us.VillagerStamina[id]
		if !ok {
			cur = maxStamina
		}
		switch mode {
		case "partial":
			cur += partialGain
			if cur > maxStamina {
				cur = maxStamina
			}
		default:
			cur = maxStamina
		}
		next[id] = cur
	}

	us.VillagerStamina = next
	r.store.s.Users[r.userID] = us
	if err := r.store.saveLocked(); err != nil {
		return UserState{}, err
	}
	return cloneUserState(us), nil
}

func (r *FileRepo) BuildStateResponse() StateResponse {
	us := r.GetState()
	return StateResponse{
		Loot:            us.Loot,
		Unlocks:         us.Unlocks,
		VillagerStamina: us.VillagerStamina,
		Costs:           defaultCosts(),
	}
}
