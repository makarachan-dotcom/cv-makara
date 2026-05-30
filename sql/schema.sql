-- =============================================================================
-- Gamified 3D CV Builder — Complete Production Schema
-- Target: PostgreSQL 14+ / Supabase.
--
-- This file is the canonical, self-contained DDL for the spec'd architecture:
--   * Telegram User ID is the natural primary key for users.
--   * Deep-linked Telegram bot authentication is tracked in auth_sessions.
--   * 20 seeded 3D templates (2 unlocked, 18 locked).
--   * cv_metadata stores ATS-structured content AND live 3D canvas mutations.
--   * check_in_streaks tracks a 7-day consecutive streak at UTC midnight.
--   * ai_generation_logs backs the rolling 2-per-7-day rate limiter.
--
-- It is idempotent: re-running it will not error on existing objects.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Shared trigger: keep updated_at in sync on every UPDATE.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

-- =============================================================================
-- TABLE: users
-- One row per verified Telegram identity. The Telegram User ID is the immutable
-- natural primary key (BIGINT, never re-issued by Telegram).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    telegram_user_id    BIGINT       PRIMARY KEY,
    username            VARCHAR(64),
    first_name          VARCHAR(128) NOT NULL,
    last_name           VARCHAR(128),
    photo_url           VARCHAR(512),
    language_code       VARCHAR(16),
    is_premium          BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_login_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT users_telegram_id_positive CHECK (telegram_user_id > 0),
    CONSTRAINT users_username_pattern CHECK (
        username IS NULL OR username ~ '^[A-Za-z0-9_]{3,64}$'
    ),
    CONSTRAINT users_photo_url_scheme CHECK (
        photo_url IS NULL OR photo_url ~ '^https://'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uidx
    ON public.users (LOWER(username))
    WHERE username IS NOT NULL;

DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- TABLE: auth_sessions
-- Deep-link authentication handshake state. The site mints a `session_token`
-- (status='pending'), opens t.me/<bot>?start=<session_token>, the bot binds the
-- verified Telegram ID (status='authenticated'), and the browser polls until it
-- flips. Expired tokens are swept to status='expired'.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.auth_sessions (
    session_token       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id    BIGINT       REFERENCES public.users(telegram_user_id) ON DELETE CASCADE,
    status              VARCHAR(16)  NOT NULL DEFAULT 'pending',
    ip_address          INET,
    user_agent          VARCHAR(512),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    authenticated_at    TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),

    CONSTRAINT auth_sessions_status_enum
        CHECK (status IN ('pending', 'authenticated', 'expired')),
    CONSTRAINT auth_sessions_expiry_future
        CHECK (expires_at > created_at),
    -- An authenticated session MUST carry a bound Telegram ID and timestamp;
    -- a pending session MUST NOT.
    CONSTRAINT auth_sessions_authenticated_shape CHECK (
        (status = 'authenticated' AND telegram_user_id IS NOT NULL AND authenticated_at IS NOT NULL)
        OR (status <> 'authenticated')
    )
);

CREATE INDEX IF NOT EXISTS auth_sessions_status_idx
    ON public.auth_sessions (status);
CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx
    ON public.auth_sessions (expires_at);
CREATE INDEX IF NOT EXISTS auth_sessions_user_idx
    ON public.auth_sessions (telegram_user_id);

