package plugin

import (
	"errors"
	"sort"
	"strings"
	"time"
	"unicode"

	"donegeon/internal/model"
)

var (
	ErrPluginNotFound       = errors.New("plugin not found")
	ErrPluginInvalid        = errors.New("plugin manifest invalid")
	ErrPluginIDConflict     = errors.New("plugin id already exists")
	ErrPluginMissingID      = errors.New("plugin id is required")
	ErrPluginMissingName    = errors.New("plugin name is required")
	ErrPluginMissingCardDef = errors.New("plugin card def id is required")
)

type Repo interface {
	ListMarketplace() ([]model.PluginManifest, error)
	ListInstalled() ([]model.InstalledPlugin, error)
	GetMarketplace(id model.PluginID) (model.PluginManifest, error)
	IsInstalled(id model.PluginID) (bool, error)
	Register(manifest model.PluginManifest) (model.PluginManifest, error)
	Install(id model.PluginID) (already bool, install model.InstalledPlugin, manifest model.PluginManifest, err error)
	Uninstall(id model.PluginID) (removed bool, err error)
}

func normalizeManifest(m *model.PluginManifest) {
	m.ID = model.PluginID(slugify(string(m.ID)))
	m.Name = strings.TrimSpace(m.Name)
	m.Description = strings.TrimSpace(m.Description)
	m.Provider = strings.TrimSpace(m.Provider)
	m.Category = strings.TrimSpace(strings.ToLower(m.Category))
	m.Version = strings.TrimSpace(m.Version)
	if m.Version == "" {
		m.Version = "1.0.0"
	}
	if m.Provider == "" {
		m.Provider = "community"
	}
	if m.CardTitle == "" {
		m.CardTitle = m.Name
	}
	m.CardTitle = strings.TrimSpace(m.CardTitle)
	if m.CardIcon == "" {
		m.CardIcon = "🔌"
	}
	if m.CardDefID == "" && m.ID != "" {
		m.CardDefID = "mod.plugin_" + slugify(string(m.ID))
	}
	m.CardDefID = strings.TrimSpace(strings.ToLower(m.CardDefID))
	if m.InstallCost < 0 {
		m.InstallCost = 0
	}
	if m.Source == "" {
		m.Source = model.PluginSourceCommunity
	}
	if m.Source != model.PluginSourceCore && m.Source != model.PluginSourceCommunity {
		m.Source = model.PluginSourceCommunity
	}

	caps := make([]string, 0, len(m.Capabilities))
	seen := map[string]bool{}
	for _, c := range m.Capabilities {
		c = strings.TrimSpace(strings.ToLower(c))
		if c == "" || seen[c] {
			continue
		}
		seen[c] = true
		caps = append(caps, c)
	}
	sort.Strings(caps)
	m.Capabilities = caps

	now := time.Now().UTC()
	if m.CreatedAt.IsZero() {
		m.CreatedAt = now
	}
	m.CreatedAt = m.CreatedAt.UTC()
	m.UpdatedAt = now
}

func validateManifest(m model.PluginManifest) error {
	if strings.TrimSpace(string(m.ID)) == "" {
		return ErrPluginMissingID
	}
	if strings.TrimSpace(m.Name) == "" {
		return ErrPluginMissingName
	}
	if strings.TrimSpace(m.CardDefID) == "" {
		return ErrPluginMissingCardDef
	}
	if !strings.HasPrefix(strings.ToLower(m.CardDefID), "mod.plugin_") {
		return ErrPluginInvalid
	}
	return nil
}

