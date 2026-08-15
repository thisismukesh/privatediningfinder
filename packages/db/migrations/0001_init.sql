-- §4.1 Venue and spaces
CREATE TYPE trust_label   AS ENUM ('verified','likely','unverified');
CREATE TYPE source_tier   AS ENUM ('A','B','C','D','E');
CREATE TYPE space_kind    AS ENUM ('private_room','semi_private','patio','bar_area',
                                   'ballroom','full_buyout','event_lawn');
CREATE TYPE privacy_level AS ENUM ('dedicated_enclosed','semi_private_partitioned',
                                   'open_area_reserved');
CREATE TYPE layout_type   AS ENUM ('seated_dinner','standing_reception','theater',
                                   'u_shape','boardroom','classroom','banquet_rounds');
CREATE TYPE travel_mode   AS ENUM ('walking','driving','cycling');

CREATE TABLE venue (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  google_place_id text UNIQUE,
  osm_id          text UNIQUE,
  name            text NOT NULL,
  address_line    text NOT NULL,
  city            text NOT NULL,
  region          text,
  postal_code     text,
  country         text NOT NULL DEFAULT 'US',
  geog            geography(Point,4326) NOT NULL,
  website_url     text,
  phone           text,
  email           text,
  venue_type      text,
  metro_slug      text,
  crawl_state     jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_crawled_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX venue_geog_idx  ON venue USING GIST (geog);
CREATE INDEX venue_metro_idx ON venue (metro_slug);
CREATE INDEX venue_name_trgm ON venue USING GIN (name gin_trgm_ops);

CREATE TABLE space (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id        uuid NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
  name            text NOT NULL,
  kind            space_kind NOT NULL,
  privacy         privacy_level,
  privacy_trust   trust_label NOT NULL DEFAULT 'unverified',
  combinable_with uuid[] NOT NULL DEFAULT '{}',
  square_feet     integer,
  has_av          boolean,
  is_outdoor      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (venue_id, name)
);

CREATE TABLE space_capacity (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id     uuid NOT NULL REFERENCES space(id) ON DELETE CASCADE,
  layout       layout_type NOT NULL,
  min_capacity integer,
  max_capacity integer NOT NULL,
  is_derived   boolean NOT NULL DEFAULT false,
  derived_from layout_type,
  derivation_rule text,
  trust        trust_label NOT NULL,
  fact_id      uuid,
  UNIQUE (space_id, layout),
  CHECK (max_capacity > 0),
  CHECK (min_capacity IS NULL OR min_capacity <= max_capacity),
  CHECK (is_derived = false OR derived_from IS NOT NULL)
);

-- §4.2 Facts and evidence — the trust substrate
CREATE TABLE fact (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id      uuid NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
  space_id      uuid REFERENCES space(id) ON DELETE CASCADE,
  field         text NOT NULL,
  value_num     numeric,
  value_text    text,
  value_json    jsonb,
  unit          text,
  trust         trust_label NOT NULL,
  trust_reason  text NOT NULL,
  is_conflicted boolean NOT NULL DEFAULT false,
  computed_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (venue_id, space_id, field)
);
CREATE INDEX fact_venue_field_idx ON fact (venue_id, field);

CREATE TABLE evidence (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  fact_id         uuid NOT NULL REFERENCES fact(id) ON DELETE CASCADE,
  tier            source_tier NOT NULL,
  source_url      text NOT NULL,
  source_name     text,
  quote           text NOT NULL,
  quote_verified  boolean NOT NULL,
  extraction_method text NOT NULL,
  extractor_version text NOT NULL,
  content_hash    text NOT NULL,
  fetched_at      timestamptz NOT NULL,
  raw_value       text NOT NULL,
  injection_flag  boolean NOT NULL DEFAULT false,
  CHECK (quote_verified = true)
);
CREATE INDEX evidence_fact_idx ON evidence (fact_id);

CREATE TABLE negative_evidence (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id    uuid NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
  field       text NOT NULL,
  source_url  text NOT NULL,
  checked_at  timestamptz NOT NULL DEFAULT now(),
  note        text,
  UNIQUE (venue_id, field, source_url)
);

ALTER TABLE space_capacity
  ADD CONSTRAINT space_capacity_fact_fk FOREIGN KEY (fact_id) REFERENCES fact(id);

-- §4.3 Licensed third-party cache — separated for compliance
CREATE TABLE places_cache (
  place_id    text PRIMARY KEY,
  payload     jsonb NOT NULL,
  fetched_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);
CREATE INDEX places_cache_expiry ON places_cache (expires_at);

-- §4.4 Search, results, sharing
CREATE TYPE search_status AS ENUM ('queued','running','complete','failed','partial');
CREATE TYPE event_style   AS ENUM ('seated_dinner','standing_reception','either');

CREATE TABLE search (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  input_address     text NOT NULL,
  origin_geog       geography(Point,4326),
  headcount         integer NOT NULL CHECK (headcount BETWEEN 2 AND 5000),
  max_commute_min   integer NOT NULL CHECK (max_commute_min BETWEEN 1 AND 60),
  mode              travel_mode,
  mode_was_explicit boolean NOT NULL DEFAULT false,
  mode_reason       text,
  style             event_style NOT NULL DEFAULT 'either',
  style_was_inferred boolean NOT NULL DEFAULT false,
  budget_total      numeric,
  budget_per_person numeric,
  dietary           text[] NOT NULL DEFAULT '{}',
  isochrone_geom    geometry(MultiPolygon,4326),
  status            search_status NOT NULL DEFAULT 'queued',
  stage             text,
  error             text,
  cost_usd          numeric NOT NULL DEFAULT 0,
  share_token       text UNIQUE,
  session_key       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz
);

CREATE TABLE search_result (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  search_id         uuid NOT NULL REFERENCES search(id) ON DELETE CASCADE,
  venue_id          uuid NOT NULL REFERENCES venue(id),
  rank              integer NOT NULL,
  bucket            text NOT NULL,
  score_total       numeric NOT NULL,
  score_breakdown   jsonb NOT NULL,
  risk_multiplier   numeric NOT NULL,
  constraint_applied boolean NOT NULL DEFAULT false,
  fit               jsonb NOT NULL,
  commute_minutes   numeric,
  commute_meters    numeric,
  commute_mode      travel_mode NOT NULL,
  commute_is_estimated boolean NOT NULL,
  UNIQUE (search_id, venue_id),
  UNIQUE (search_id, rank)
);

CREATE TABLE search_stage_log (
  id         bigserial PRIMARY KEY,
  search_id  uuid NOT NULL REFERENCES search(id) ON DELETE CASCADE,
  stage      text NOT NULL,
  status     text NOT NULL,
  message    text,
  duration_ms integer,
  at         timestamptz NOT NULL DEFAULT now()
);

-- §4.5 Provider caches
CREATE TABLE geocode_cache (
  query_hash text PRIMARY KEY, query text NOT NULL,
  geog geography(Point,4326) NOT NULL, formatted_address text,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE isochrone_cache (
  cache_key text PRIMARY KEY,
  geom geometry(MultiPolygon,4326) NOT NULL,
  provider text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE page_cache (
  url_hash     text PRIMARY KEY, url text NOT NULL,
  content_hash text NOT NULL, content text, content_type text,
  http_status  integer NOT NULL, fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE extraction_cache (
  cache_key    text PRIMARY KEY,
  content_hash text NOT NULL, extractor_version text NOT NULL,
  result jsonb NOT NULL, tokens_used integer, cost_usd numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
