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

func cloneMapVillagerProgress(src map[string]VillagerProgress) map[string]VillagerProgress {
	out := make(map[string]VillagerProgress, len(src))
	for k, v := range src {
		out[k] = VillagerProgress{
			XP:    v.XP,
			Level: v.Level,
			Perks: append([]string{}, v.Perks...),
		}
	}
	return out
}

func cloneUserState(src UserState) UserState {
	return UserState{
		Loot:            cloneMapInt(src.Loot),
		Unlocks:         cloneMapBool(src.Unlocks),
		VillagerStamina: cloneMapInt(src.VillagerStamina),
		Villagers:       cloneMapVillagerProgress(src.Villagers),
		Metrics:         cloneMapInt(src.Metrics),
		DeckOpens:       cloneMapInt(src.DeckOpens),
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
	caps := make(map[string]int, len(villagerIDs))
	for _, id := range villagerIDs {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		caps[id] = maxStamina
	}
	return r.ResetVillagerStaminaWithCaps(caps, mode)
}

func (r *FileRepo) ResetVillagerStaminaWithCaps(maxStaminaByVillager map[string]int, mode string) (UserState, error) {
	if len(maxStaminaByVillager) == 0 {
		return r.GetState(), nil
	}

	ids := make([]string, 0, len(maxStaminaByVillager))
	seen := map[string]bool{}
	for id := range maxStaminaByVillager {
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

	for _, id := range ids {
		cap := maxStaminaByVillager[id]
		if cap <= 0 {
			cap = 6
		}
		cur, ok := us.VillagerStamina[id]
		if !ok {
			cur = cap
		}
		switch mode {
		case "partial":
			partialGain := cap / 2
			if partialGain <= 0 {
				partialGain = 1
			}
			cur += partialGain
			if cur > cap {
				cur = cap
			}
		default:
			cur = cap
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

func (r *FileRepo) GetMetric(key string) int {
	key = strings.TrimSpace(key)
	if key == "" {
		return 0
	}
	r.store.mu.Lock()
	defer r.store.mu.Unlock()
	us := r.userStateLocked()
	return us.Metrics[key]
}

func (r *FileRepo) SetMetric(key string, value int) (UserState, error) {
	key = strings.TrimSpace(key)
	if key == "" {
		return r.GetState(), nil
	}
	if value < 0 {
		value = 0
	}
	r.store.mu.Lock()
	defer r.store.mu.Unlock()
	us := r.userStateLocked()
	us.Metrics[key] = value
	r.store.s.Users[r.userID] = us
	if err := r.store.saveLocked(); err != nil {
		return UserState{}, err
	}
	return cloneUserState(us), nil
}

func (r *FileRepo) IncrementMetric(key string, delta int) (UserState, int, error) {
	key = strings.TrimSpace(key)
	if key == "" || delta == 0 {
		s := r.GetState()
		return s, s.Metrics[key], nil
	}
	r.store.mu.Lock()
	defer r.store.mu.Unlock()
	us := r.userStateLocked()
	next := us.Metrics[key] + delta
	if next < 0 {
		next = 0
	}
	us.Metrics[key] = next
	r.store.s.Users[r.userID] = us
	if err := r.store.saveLocked(); err != nil {
		return UserState{}, 0, err
	}
	return cloneUserState(us), next, nil
}

func (r *FileRepo) GetDeckOpenCount(deckID string) int {
	deckID = strings.TrimSpace(deckID)
	if deckID == "" {
		return 0
	}
	r.store.mu.Lock()
	defer r.store.mu.Unlock()
	us := r.userStateLocked()
	return us.DeckOpens[deckID]
}

func (r *FileRepo) IncrementDeckOpen(deckID string) (int, UserState, error) {
	deckID = strings.TrimSpace(deckID)
	if deckID == "" {
		s := r.GetState()
		return 0, s, nil
	}
	r.store.mu.Lock()
	defer r.store.mu.Unlock()
	us := r.userStateLocked()
	us.DeckOpens[deckID] = us.DeckOpens[deckID] + 1
	r.store.s.Users[r.userID] = us
	if err := r.store.saveLocked(); err != nil {
		return 0, UserState{}, err
	}
	return us.DeckOpens[deckID], cloneUserState(us), nil
}

func (r *FileRepo) GetVillagerProgress(villagerID string) VillagerProgress {
	villagerID = strings.TrimSpace(villagerID)
	if villagerID == "" {
		return VillagerProgress{Level: 1}
	}
	r.store.mu.Lock()
	defer r.store.mu.Unlock()
	us := r.userStateLocked()
	vp, ok := us.Villagers[villagerID]
	if !ok || vp.Level <= 0 {
		vp = VillagerProgress{Level: 1}
		us.Villagers[villagerID] = vp
		r.store.s.Users[r.userID] = us
	}
	return VillagerProgress{
		XP:    vp.XP,
		Level: vp.Level,
		Perks: append([]string{}, vp.Perks...),
	}
}

func (r *FileRepo) AddVillagerXP(villagerID string, deltaXP int, thresholds map[int]int, maxLevel int, perkPoolIDs []string, choicesPerLevel int) (VillagerProgress, []string, UserState, error) {
	villagerID = strings.TrimSpace(villagerID)
	if villagerID == "" || deltaXP <= 0 {
		s := r.GetState()
		vp := s.Villagers[villagerID]
		if vp.Level <= 0 {
			vp.Level = 1
		}
		return vp, nil, s, nil
	}
	if maxLevel <= 0 {
		maxLevel = 10
	}
	if choicesPerLevel <= 0 {
		choicesPerLevel = 1
	}

	r.store.mu.Lock()
	defer r.store.mu.Unlock()

	us := r.userStateLocked()
	vp, ok := us.Villagers[villagerID]
	if !ok || vp.Level <= 0 {
		vp = VillagerProgress{Level: 1}
	}
	oldLevel := vp.Level
	vp.XP += deltaXP
	if vp.XP < 0 {
		vp.XP = 0
	}
	vp.Level = computeLevelFromThresholds(vp.XP, thresholds, maxLevel)
	if vp.Level < 1 {
		vp.Level = 1
	}

	newPerks := make([]string, 0)
	awardSlots := (vp.Level - oldLevel) * choicesPerLevel
	if awardSlots > 0 {
		owned := make(map[string]bool, len(vp.Perks))
		for _, p := range vp.Perks {
			owned[p] = true
		}
		for _, perkID := range perkPoolIDs {
			if awardSlots == 0 {
				break
			}
			perkID = strings.TrimSpace(perkID)
			if perkID == "" || owned[perkID] {
				continue
			}
			owned[perkID] = true
			vp.Perks = append(vp.Perks, perkID)
			newPerks = append(newPerks, perkID)
			awardSlots--
		}
	}

	us.Villagers[villagerID] = vp
	r.store.s.Users[r.userID] = us
	if err := r.store.saveLocked(); err != nil {
		return VillagerProgress{}, nil, UserState{}, err
	}
	return vp, newPerks, cloneUserState(us), nil
}

func computeLevelFromThresholds(xp int, thresholds map[int]int, maxLevel int) int {
	if maxLevel <= 0 {
		maxLevel = 10
	}
	level := 1
	if len(thresholds) == 0 {
		return level
	}
	levels := make([]int, 0, len(thresholds))
	for lv := range thresholds {
		levels = append(levels, lv)
	}
	sort.Ints(levels)
	for _, lv := range levels {
		req := thresholds[lv]
		if lv <= 0 {
			continue
		}
		if xp >= req && lv > level {
			level = lv
		}
	}
	if level > maxLevel {
		level = maxLevel
	}
	if level < 1 {
		level = 1
	}
	return level
}

func (r *FileRepo) BuildStateResponse() StateResponse {
	us := r.GetState()
	return StateResponse{
		Loot:            us.Loot,
		Unlocks:         us.Unlocks,
		VillagerStamina: us.VillagerStamina,
		Villagers:       us.Villagers,
		Metrics:         us.Metrics,
		DeckOpens:       us.DeckOpens,
		Costs:           defaultCosts(),
	}
}
