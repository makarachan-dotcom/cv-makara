-- Pending login tokens for the bot deep-link auth flow.
-- A row is created by /api/auth/init in PENDING state, transitioned to
-- AUTHENTICATED by the /api/telegram/webhook handler once the user taps
-- /start on the bot, and finally to CONSUMED by /api/auth/poll once the
-- browser exchanges the token for a session cookie.

CREATE TABLE IF NOT EXISTS public.login_tokens (
    token         VARCHAR(64) PRIMARY KEY,
    status        VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    telegram_id   BIGINT,
    username      VARCHAR(64),
    first_name    VARCHAR(128),
    last_name     VARCHAR(128),
    photo_url     VARCHAR(512),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    authed_at     TIMESTAMPTZ,
    consumed_at   TIMESTAMPTZ,
    expires_at    TIMESTAMPTZ NOT NULL,

    CONSTRAINT login_tokens_status_check CHECK (
        status IN ('PENDING','AUTHENTICATED','CONSUMED','EXPIRED')
    ),
    CONSTRAINT login_tokens_token_pattern CHECK (token ~ '^[A-Za-z0-9_-]{16,64}$')
);

CREATE INDEX IF NOT EXISTS login_tokens_expires_at_idx
    ON public.login_tokens (expires_at);

CREATE INDEX IF NOT EXISTS login_tokens_status_telegram_id_idx
    ON public.login_tokens (status, telegram_id);

-- login_tokens are accessed exclusively from server routes using the application
-- service role; there is no user context (the row exists before the user is
-- known). Keep RLS disabled but lock to the schema owner role.
ALTER TABLE public.login_tokens DISABLE ROW LEVEL SECURITY;
