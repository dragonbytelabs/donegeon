package auth

import "context"

type ctxKey string

const (
	userContextKey    ctxKey = "donegeon.auth.user"
	sessionContextKey ctxKey = "donegeon.auth.session"
)

func withUserContext(ctx context.Context, u User) context.Context {
	return context.WithValue(ctx, userContextKey, u)
}

func withSessionContext(ctx context.Context, s Session) context.Context {
	return context.WithValue(ctx, sessionContextKey, s)
}

func UserFromContext(ctx context.Context) (User, bool) {
	v := ctx.Value(userContextKey)
	u, ok := v.(User)
	return u, ok
}

func SessionFromContext(ctx context.Context) (Session, bool) {
	v := ctx.Value(sessionContextKey)
	s, ok := v.(Session)
	return s, ok
}
