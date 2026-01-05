package quest

// RewardKind defines the type of reward
type RewardKind string

const (
RewardCurrency  RewardKind = "currency"
RewardCard      RewardKind = "card"
RewardXP        RewardKind = "xp"
RewardRollTable RewardKind = "roll_table"
)

// CardType defines what kind of card to grant
type CardType string

const (
CardBlankTask          CardType = "blank_task"
CardVillager           CardType = "villager"
CardCoin               CardType = "coin"
CardModifier           CardType = "modifier"
CardRecurring          CardType = "recurring_contract"
CardDeadline           CardType = "deadline_pin"
CardImportance         CardType = "importance_seal"
CardSchedule           CardType = "schedule_token"
CardInk                CardType = "ink"
CardPaper              CardType = "paper"
CardGear               CardType = "gear"
CardParts              CardType = "parts"
CardBlueprintShard     CardType = "blueprint_shard"
)

// Reward represents something granted for completing a quest
type Reward struct {
	Kind      RewardKind `json:"kind"`
	Currency  string     `json:"currency,omitempty"` // "coin"
	Amount    int        `json:"amount,omitempty"`
	CardType  CardType   `json:"card_type,omitempty"`
	CardCount int        `json:"card_count,omitempty"`
	TableID   string     `json:"table_id,omitempty"`
	XP        int        `json:"xp,omitempty"`
}

// Unlock represents a new feature or system unlocked
type Unlock struct {
	ID   string `json:"id"`
	Kind string `json:"kind"` // "deck", "zone", "building", "system_feature"
}
