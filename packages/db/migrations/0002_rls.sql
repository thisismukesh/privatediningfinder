-- §4.6 Row Level Security. Default deny on every table.
-- anon has no direct table access at all; the only anonymous read path is the
-- SECURITY DEFINER function public.get_shared_search(token text) below.

ALTER TABLE venue              ENABLE ROW LEVEL SECURITY;
ALTER TABLE space               ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_capacity      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact                ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence            ENABLE ROW LEVEL SECURITY;
ALTER TABLE negative_evidence   ENABLE ROW LEVEL SECURITY;
ALTER TABLE places_cache        ENABLE ROW LEVEL SECURITY;
ALTER TABLE search              ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_result       ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_stage_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE geocode_cache       ENABLE ROW LEVEL SECURITY;
ALTER TABLE isochrone_cache     ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_cache          ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_cache    ENABLE ROW LEVEL SECURITY;

ALTER TABLE venue              FORCE ROW LEVEL SECURITY;
ALTER TABLE space               FORCE ROW LEVEL SECURITY;
ALTER TABLE space_capacity      FORCE ROW LEVEL SECURITY;
ALTER TABLE fact                FORCE ROW LEVEL SECURITY;
ALTER TABLE evidence            FORCE ROW LEVEL SECURITY;
ALTER TABLE negative_evidence   FORCE ROW LEVEL SECURITY;
ALTER TABLE places_cache        FORCE ROW LEVEL SECURITY;
ALTER TABLE search              FORCE ROW LEVEL SECURITY;
ALTER TABLE search_result       FORCE ROW LEVEL SECURITY;
ALTER TABLE search_stage_log    FORCE ROW LEVEL SECURITY;
ALTER TABLE geocode_cache       FORCE ROW LEVEL SECURITY;
ALTER TABLE isochrone_cache     FORCE ROW LEVEL SECURITY;
ALTER TABLE page_cache          FORCE ROW LEVEL SECURITY;
ALTER TABLE extraction_cache    FORCE ROW LEVEL SECURITY;

-- No policies are created for anon or authenticated on any table: default deny.
-- service_role has the BYPASSRLS attribute, which skips row-filtering entirely, so it
-- needs no policies -- only the standard table privileges below, which BYPASSRLS does
-- not imply on its own.
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- The single audited anonymous read path. Returns a result set only for an exact
-- share_token match on a completed search; never leaks whether a token is "close".
CREATE TYPE shared_search_venue AS (
  venue_id            uuid,
  venue_name           text,
  venue_address_line   text,
  venue_city           text,
  rank                 integer,
  bucket               text,
  score_total          numeric,
  score_breakdown      jsonb,
  fit                  jsonb,
  commute_minutes      numeric,
  commute_mode         travel_mode,
  commute_is_estimated boolean
);

CREATE OR REPLACE FUNCTION public.get_shared_search(p_token text)
RETURNS SETOF shared_search_venue
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    v.id, v.name, v.address_line, v.city,
    sr.rank, sr.bucket, sr.score_total, sr.score_breakdown, sr.fit,
    sr.commute_minutes, sr.commute_mode, sr.commute_is_estimated
  FROM search s
  JOIN search_result sr ON sr.search_id = s.id
  JOIN venue v ON v.id = sr.venue_id
  WHERE s.share_token = p_token
    AND s.share_token IS NOT NULL
  ORDER BY sr.rank;
$$;

REVOKE ALL ON FUNCTION public.get_shared_search(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_search(text) TO anon, authenticated;
