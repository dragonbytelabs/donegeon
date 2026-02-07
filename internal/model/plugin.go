package model

import "time"

type PluginID string

type PluginSource string

const (
	PluginSourceCore      PluginSource = "core"
	PluginSourceCommunity PluginSource = "community"
)

type PluginManifest struct {
	ID           PluginID     `json:"id"`
	Name         string       `json:"name"`
	Description  string       `json:"description"`
	Provider     string       `json:"provider"`
	Category     string       `json:"category"`
	Version      string       `json:"version"`
	CardDefID    string       `json:"cardDefId"`
	CardTitle    string       `json:"cardTitle"`
	CardIcon     string       `json:"cardIcon"`
	InstallCost  int          `json:"installCost"`
	Capabilities []string     `json:"capabilities,omitempty"`
	Source       PluginSource `json:"source"`
	CreatedAt    time.Time    `json:"createdAt"`
	UpdatedAt    time.Time    `json:"updatedAt"`
}

type InstalledPlugin struct {
	PluginID    PluginID     `json:"pluginId"`
	Source      PluginSource `json:"source"`
	InstalledAt time.Time    `json:"installedAt"`
	Enabled     bool         `json:"enabled"`
}

type PluginMarketplaceItem struct {
	PluginManifest
	Installed bool `json:"installed"`
}

type InstalledPluginDetail struct {
	PluginManifest
	InstalledAt time.Time `json:"installedAt"`
	Enabled     bool      `json:"enabled"`
}
