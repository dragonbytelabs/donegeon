package player

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOnboardingAndTeamEndpoints(t *testing.T) {
	repo, err := NewFileRepo(t.TempDir())
	if err != nil {
		t.Fatalf("new repo: %v", err)
	}
	repo = repo.ForUser("u-onboarding")

	h := NewHandler()
	h.SetRepoResolver(func(_ *http.Request) *FileRepo { return repo })

	stateRec := httptest.NewRecorder()
	h.State(stateRec, httptest.NewRequest(http.MethodGet, "/api/player/state", nil))
	if stateRec.Code != http.StatusOK {
		t.Fatalf("state expected 200, got %d", stateRec.Code)
	}

	completeBody := map[string]any{
		"displayName": "Tester",
		"avatar":      "🧙",
		"teamName":    "Tester Team",
		"teamAvatar":  "🏰",
	}
	completeRec := httptest.NewRecorder()
	h.CompleteOnboarding(completeRec, jsonReq(http.MethodPost, "/api/player/onboarding/complete", completeBody))
	if completeRec.Code != http.StatusOK {
		t.Fatalf("complete onboarding expected 200, got %d body=%s", completeRec.Code, completeRec.Body.String())
	}

	profileRec := httptest.NewRecorder()
	h.Profile(profileRec, httptest.NewRequest(http.MethodGet, "/api/player/profile", nil))
	if profileRec.Code != http.StatusOK {
		t.Fatalf("profile expected 200, got %d", profileRec.Code)
	}
	var profileOut struct {
		Profile PlayerProfile `json:"profile"`
	}
	if err := json.NewDecoder(profileRec.Body).Decode(&profileOut); err != nil {
		t.Fatalf("decode profile: %v", err)
	}
	if !profileOut.Profile.OnboardingCompleted {
		t.Fatalf("expected onboarding completed")
	}
	if profileOut.Profile.Team.Name != "Tester Team" {
		t.Fatalf("expected team name Tester Team, got %q", profileOut.Profile.Team.Name)
	}

	inviteRec := httptest.NewRecorder()
	h.TeamInvite(inviteRec, jsonReq(http.MethodPost, "/api/player/team/invite", map[string]any{"email": "ally@example.com"}))
	if inviteRec.Code != http.StatusOK {
		t.Fatalf("invite expected 200, got %d body=%s", inviteRec.Code, inviteRec.Body.String())
	}

	teamRec := httptest.NewRecorder()
	h.Team(teamRec, jsonReq(http.MethodPatch, "/api/player/team", map[string]any{"name": "Renamed Team", "avatar": "⚔️"}))
	if teamRec.Code != http.StatusOK {
		t.Fatalf("team patch expected 200, got %d body=%s", teamRec.Code, teamRec.Body.String())
	}

	profileRec = httptest.NewRecorder()
	h.Profile(profileRec, httptest.NewRequest(http.MethodGet, "/api/player/profile", nil))
	if profileRec.Code != http.StatusOK {
		t.Fatalf("profile expected 200, got %d", profileRec.Code)
	}
	if err := json.NewDecoder(profileRec.Body).Decode(&profileOut); err != nil {
		t.Fatalf("decode profile2: %v", err)
	}
	if profileOut.Profile.Team.Name != "Renamed Team" {
		t.Fatalf("expected renamed team, got %q", profileOut.Profile.Team.Name)
	}
	if len(profileOut.Profile.Team.Members) != 1 {
		t.Fatalf("expected 1 team member invite, got %d", len(profileOut.Profile.Team.Members))
	}
}

func jsonReq(method, path string, body any) *http.Request {
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(method, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	return req
}
