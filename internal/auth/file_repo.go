package auth

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type state struct {
	UsersByID            map[string]User         `json:"usersById"`
	UserIDByEmail        map[string]string       `json:"userIdByEmail"`
	ChallengesByEmail    map[string]OTPChallenge `json:"challengesByEmail"`
	SessionsByID         map[string]Session      `json:"sessionsById"`
	SessionIDByTokenHash map[string]string       `json:"sessionIdByTokenHash"`
}

func newState() state {
	return state{
		UsersByID:            map[string]User{},
		UserIDByEmail:        map[string]string{},
		ChallengesByEmail:    map[string]OTPChallenge{},
		SessionsByID:         map[string]Session{},
		SessionIDByTokenHash: map[string]string{},
	}
}

type FileRepo struct {
	mu   sync.RWMutex
	path string
	s    state
}

func NewFileRepo(dataDir string) (*FileRepo, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}
	r := &FileRepo{
		path: filepath.Join(dataDir, "auth.json"),
		s:    newState(),
	}
	if err := r.load(); err != nil {
		return nil, err
	}
	return r, nil
}

func (r *FileRepo) load() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	b, err := os.ReadFile(r.path)
	if err != nil {
		if os.IsNotExist(err) {
			r.s = newState()
			return nil
		}
		return err
	}
	var loaded state
	if err := json.Unmarshal(b, &loaded); err != nil {
		return err
	}
	if loaded.UsersByID == nil {
		loaded.UsersByID = map[string]User{}
	}
	if loaded.UserIDByEmail == nil {
		loaded.UserIDByEmail = map[string]string{}
	}
	if loaded.ChallengesByEmail == nil {
		loaded.ChallengesByEmail = map[string]OTPChallenge{}
	}
	if loaded.SessionsByID == nil {
		loaded.SessionsByID = map[string]Session{}
	}
	if loaded.SessionIDByTokenHash == nil {
		loaded.SessionIDByTokenHash = map[string]string{}
	}
	r.s = loaded
	return nil
}

func (r *FileRepo) saveLocked() error {
	b, err := json.MarshalIndent(r.s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(r.path, b, 0o644)
}

func newID(prefix string) string {
	var b [8]byte
	_, _ = rand.Read(b[:])
	return prefix + "_" + hex.EncodeToString(b[:])
}

func (r *FileRepo) GetOrCreateUser(email string, now time.Time) (User, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if id, ok := r.s.UserIDByEmail[email]; ok {
		if u, ok := r.s.UsersByID[id]; ok {
			return u, false, nil
		}
	}

	u := User{
		ID:        newID("usr"),
		Email:     email,
		CreatedAt: now,
	}
	r.s.UsersByID[u.ID] = u
	r.s.UserIDByEmail[email] = u.ID
	if err := r.saveLocked(); err != nil {
		return User{}, false, err
	}
	return u, true, nil
}

func (r *FileRepo) GetUserByID(id string) (User, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	u, ok := r.s.UsersByID[id]
	return u, ok
}

func (r *FileRepo) PutChallenge(ch OTPChallenge) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.s.ChallengesByEmail[ch.Email] = ch
	return r.saveLocked()
}

func (r *FileRepo) GetChallenge(email string) (OTPChallenge, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	ch, ok := r.s.ChallengesByEmail[email]
	return ch, ok
}

func (r *FileRepo) DeleteChallenge(email string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.s.ChallengesByEmail, email)
	return r.saveLocked()
}

func (r *FileRepo) CreateSession(s Session) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.s.SessionsByID[s.ID] = s
	r.s.SessionIDByTokenHash[s.TokenHash] = s.ID
	return r.saveLocked()
}

func (r *FileRepo) GetSessionByTokenHash(tokenHash string) (Session, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	id, ok := r.s.SessionIDByTokenHash[tokenHash]
	if !ok {
		return Session{}, false
	}
	s, ok := r.s.SessionsByID[id]
	return s, ok
}

func (r *FileRepo) DeleteSessionByID(sessionID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	s, ok := r.s.SessionsByID[sessionID]
	if !ok {
		return nil
	}
	delete(r.s.SessionsByID, sessionID)
	delete(r.s.SessionIDByTokenHash, s.TokenHash)
	return r.saveLocked()
}

func (r *FileRepo) DeleteSessionByTokenHash(tokenHash string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	id, ok := r.s.SessionIDByTokenHash[tokenHash]
	if !ok {
		return nil
	}
	delete(r.s.SessionIDByTokenHash, tokenHash)
	delete(r.s.SessionsByID, id)
	return r.saveLocked()
}

func (r *FileRepo) TouchSession(sessionID string, lastSeen time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	s, ok := r.s.SessionsByID[sessionID]
	if !ok {
		return nil
	}
	s.LastSeen = lastSeen
	r.s.SessionsByID[sessionID] = s
	return r.saveLocked()
}