-- =============================================================================
-- TABLE: templates
-- Catalog of 20 unique 3D visual styles. `is_locked` is the DEFAULT lock state
-- for a brand-new user; per-user unlocks (granted by the 7-day streak) live in
-- `template_unlocks`. Exactly 2 rows seed unlocked, 18 seed locked.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.templates (
    id                  VARCHAR(64)  PRIMARY KEY,
    name                VARCHAR(128) NOT NULL,
    category            VARCHAR(64)  NOT NULL,
    description         TEXT         NOT NULL,
    is_locked           BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order          INTEGER      NOT NULL,
    default_canvas      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT templates_id_slug CHECK (id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT templates_sort_order_unique UNIQUE (sort_order)
);

CREATE INDEX IF NOT EXISTS templates_is_locked_idx
    ON public.templates (is_locked);
CREATE INDEX IF NOT EXISTS templates_category_idx
    ON public.templates (category);

DROP TRIGGER IF EXISTS templates_set_updated_at ON public.templates;
CREATE TRIGGER templates_set_updated_at
    BEFORE UPDATE ON public.templates
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- TABLE: template_unlocks
-- Per-user unlock grants. Composite PK makes re-unlocking an idempotent no-op.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.template_unlocks (
    telegram_user_id    BIGINT       NOT NULL REFERENCES public.users(telegram_user_id) ON DELETE CASCADE,
    template_id         VARCHAR(64)  NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
    unlocked_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    PRIMARY KEY (telegram_user_id, template_id)
);

-- =============================================================================
-- TABLE: cv_metadata
-- One CV document per (user, template). Two JSONB domains:
--   * ATS content: profile / experience (each with a 5-bullet achievements
--     array) / skills (with proficiency scores) / education / projects.
--   * canvas: live 3D mutations — hex colors, material roughness, light
--     intensity, typography scale — applied to the WebGL scene in real time.
-- DB-layer CHECK constraints enforce the top-level JSONB shape as defence in
-- depth; the application Zod schema remains the source of truth.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cv_metadata (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id    BIGINT       NOT NULL REFERENCES public.users(telegram_user_id) ON DELETE CASCADE,
    template_id         VARCHAR(64)  NOT NULL REFERENCES public.templates(id),
    title               VARCHAR(160) NOT NULL DEFAULT 'Untitled CV',

    profile             JSONB        NOT NULL DEFAULT '{}'::jsonb,
    experience          JSONB        NOT NULL DEFAULT '[]'::jsonb,
    skills              JSONB        NOT NULL DEFAULT '[]'::jsonb,
    education           JSONB        NOT NULL DEFAULT '[]'::jsonb,
    projects            JSONB        NOT NULL DEFAULT '[]'::jsonb,

    -- Real-time 3D canvas mutations bound to the React Three Fiber scene.
    canvas              JSONB        NOT NULL DEFAULT jsonb_build_object(
                            'palette', jsonb_build_object(
                                'primary',   '#22d3ee',
                                'secondary', '#8b5cf6',
                                'accent',    '#facc15',
                                'background','#05060a'
                            ),
                            'material', jsonb_build_object(
                                'roughness', 0.35,
                                'metalness', 0.65
                            ),
                            'lighting', jsonb_build_object(
                                'ambientIntensity',     0.6,
                                'directionalIntensity', 1.8
                            ),
                            'typography', jsonb_build_object('scale', 1.0)
                        ),

    is_published        BOOLEAN      NOT NULL DEFAULT FALSE,
    published_slug      VARCHAR(80)  UNIQUE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT cv_metadata_profile_object   CHECK (jsonb_typeof(profile)    = 'object'),
    CONSTRAINT cv_metadata_experience_array CHECK (jsonb_typeof(experience) = 'array'),
    CONSTRAINT cv_metadata_skills_array     CHECK (jsonb_typeof(skills)     = 'array'),
    CONSTRAINT cv_metadata_education_array  CHECK (jsonb_typeof(education)  = 'array'),
    CONSTRAINT cv_metadata_projects_array   CHECK (jsonb_typeof(projects)   = 'array'),
    CONSTRAINT cv_metadata_canvas_object    CHECK (jsonb_typeof(canvas)     = 'object'),
    CONSTRAINT cv_metadata_user_template_unique UNIQUE (telegram_user_id, template_id)
);

CREATE INDEX IF NOT EXISTS cv_metadata_user_idx
    ON public.cv_metadata (telegram_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS cv_metadata_template_idx
    ON public.cv_metadata (template_id);
-- GIN index for ad-hoc querying inside the structured content blobs.
CREATE INDEX IF NOT EXISTS cv_metadata_skills_gin
    ON public.cv_metadata USING GIN (skills jsonb_path_ops);

DROP TRIGGER IF EXISTS cv_metadata_set_updated_at ON public.cv_metadata;
CREATE TRIGGER cv_metadata_set_updated_at
    BEFORE UPDATE ON public.cv_metadata
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- TABLE: check_in_streaks
-- One row per user. `last_check_in` is stored at the absolute UTC midnight
-- boundary (a DATE has no zone), so a traveller cannot game the streak by
-- re-entering "the same day" from another timezone.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.check_in_streaks (
    telegram_user_id    BIGINT       PRIMARY KEY REFERENCES public.users(telegram_user_id) ON DELETE CASCADE,
    streak_count        INTEGER      NOT NULL DEFAULT 0,
    longest_streak      INTEGER      NOT NULL DEFAULT 0,
    last_check_in       DATE,
    total_check_ins     INTEGER      NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT check_in_streaks_count_nonneg     CHECK (streak_count >= 0),
    CONSTRAINT check_in_streaks_longest_nonneg   CHECK (longest_streak >= 0),
    CONSTRAINT check_in_streaks_longest_gte_curr CHECK (longest_streak >= streak_count),
    CONSTRAINT check_in_streaks_total_nonneg     CHECK (total_check_ins >= 0)
);

CREATE INDEX IF NOT EXISTS check_in_streaks_last_idx
    ON public.check_in_streaks (last_check_in);

DROP TRIGGER IF EXISTS check_in_streaks_set_updated_at ON public.check_in_streaks;
CREATE TRIGGER check_in_streaks_set_updated_at
    BEFORE UPDATE ON public.check_in_streaks
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- TABLE: ai_generation_logs
-- One row per AI generation attempt. The rolling 2-per-168h limiter counts
-- rows in this table within a SELECT ... FOR UPDATE window to block bypass via
-- rapid double-submit. UNIQUE(user, request_id) makes client retries idempotent.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ai_generation_logs (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id    BIGINT       NOT NULL REFERENCES public.users(telegram_user_id) ON DELETE CASCADE,
    cv_id               UUID         REFERENCES public.cv_metadata(id) ON DELETE SET NULL,
    template_id         VARCHAR(64)  REFERENCES public.templates(id) ON DELETE SET NULL,
    request_id          UUID         NOT NULL DEFAULT gen_random_uuid(),
    status              VARCHAR(16)  NOT NULL DEFAULT 'succeeded',
    prompt_tokens       INTEGER      NOT NULL DEFAULT 0,
    completion_tokens   INTEGER      NOT NULL DEFAULT 0,
    error_code          VARCHAR(64),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT ai_generation_logs_status_enum
        CHECK (status IN ('succeeded', 'failed', 'rate_limited')),
    CONSTRAINT ai_generation_logs_tokens_nonneg
        CHECK (prompt_tokens >= 0 AND completion_tokens >= 0),
    CONSTRAINT ai_generation_logs_request_unique
        UNIQUE (telegram_user_id, request_id)
);

-- The hot path of the rate limiter: "count this user's rows since T".
CREATE INDEX IF NOT EXISTS ai_generation_logs_user_time_idx
    ON public.ai_generation_logs (telegram_user_id, created_at DESC);
-- Partial index so the limiter only scans rows that actually count toward quota.
CREATE INDEX IF NOT EXISTS ai_generation_logs_user_succeeded_idx
    ON public.ai_generation_logs (telegram_user_id, created_at DESC)
    WHERE status = 'succeeded';

-- =============================================================================
-- SEED: 20 unique 3D visual styles (2 unlocked, 18 locked).
-- =============================================================================
INSERT INTO public.templates (id, name, category, description, is_locked, sort_order) VALUES
    ('voxel-office',        'Voxel Office',        'isometric',  'Blocky isometric workspace built from soft-shadowed voxels.',                    FALSE,  1),
    ('minimalist-gallery',  'Minimalist Gallery',  'minimal',    'Floating museum-grade panels under clean studio lighting.',                      FALSE,  2),
    ('cyberpunk-terminal',  'Cyberpunk Terminal',  'neon',       'Neon CRT terminal with scanlines, bloom and chromatic drift.',                   TRUE,   3),
    ('floating-node-mesh',  'Floating Node Mesh',  'abstract',   'Force-directed skill graph of glowing interconnected nodes.',                    TRUE,   4),
    ('liquid-chrome',       'Liquid Chrome',       'material',   'Reflective liquid-metal blob morphing under an HDRI sky.',                        TRUE,   5),
    ('paper-origami',       'Paper Origami',       'craft',      'Folded paper sculpture with crisp creases and soft AO.',                         TRUE,   6),
    ('neon-grid-runner',    'Neon Grid Runner',    'neon',       'Synthwave horizon with an infinite scrolling neon grid floor.',                  TRUE,   7),
    ('crystal-cavern',      'Crystal Cavern',      'environment','Refractive crystal formations lit by volumetric god-rays.',                      TRUE,   8),
    ('blueprint-hologram',  'Blueprint Hologram',  'technical',  'Wireframe holographic blueprint projected on a dark grid.',                      TRUE,   9),
    ('botanical-terrarium', 'Botanical Terrarium', 'organic',    'Glass terrarium of low-poly foliage with caustic glass light.',                  TRUE,  10),
    ('brutalist-monolith',  'Brutalist Monolith',  'architectural','Raw concrete slabs casting long architectural shadows.',                       TRUE,  11),
    ('aurora-nebula',       'Aurora Nebula',       'space',      'Particle nebula with drifting aurora ribbons and starfield.',                    TRUE,  12),
    ('retro-arcade',        'Retro Arcade',        'pixel',      'CRT arcade cabinet rendered in chunky emissive pixels.',                         TRUE,  13),
    ('molten-core',         'Molten Core',         'material',   'Glowing lava sphere with displacement and emissive cracks.',                     TRUE,  14),
    ('ink-sumi-e',          'Ink Sumi-e',          'artistic',   'Sumi-e ink wash strokes rendered as billboarded ribbons.',                       TRUE,  15),
    ('quantum-lattice',     'Quantum Lattice',     'abstract',   'Oscillating instanced lattice driven by sine-field motion.',                     TRUE,  16),
    ('deep-sea-bioluminescence','Deep-Sea Bioluminescence','environment','Abyssal scene with bioluminescent particles and fog.',                  TRUE,  17),
    ('art-deco-skyline',    'Art Deco Skyline',    'architectural','Gilded art-deco towers under a dusk gradient sky.',                            TRUE,  18),
    ('holographic-vinyl',   'Holographic Vinyl',   'material',   'Iridescent holographic foil shader on a slow-spinning disc.',                    TRUE,  19),
    ('zen-rock-garden',     'Zen Rock Garden',     'organic',    'Raked-sand zen garden with smooth stones and soft shadows.',                     TRUE,  20)
ON CONFLICT (id) DO UPDATE SET
    name        = EXCLUDED.name,
    category    = EXCLUDED.category,
    description = EXCLUDED.description,
    is_locked   = EXCLUDED.is_locked,
    sort_order  = EXCLUDED.sort_order;

-- Assertion: exactly 2 unlocked + 18 locked after seeding.
DO $$
DECLARE
    v_unlocked INTEGER;
    v_locked   INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_unlocked FROM public.templates WHERE is_locked = FALSE;
    SELECT COUNT(*) INTO v_locked   FROM public.templates WHERE is_locked = TRUE;
    IF v_unlocked <> 2 OR v_locked <> 18 THEN
        RAISE EXCEPTION 'Template seed invariant violated: % unlocked / % locked (expected 2 / 18)',
            v_unlocked, v_locked;
    END IF;
END;
$$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- The application binds the per-request identity via:
--     SELECT set_config('app.current_telegram_user_id', $1::text, true);
-- inside the transaction, and RLS policies compare against it so a leaked
-- connection cannot read another user's rows. `templates` is world-readable.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.current_telegram_user_id()
RETURNS BIGINT
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_raw TEXT := current_setting('app.current_telegram_user_id', true);
BEGIN
    IF v_raw IS NULL OR v_raw = '' THEN
        RETURN NULL;
    END IF;
    RETURN v_raw::BIGINT;
EXCEPTION WHEN others THEN
    RETURN NULL;
END;
$$;

ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cv_metadata        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_in_streaks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_unlocks   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_self ON public.users;
CREATE POLICY users_self ON public.users
    FOR ALL USING (telegram_user_id = public.current_telegram_user_id())
    WITH CHECK (telegram_user_id = public.current_telegram_user_id());

DROP POLICY IF EXISTS cv_metadata_owner ON public.cv_metadata;
CREATE POLICY cv_metadata_owner ON public.cv_metadata
    FOR ALL USING (telegram_user_id = public.current_telegram_user_id())
    WITH CHECK (telegram_user_id = public.current_telegram_user_id());

DROP POLICY IF EXISTS check_in_streaks_owner ON public.check_in_streaks;
CREATE POLICY check_in_streaks_owner ON public.check_in_streaks
    FOR ALL USING (telegram_user_id = public.current_telegram_user_id())
    WITH CHECK (telegram_user_id = public.current_telegram_user_id());

DROP POLICY IF EXISTS ai_generation_logs_owner ON public.ai_generation_logs;
CREATE POLICY ai_generation_logs_owner ON public.ai_generation_logs
    FOR ALL USING (telegram_user_id = public.current_telegram_user_id())
    WITH CHECK (telegram_user_id = public.current_telegram_user_id());

DROP POLICY IF EXISTS template_unlocks_owner ON public.template_unlocks;
CREATE POLICY template_unlocks_owner ON public.template_unlocks
    FOR ALL USING (telegram_user_id = public.current_telegram_user_id())
    WITH CHECK (telegram_user_id = public.current_telegram_user_id());

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
