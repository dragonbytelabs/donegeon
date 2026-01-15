# Testing Guide

This document explains how to run tests and simulations for Donegeon.

## Running Tests

### Unit Tests

Run all tests:
```bash
go test ./...
```

Run specific test:
```bash
go test ./internal/game -v -run Test30DaySimulation
```

### Golden Tests (Critical Invariants)

These tests verify core game mechanics that must always work:

```bash
# Test day tick is deterministic
go test ./internal/game -v -run TestDayTickDeterministic

# Test zombie spawn cap is respected
go test ./internal/game -v -run TestZombieSpawnCap

# Test recurring tasks spawn correctly
go test ./internal/game -v -run TestRecurrenceSpawn

# Test loot drops are stable
go test ./internal/game -v -run TestLootDropTableStable

# Test deck draws are consistent
go test ./internal/game -v -run TestDeckDrawPersistenceStable
```

## 30-Day Simulation

### Running the Simulation

The simulation runner allows you to test game balance over 30 days:

```bash
# Build the simulator
go build -o simulate ./cmd/simulate

# Run default 30-day simulation
./simulate

# Customize player behavior
./simulate -days 30 -completion 0.6 -zombie-clear 0.5 -deck-open 0.3

# Test different difficulty scenarios
./simulate -days 30 -completion 0.3  # Passive player
./simulate -days 30 -completion 0.9  # Very active player
```

## 30-Day API Simulation (real /api/* routes, NDJSON log)

This is the most “game-realistic” headless run: it drives the actual HTTP routes using `httptest`
and produces an **NDJSON event log** you can inspect (tasks/quests/zombies/decks/loot).

```bash
# Build the API simulator
go build -o simulate_api ./cmd/simulate_api

# Run a deterministic 30-day run (writes to sim_runs/<run_id>.ndjson by default)
./simulate_api -days 30 -seed 1337 -decision-seed 7331 -start-day 2026-01-01

# Customize behavior
./simulate_api -days 30 -tasks-max 3 -p-deadline 0.5 -p-recurring 0.3 -p-open-deck 0.6 -p-clear-zombie 0.8

# Write to a specific output file
./simulate_api -days 30 -out sim_runs/my_run.ndjson
```

### Reading the NDJSON log

Each line is a JSON object containing:
- `run_id`, `day_index`, `day`
- `event_type` (task_created, day_tick, zombie_spawned, quest_snapshot, loot_delta, etc.)
- `payload` (event-specific data)

### Simulation Parameters

- `-days`: Number of days to simulate (default: 30)
- `-completion`: Task completion rate 0.0-1.0 (default: 0.6 = 60%)
- `-zombie-clear`: Zombie clearing rate 0.0-1.0 (default: 0.5 = 50%)
- `-deck-open`: Deck opening rate 0.0-1.0 (default: 0.3 = 30%)

### What the Simulation Tests

The simulation verifies:

1. **Economy Balance**: Player can afford decks and doesn't run out of resources
2. **Zombie Pressure**: Zombie spawn rate is manageable with good task completion
3. **Game Stability**: No crashes or infinite loops over 30 days
4. **Invariants**: 
   - Zombies never exceed daily cap
   - Recurring tasks spawn correctly
   - Loot drops are consistent
   - Deck draws work properly

### Expected Results

With default settings (60% completion rate):
- Average zombies/day should be < 2
- Player should earn coins consistently
- No overrun days should occur
- Max zombies in a day should be ≤ 5 (the cap)

## Test Coverage

Current test files:
- `internal/game/simulation_test.go` - 30-day simulation and golden tests
- `internal/task/task_test.go` - Task creation and management
- `internal/deck/deck_test.go` - Deck opening and costs
- `internal/game/loot_test.go` - Loot drop mechanics
- `internal/game/state_test.go` - Game state management

## Continuous Integration

To run all tests in CI:

```bash
go test ./... -v -cover
```

## Debugging Failed Tests

If a test fails:

1. Run with verbose output: `go test -v -run TestName`
2. Check simulation stats for anomalies
3. Verify config values match expectations
4. Check for race conditions in concurrent tests

## Adding New Tests

When adding new game mechanics:

1. Add a unit test for the specific mechanic
2. Add a golden test if it's a critical invariant
3. Update the simulation if it affects long-term balance
4. Document expected behavior in test comments
