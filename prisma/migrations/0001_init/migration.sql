-- Production DDL for the Chrono-Gamified 3D CV Engine.
-- Target: PostgreSQL 14+ / Supabase. Idempotent within a single transaction.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- TABLE: users
-- One row per verified Telegram identity. The Telegram User ID is the immutable
-- natural key; everything else is profile metadata captured from the Login
-- Widget payload.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id              BIGSERIAL PRIMARY KEY,
    telegram_id     BIGINT      NOT NULL UNIQUE,
    username        VARCHAR(64),
    first_name      VARCHAR(128),
    last_name       VARCHAR(128),
    photo_url       VARCHAR(512),
    auth_date       TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_telegram_id_positive CHECK (telegram_id > 0),
    CONSTRAINT users_username_pattern CHECK (
        username IS NULL OR username ~ '^[A-Za-z0-9_]{3,64}$'
    )
);

CREATE INDEX IF NOT EXISTS users_username_idx ON public.users (username);

-- =============================================================================
-- TABLE: sessions
-- HttpOnly cookie-backed sessions. id is a v4 UUID stored as uuid; the cookie
-- carries id + an HMAC computed with SESSION_SECRET, so a stolen DB cannot mint
-- cookies without the signing key.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sessions (
    id              UUID        PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_agent      VARCHAR(512),
    ip_address      INET,

    CONSTRAINT sessions_expiry_future CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx   ON public.sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON public.sessions (expires_at);

-- =============================================================================
-- TABLE: cvs
-- Strictly validated CV payload (JSONB). Application-layer Zod schema is the
-- source of truth; we enforce the shape of the top-level keys at the DB layer
-- as a defence-in-depth check.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cvs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    template_id     VARCHAR(64) NOT NULL,
    payload         JSONB       NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT cvs_payload_shape CHECK (
        jsonb_typeof(payload -> 'profile')    = 'object'
        AND jsonb_typeof(payload -> 'experience') = 'array'
        AND jsonb_typeof(payload -> 'skills')     = 'array'
        AND jsonb_typeof(payload -> 'education')  = 'array'
    )
);

CREATE INDEX IF NOT EXISTS cvs_user_created_idx ON public.cvs (user_id, created_at DESC);

-- =============================================================================
-- TABLE: generations
-- One row per *completed* CV generation. The rolling 7-day rate limit reads
-- this table inside a SELECT ... FOR UPDATE block to prevent double-submit.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.generations (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    cv_id           BIGINT      UNIQUE REFERENCES public.cvs(id) ON DELETE SET NULL,
    template_id     VARCHAR(64) NOT NULL,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS generations_user_time_idx
    ON public.generations (user_id, generated_at DESC);

-- =============================================================================
-- TABLE: streaks
-- One row per user. Tracks the consecutive-day check-in counter. Days are
-- compared at UTC midnight boundaries (`DATE` type, no zone).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.streaks (
    user_id              BIGINT      PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    current_count        INTEGER     NOT NULL DEFAULT 0,
    last_check_in_date   DATE,
    longest_count        INTEGER     NOT NULL DEFAULT 0,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT streaks_current_nonneg CHECK (current_count >= 0),
    CONSTRAINT streaks_longest_nonneg CHECK (longest_count >= 0),
    CONSTRAINT streaks_longest_gte_current CHECK (longest_count >= current_count)
);

-- =============================================================================
-- TABLE: check_ins
-- Audit log of every accepted check-in. UNIQUE(user_id, check_in_date) is the
-- enforcement gate against duplicate same-day claims.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.check_ins (
    id              BIGSERIAL   PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    check_in_date   DATE        NOT NULL,
    count_after     INTEGER     NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT check_ins_count_after_positive CHECK (count_after > 0),
    CONSTRAINT check_ins_unique_per_day UNIQUE (user_id, check_in_date)
);

CREATE INDEX IF NOT EXISTS check_ins_user_date_idx
    ON public.check_ins (user_id, check_in_date DESC);

-- =============================================================================
-- TABLE: template_unlocks
-- Granted when current_count reaches 7. Composite PK guarantees idempotent
-- inserts (re-unlocking is a no-op).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.template_unlocks (
    user_id      BIGINT      NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    template_id  VARCHAR(64) NOT NULL,
    unlocked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, template_id)
);

-- =============================================================================
-- ROW LEVEL SECURITY
-- The application uses a service role (no RLS bypass) plus a per-request
-- `app.current_user_id` GUC that is SET LOCAL inside every transaction. RLS
-- policies compare against that GUC so a leaked connection cannot exfiltrate
-- rows belonging to other users.
--
-- To populate the GUC from the application:
--   SELECT set_config('app.current_user_id', $1::text, true);
-- =============================================================================

ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cvs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_unlocks ENABLE ROW LEVEL SECURITY;

-- Helper: returns the BIGINT user id currently bound to the session, or NULL.
CREATE OR REPLACE FUNCTION public.current_app_user_id() RETURNS BIGINT
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_raw TEXT := current_setting('app.current_user_id', true);
BEGIN
    IF v_raw IS NULL OR v_raw = '' THEN
        RETURN NULL;
    END IF;
    RETURN v_raw::BIGINT;
EXCEPTION WHEN others THEN
    RETURN NULL;
END;
$$;

-- users: a user can only see / update their own row.
DROP POLICY IF EXISTS users_select_self ON public.users;
CREATE POLICY users_select_self ON public.users
    FOR SELECT USING (id = public.current_app_user_id());

DROP POLICY IF EXISTS users_update_self ON public.users;
CREATE POLICY users_update_self ON public.users
    FOR UPDATE USING (id = public.current_app_user_id());

-- sessions: only the owning user can read; inserts/deletes are restricted
-- to the service role (which sets app.current_user_id during login/logout).
DROP POLICY IF EXISTS sessions_owner_select ON public.sessions;
CREATE POLICY sessions_owner_select ON public.sessions
    FOR SELECT USING (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS sessions_owner_delete ON public.sessions;
CREATE POLICY sessions_owner_delete ON public.sessions
    FOR DELETE USING (user_id = public.current_app_user_id());

-- cvs / generations / streaks / check_ins / template_unlocks: same per-user rule.
DROP POLICY IF EXISTS cvs_owner_all ON public.cvs;
CREATE POLICY cvs_owner_all ON public.cvs
    FOR ALL USING (user_id = public.current_app_user_id())
    WITH CHECK (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS generations_owner_all ON public.generations;
CREATE POLICY generations_owner_all ON public.generations
    FOR ALL USING (user_id = public.current_app_user_id())
    WITH CHECK (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS streaks_owner_all ON public.streaks;
CREATE POLICY streaks_owner_all ON public.streaks
    FOR ALL USING (user_id = public.current_app_user_id())
    WITH CHECK (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS check_ins_owner_all ON public.check_ins;
CREATE POLICY check_ins_owner_all ON public.check_ins
    FOR ALL USING (user_id = public.current_app_user_id())
    WITH CHECK (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS template_unlocks_owner_all ON public.template_unlocks;
CREATE POLICY template_unlocks_owner_all ON public.template_unlocks
    FOR ALL USING (user_id = public.current_app_user_id())
    WITH CHECK (user_id = public.current_app_user_id());
