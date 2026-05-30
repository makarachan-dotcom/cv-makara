-- =============================================================================
-- CV DRAFTS — persisted Khmer-first career drafts from the AI Khmer Interviewer.
-- -----------------------------------------------------------------------------
-- A draft is created from the interview synthesis. Exactly one row per user may
-- be ACTIVE at a time; the partial unique index below makes that an invariant
-- the database itself guarantees. The application archives the prior active
-- draft and inserts the new one inside ONE transaction, so the transition from
-- "ongoing interview" to "saved active draft" is atomic and race-free.
--
-- generations.draft_id ties a 3D template generation back to the consultation
-- draft that gated it, so a generation cannot exist without a prior draft.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.cv_drafts (
    id          BIGSERIAL   PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    industry    VARCHAR(32) NOT NULL,
    status      VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    data        JSONB       NOT NULL,
    answers     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT cv_drafts_status_check CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    -- The MakaraCvDraft is the application source of truth (Zod). We assert the
    -- minimal shape at the DB layer as defence-in-depth.
    CONSTRAINT cv_drafts_data_shape CHECK (
        jsonb_typeof(data -> 'fullName')   = 'string'
        AND jsonb_typeof(data -> 'experience') = 'array'
        AND jsonb_typeof(data -> 'skills')     = 'array'
    )
);

-- Lookups for "the active draft for this user" + recency ordering.
CREATE INDEX IF NOT EXISTS cv_drafts_user_status_updated_idx
    ON public.cv_drafts (user_id, status, updated_at DESC);

-- Hard invariant: at most one ACTIVE draft per user. Archiving + inserting in a
-- single transaction therefore cannot leave two active drafts behind.
CREATE UNIQUE INDEX IF NOT EXISTS cv_drafts_one_active_per_user
    ON public.cv_drafts (user_id)
    WHERE status = 'ACTIVE';

-- Link a generation to the draft that authorised it.
ALTER TABLE public.generations
    ADD COLUMN IF NOT EXISTS draft_id BIGINT
        REFERENCES public.cv_drafts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS generations_draft_idx
    ON public.generations (draft_id);

-- =============================================================================
-- ROW LEVEL SECURITY — same per-user GUC model as 0001_init.
-- =============================================================================
ALTER TABLE public.cv_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cv_drafts_owner_all ON public.cv_drafts;
CREATE POLICY cv_drafts_owner_all ON public.cv_drafts
    FOR ALL USING (user_id = public.current_app_user_id())
    WITH CHECK (user_id = public.current_app_user_id());
