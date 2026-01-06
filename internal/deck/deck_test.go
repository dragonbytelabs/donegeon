package deck

import (
	"testing"
)

func TestDeckOpen(t *testing.T) {
	t.Run("FirstDay deck opens with correct drops", func(t *testing.T) {
		def := Definitions[TypeFirstDay]
		drops := def.Open()

		if len(drops) < 3 || len(drops) > 5 {
			t.Errorf("expected 3-5 drops, got %d", len(drops))
		}
	})
}

func TestDeckCost(t *testing.T) {
	t.Run("FirstDay deck is free for first 5 opens", func(t *testing.T) {
		deck := Deck{
			Type:        TypeFirstDay,
			BaseCost:    0,
			TimesOpened: 3,
		}

		cost := deck.GetCost(0)
		if cost != 0 {
			t.Errorf("expected cost 0 for first 5 opens, got %d", cost)
		}

		deck.TimesOpened = 5
		cost = deck.GetCost(0)
		if cost != 1 {
			t.Errorf("expected cost 1 after 5 opens, got %d", cost)
		}
	})

	t.Run("Pack cost penalty applies correctly", func(t *testing.T) {
		deck := Deck{
			Type:        TypeOrganization,
			BaseCost:    2,
			TimesOpened: 10,
		}

		cost := deck.GetCost(0)
		if cost != 2 {
			t.Errorf("expected cost 2 with no penalty, got %d", cost)
		}

		cost = deck.GetCost(50)
		expected := 2 + (2 * 50 / 100)
		if cost != expected {
			t.Errorf("expected cost %d with 50%% penalty, got %d", expected, cost)
		}
	})
}
