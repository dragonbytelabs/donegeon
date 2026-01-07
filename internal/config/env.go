package config

import (
	"os"
	"strconv"
)

// FromEnv loads balance configuration from environment variables
// Falls back to defaults if variables are not set
func FromEnv() Balance {
	cfg := Default()

	if val := getEnvInt("MAX_ZOMBIES_PER_DAY"); val > 0 {
		cfg.MaxZombiesPerDay = val
	}
	if val := getEnvInt("IMPORTANT_IGNORE_DAYS"); val > 0 {
		cfg.ImportantIgnoreDays = val
	}
	if val := getEnvInt("IMPORTANT_IGNORE_DAYS_FAST"); val > 0 {
		cfg.ImportantIgnoreDaysFast = val
	}
	if val := getEnvInt("LOOT_PENALTY_PER_ZOMBIE"); val >= 0 {
		cfg.LootPenaltyPerZombie = val
	}
	if val := getEnvInt("MAX_LOOT_PENALTY"); val >= 0 {
		cfg.MaxLootPenalty = val
	}
	if val := getEnvInt("PACK_COST_PER_ZOMBIE"); val >= 0 {
		cfg.PackCostPerZombie = val
	}
	if val := getEnvInt("MAX_PACK_COST"); val >= 0 {
		cfg.MaxPackCost = val
	}
	if val := getEnvInt("OVERRUN_THRESHOLD"); val > 0 {
		cfg.OverrunThreshold = val
	}
	if val := getEnvInt("TIRED_THRESHOLD"); val > 0 {
		cfg.TiredThreshold = val
	}
	if val := getEnvInt("DEFAULT_MAX_STAMINA"); val > 0 {
		cfg.DefaultMaxStamina = val
	}
	if val := getEnvInt("ZOMBIE_CLEAR_STAMINA"); val > 0 {
		cfg.ZombieClearStamina = val
	}

	// Support preset modes
	if mode := os.Getenv("DIFFICULTY"); mode != "" {
		switch mode {
		case "casual":
			return Casual()
		case "hard":
			return Hard()
		}
	}

	return cfg
}

func getEnvInt(key string) int {
	val := os.Getenv(key)
	if val == "" {
		return 0
	}
	num, err := strconv.Atoi(val)
	if err != nil {
		return 0
	}
	return num
}
