package auth

import "time"

type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"createdAt"`
}

type OTPChallenge struct {
	Email       string    `json:"email"`
	CodeHash    string    `json:"codeHash"`
	ExpiresAt   time.Time `json:"expiresAt"`
	RequestedAt time.Time `json:"requestedAt"`
	Attempts    int       `json:"attempts"`
}

type Session struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	TokenHash string    `json:"tokenHash"`
	CreatedAt time.Time `json:"createdAt"`
	LastSeen  time.Time `json:"lastSeen"`
	ExpiresAt time.Time `json:"expiresAt"`
}