func defaultCorePlugins() []model.PluginManifest {
	now := time.Now().UTC()
	return []model.PluginManifest{
		{
			ID:          "google_calendar",
			Name:        "Google Calendar",
			Description: "Sync deadline and recurrence cards to Google Calendar events.",
			Provider:    "Google",
			Category:    "calendar",
			Version:     "1.0.0",
			CardDefID:   "mod.plugin_google_calendar",
			CardTitle:   "Google Calendar Link",
			CardIcon:    "📅",
			InstallCost: 4,
			Capabilities: []string{
				"calendar.create_event",
				"calendar.update_event",
			},
			Source:    model.PluginSourceCore,
			CreatedAt: now,
			UpdatedAt: now,
		},
		{
			ID:          "apple_calendar",
			Name:        "Apple Calendar",
			Description: "Create due date and recurring events in Apple Calendar.",
			Provider:    "Apple",
			Category:    "calendar",
			Version:     "1.0.0",
			CardDefID:   "mod.plugin_apple_calendar",
			CardTitle:   "Apple Calendar Link",
			CardIcon:    "🍎",
			InstallCost: 4,
			Capabilities: []string{
				"calendar.create_event",
				"calendar.update_event",
			},
			Source:    model.PluginSourceCore,
			CreatedAt: now,
			UpdatedAt: now,
		},
		{
			ID:          "notion",
			Name:        "Notion",
			Description: "Send task updates to Notion databases.",
			Provider:    "Notion",
			Category:    "knowledge",
			Version:     "1.0.0",
			CardDefID:   "mod.plugin_notion",
			CardTitle:   "Notion Sync",
			CardIcon:    "🧠",
			InstallCost: 5,
			Capabilities: []string{
				"task.sync",
				"task.comment",
			},
			Source:    model.PluginSourceCore,
			CreatedAt: now,
			UpdatedAt: now,
		},
		{
			ID:          "todoist",
			Name:        "Todoist",
			Description: "Mirror Donegeon tasks into Todoist projects.",
			Provider:    "Doist",
			Category:    "task_manager",
			Version:     "1.0.0",
			CardDefID:   "mod.plugin_todoist",
			CardTitle:   "Todoist Sync",
			CardIcon:    "✅",
			InstallCost: 5,
			Capabilities: []string{
				"task.sync",
				"task.complete",
			},
			Source:    model.PluginSourceCore,
			CreatedAt: now,
			UpdatedAt: now,
		},
		{
			ID:          "jira",
			Name:        "Jira",
			Description: "Link tasks to Jira issues and status updates.",
			Provider:    "Atlassian",
			Category:    "work",
			Version:     "1.0.0",
			CardDefID:   "mod.plugin_jira",
			CardTitle:   "Jira Connector",
			CardIcon:    "🧩",
			InstallCost: 6,
			Capabilities: []string{
				"issue.link",
				"issue.transition",
			},
			Source:    model.PluginSourceCore,
			CreatedAt: now,
			UpdatedAt: now,
		},
		{
			ID:          "zapier",
			Name:        "Zapier",
			Description: "Trigger external automations from task events.",
			Provider:    "Zapier",
			Category:    "automation",
			Version:     "1.0.0",
			CardDefID:   "mod.plugin_zapier",
			CardTitle:   "Zap Trigger",
			CardIcon:    "⚡",
			InstallCost: 7,
			Capabilities: []string{
				"webhook.emit",
				"automation.trigger",
			},
			Source:    model.PluginSourceCore,
			CreatedAt: now,
			UpdatedAt: now,
		},
	}
}

func slugify(s string) string {
	s = strings.TrimSpace(strings.ToLower(s))
	if s == "" {
		return ""
	}
	var b strings.Builder
	prevSep := false
	for _, r := range s {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			b.WriteRune(r)
			prevSep = false
		case r == '_' || r == '-' || unicode.IsSpace(r):
			if !prevSep && b.Len() > 0 {
				b.WriteByte('_')
				prevSep = true
			}
		default:
			if !prevSep && b.Len() > 0 {
				b.WriteByte('_')
				prevSep = true
			}
		}
	}
	out := strings.Trim(b.String(), "_")
	if out == "" {
		return "plugin"
	}
	return out
}
