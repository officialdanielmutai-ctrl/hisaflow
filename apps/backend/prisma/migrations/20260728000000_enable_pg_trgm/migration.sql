-- Enable the pg_trgm extension for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create a GIN trigram index on inventory item names for lightning-fast fuzzy search
CREATE INDEX IF NOT EXISTS idx_inventory_items_name_trgm
  ON inventory_items
  USING GIN (name gin_trgm_ops);
