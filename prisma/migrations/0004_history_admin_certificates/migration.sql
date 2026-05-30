-- =============================================================================
-- 0004 — Admin role, CV history lifecycle, and the DRM certificate vault.
-- -----------------------------------------------------------------------------
-- Adds three capabilities:
--   1. users.role            — automated ADMIN clearance via Telegram ID.
--   2. public.cv_history     — versioned ledger of every CV a user builds,
--                              powering the History Hub + "Rewrite" flow.
--   3. public.certificates   — server-side vault for uploaded official
--                              credentials, surfaced only through the
--                              token-keyed DRM verification page.
-- Idempotent within a single transaction; mirrors the per-user RLS GUC model
-- established in 0001_init.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. ADMIN ROLE
-- ----------------------------------------------------------------------------
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS role VARCHAR(16) NOT NULL DEFAULT 'USER';

ALTER TABLE public.users
    DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
    ADD CONSTRAINT users_role_check CHECK (role IN ('USER', 'ADMIN'));

-- ----------------------------------------------------------------------------
-- 2. CV HISTORY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cv_history (
    id           BIGSERIAL   PRIMARY KEY,
    user_id      BIGINT      NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    cv_id        BIGINT      REFERENCES public.cvs(id) ON DELETE SET NULL,
    title        VARCHAR(200) NOT NULL,
    industry     VARCHAR(32)  NOT NULL,
    template_id  VARCHAR(64)  NOT NULL,
    payload      JSONB        NOT NULL,
    answers      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    styling      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT cv_history_payload_shape CHECK (
        jsonb_typeof(payload -> 'fullName')   = 'string'
        AND jsonb_typeof(payload -> 'experience') = 'array'
        AND jsonb_typeof(payload -> 'skills')     = 'array'
    )
);

CREATE INDEX IF NOT EXISTS cv_history_user_updated_idx
    ON public.cv_history (user_id, updated_at DESC);

-- ----------------------------------------------------------------------------
-- 3. CERTIFICATE VAULT
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.certificates (
    id           BIGSERIAL    PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    verify_token VARCHAR(64)  NOT NULL UNIQUE,
    kind         VARCHAR(24)  NOT NULL DEFAULT 'certificate',
    label        VARCHAR(160) NOT NULL,
    issuer       VARCHAR(200) NOT NULL DEFAULT 'ក្រសួងអប់រំ យុវជន និងកីឡា',
    mime_type    VARCHAR(80)  NOT NULL,
    file_data    TEXT         NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT certificates_token_pattern CHECK (verify_token ~ '^[A-Za-z0-9_-]{16,64}$'),
    CONSTRAINT certificates_kind_check CHECK (kind IN ('bac2', 'diploma', 'certificate', 'other'))
);

CREATE INDEX IF NOT EXISTS certificates_user_created_idx
    ON public.certificates (user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
-- cv_history follows the standard per-user GUC model from 0001_init.
ALTER TABLE public.cv_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cv_history_owner_all ON public.cv_history;
CREATE POLICY cv_history_owner_all ON public.cv_history
    FOR ALL USING (user_id = public.current_app_user_id())
    WITH CHECK (user_id = public.current_app_user_id());

-- certificates are reached from the PUBLIC, session-less verification page,
-- keyed exclusively by the unguessable verify_token. Like login_tokens, RLS is
-- disabled and access is constrained at the application layer (owner reads
-- filter by user_id; the verify page filters by verify_token only).
ALTER TABLE public.certificates DISABLE ROW LEVEL SECURITY;
