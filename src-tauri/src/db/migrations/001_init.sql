CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  customer_address TEXT NOT NULL DEFAULT '',
  default_pricing_tax_included INTEGER NOT NULL DEFAULT 1 CHECK (default_pricing_tax_included IN (0, 1)),
  bridge_processing_fee_tax_included_x100 INTEGER NOT NULL DEFAULT 0 CHECK (bridge_processing_fee_tax_included_x100 >= 0),
  powder_processing_fee_tax_included_x100 INTEGER NOT NULL DEFAULT 0 CHECK (powder_processing_fee_tax_included_x100 >= 0),
  billet_processing_fee_tax_included_x100 INTEGER NOT NULL DEFAULT 0 CHECK (billet_processing_fee_tax_included_x100 >= 0),
  oxidation_processing_fee_tax_included_x100 INTEGER NOT NULL DEFAULT 0 CHECK (oxidation_processing_fee_tax_included_x100 >= 0),
  electrophoresis_processing_fee_tax_included_x100 INTEGER NOT NULL DEFAULT 0 CHECK (electrophoresis_processing_fee_tax_included_x100 >= 0),
  bridge_processing_fee_tax_excluded_x100 INTEGER NOT NULL DEFAULT 0 CHECK (bridge_processing_fee_tax_excluded_x100 >= 0),
  powder_processing_fee_tax_excluded_x100 INTEGER NOT NULL DEFAULT 0 CHECK (powder_processing_fee_tax_excluded_x100 >= 0),
  billet_processing_fee_tax_excluded_x100 INTEGER NOT NULL DEFAULT 0 CHECK (billet_processing_fee_tax_excluded_x100 >= 0),
  oxidation_processing_fee_tax_excluded_x100 INTEGER NOT NULL DEFAULT 0 CHECK (oxidation_processing_fee_tax_excluded_x100 >= 0),
  electrophoresis_processing_fee_tax_excluded_x100 INTEGER NOT NULL DEFAULT 0 CHECK (electrophoresis_processing_fee_tax_excluded_x100 >= 0),
  special_pricing_keyword TEXT NOT NULL DEFAULT '',
  special_bridge_processing_fee_tax_included_x100 INTEGER NOT NULL DEFAULT 0 CHECK (special_bridge_processing_fee_tax_included_x100 >= 0),
  special_powder_processing_fee_tax_included_x100 INTEGER NOT NULL DEFAULT 0 CHECK (special_powder_processing_fee_tax_included_x100 >= 0),
  special_billet_processing_fee_tax_included_x100 INTEGER NOT NULL DEFAULT 0 CHECK (special_billet_processing_fee_tax_included_x100 >= 0),
  special_oxidation_processing_fee_tax_included_x100 INTEGER NOT NULL DEFAULT 0 CHECK (special_oxidation_processing_fee_tax_included_x100 >= 0),
  special_electrophoresis_processing_fee_tax_included_x100 INTEGER NOT NULL DEFAULT 0 CHECK (special_electrophoresis_processing_fee_tax_included_x100 >= 0),
  special_bridge_processing_fee_tax_excluded_x100 INTEGER NOT NULL DEFAULT 0 CHECK (special_bridge_processing_fee_tax_excluded_x100 >= 0),
  special_powder_processing_fee_tax_excluded_x100 INTEGER NOT NULL DEFAULT 0 CHECK (special_powder_processing_fee_tax_excluded_x100 >= 0),
  special_billet_processing_fee_tax_excluded_x100 INTEGER NOT NULL DEFAULT 0 CHECK (special_billet_processing_fee_tax_excluded_x100 >= 0),
  special_oxidation_processing_fee_tax_excluded_x100 INTEGER NOT NULL DEFAULT 0 CHECK (special_oxidation_processing_fee_tax_excluded_x100 >= 0),
  special_electrophoresis_processing_fee_tax_excluded_x100 INTEGER NOT NULL DEFAULT 0 CHECK (special_electrophoresis_processing_fee_tax_excluded_x100 >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  product_name TEXT NOT NULL,
  mold_code TEXT NOT NULL,
  thickness_mm_x100 INTEGER NOT NULL CHECK (thickness_mm_x100 > 0),
  weight_per_meter_kg_x1000 INTEGER NOT NULL CHECK (weight_per_meter_kg_x1000 > 0),
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_products (
  customer_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_id, product_id),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  customer_address TEXT NOT NULL DEFAULT '',
  handler_name TEXT NOT NULL DEFAULT '',
  aluminum_ingot_price_x100 INTEGER NOT NULL DEFAULT 0 CHECK (aluminum_ingot_price_x100 >= 0),
  pricing_tax_included INTEGER NOT NULL DEFAULT 1 CHECK (pricing_tax_included IN (0, 1)),
  bridge_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (bridge_processing_fee_x100 >= 0),
  powder_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (powder_processing_fee_x100 >= 0),
  billet_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (billet_processing_fee_x100 >= 0),
  oxidation_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (oxidation_processing_fee_x100 >= 0),
  electrophoresis_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (electrophoresis_processing_fee_x100 >= 0),
  status TEXT NOT NULL CHECK (status IN ('editing', 'saved', 'ordered')),
  ordered_date TEXT,
  note TEXT,
  inventory_locked_at TEXT,
  inventory_closed_at TEXT,
  inventory_close_destination TEXT CHECK (inventory_close_destination IN ('shipped', 'public', 'customer') OR inventory_close_destination IS NULL),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT NOT NULL,
  product_mold_code TEXT NOT NULL,
  thickness_mm_x100 INTEGER NOT NULL CHECK (thickness_mm_x100 > 0),
  weight_per_meter_kg_x1000 INTEGER NOT NULL CHECK (weight_per_meter_kg_x1000 > 0),
  length_mm INTEGER NOT NULL CHECK (length_mm > 0),
  color TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  theoretical_weight_kg_x100 INTEGER NOT NULL CHECK (theoretical_weight_kg_x100 > 0),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS number_sequences (
  name TEXT PRIMARY KEY,
  next_number INTEGER NOT NULL CHECK (next_number > 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_stocks (
  product_id TEXT NOT NULL,
  length_mm INTEGER NOT NULL CHECK (length_mm > 0),
  color TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, length_mm, color),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_inventory_stocks (
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  length_mm INTEGER NOT NULL CHECK (length_mm > 0),
  color TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id, product_id, length_mm, color),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  product_id TEXT,
  order_id TEXT,
  delivery_note_id TEXT,
  product_name TEXT NOT NULL,
  mold_code TEXT NOT NULL,
  length_mm INTEGER,
  color TEXT NOT NULL DEFAULT '',
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjust', 'produce', 'ship', 'transfer_public', 'transfer_customer')),
  quantity_before INTEGER NOT NULL CHECK (quantity_before >= 0),
  quantity_after INTEGER NOT NULL CHECK (quantity_after >= 0),
  delta_quantity INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY (delivery_note_id) REFERENCES delivery_notes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS delivery_notes (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_address TEXT NOT NULL DEFAULT '',
  handler_name TEXT NOT NULL DEFAULT '',
  delivery_date TEXT NOT NULL DEFAULT CURRENT_DATE,
  aluminum_ingot_price_x100 INTEGER NOT NULL DEFAULT 0 CHECK (aluminum_ingot_price_x100 >= 0),
  pricing_tax_included INTEGER NOT NULL DEFAULT 1 CHECK (pricing_tax_included IN (0, 1)),
  bridge_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (bridge_processing_fee_x100 >= 0),
  powder_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (powder_processing_fee_x100 >= 0),
  billet_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (billet_processing_fee_x100 >= 0),
  oxidation_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (oxidation_processing_fee_x100 >= 0),
  electrophoresis_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (electrophoresis_processing_fee_x100 >= 0),
  bridge_weight_kg_x100 INTEGER NOT NULL DEFAULT 0 CHECK (bridge_weight_kg_x100 >= 0),
  powder_weight_kg_x100 INTEGER NOT NULL DEFAULT 0 CHECK (powder_weight_kg_x100 >= 0),
  billet_weight_kg_x100 INTEGER NOT NULL DEFAULT 0 CHECK (billet_weight_kg_x100 >= 0),
  oxidation_weight_kg_x100 INTEGER NOT NULL DEFAULT 0 CHECK (oxidation_weight_kg_x100 >= 0),
  electrophoresis_weight_kg_x100 INTEGER NOT NULL DEFAULT 0 CHECK (electrophoresis_weight_kg_x100 >= 0),
  pricing_profile_name TEXT NOT NULL DEFAULT '默认价',
  pricing_trigger_keyword TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  special_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS delivery_note_items (
  id TEXT PRIMARY KEY,
  delivery_note_id TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT NOT NULL,
  mold_code TEXT NOT NULL,
  length_mm INTEGER NOT NULL CHECK (length_mm > 0),
  color TEXT NOT NULL,
  order_quantity INTEGER NOT NULL CHECK (order_quantity > 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (delivery_note_id) REFERENCES delivery_notes(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS customer_inventory_batches (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_address TEXT NOT NULL DEFAULT '',
  historical_order_date TEXT,
  historical_order_ref TEXT NOT NULL DEFAULT '',
  aluminum_ingot_price_x100 INTEGER NOT NULL CHECK (aluminum_ingot_price_x100 > 0),
  pricing_tax_included INTEGER NOT NULL DEFAULT 1 CHECK (pricing_tax_included IN (0, 1)),
  bridge_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (bridge_processing_fee_x100 >= 0),
  powder_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (powder_processing_fee_x100 >= 0),
  billet_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (billet_processing_fee_x100 >= 0),
  oxidation_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (oxidation_processing_fee_x100 >= 0),
  electrophoresis_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (electrophoresis_processing_fee_x100 >= 0),
  source_order_id TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (source_order_id) REFERENCES orders(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_inventory_batches_source_order
ON customer_inventory_batches(source_order_id)
WHERE source_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS customer_inventory_stocks (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT NOT NULL,
  mold_code TEXT NOT NULL,
  length_mm INTEGER NOT NULL CHECK (length_mm > 0),
  color TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES customer_inventory_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS customer_inventory_movements (
  id TEXT PRIMARY KEY,
  batch_id TEXT,
  stock_id TEXT,
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  delivery_note_id TEXT,
  product_id TEXT,
  product_name TEXT NOT NULL,
  mold_code TEXT NOT NULL,
  length_mm INTEGER,
  color TEXT NOT NULL DEFAULT '',
  movement_type TEXT NOT NULL CHECK (movement_type IN ('historical_import', 'out', 'adjust', 'transfer_order')),
  quantity_before INTEGER NOT NULL CHECK (quantity_before >= 0),
  quantity_after INTEGER NOT NULL CHECK (quantity_after >= 0),
  delta_quantity INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES customer_inventory_batches(id) ON DELETE SET NULL,
  FOREIGN KEY (stock_id) REFERENCES customer_inventory_stocks(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS customer_inventory_delivery_notes (
  id TEXT PRIMARY KEY,
  batch_id TEXT,
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  customer_address TEXT NOT NULL DEFAULT '',
  handler_name TEXT NOT NULL DEFAULT '',
  historical_order_date TEXT,
  historical_order_ref TEXT NOT NULL DEFAULT '',
  delivery_date TEXT NOT NULL DEFAULT CURRENT_DATE,
  aluminum_ingot_price_x100 INTEGER NOT NULL CHECK (aluminum_ingot_price_x100 > 0),
  pricing_tax_included INTEGER NOT NULL DEFAULT 1 CHECK (pricing_tax_included IN (0, 1)),
  bridge_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (bridge_processing_fee_x100 >= 0),
  powder_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (powder_processing_fee_x100 >= 0),
  billet_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (billet_processing_fee_x100 >= 0),
  oxidation_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (oxidation_processing_fee_x100 >= 0),
  electrophoresis_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (electrophoresis_processing_fee_x100 >= 0),
  bridge_weight_kg_x100 INTEGER NOT NULL DEFAULT 0 CHECK (bridge_weight_kg_x100 >= 0),
  powder_weight_kg_x100 INTEGER NOT NULL DEFAULT 0 CHECK (powder_weight_kg_x100 >= 0),
  billet_weight_kg_x100 INTEGER NOT NULL DEFAULT 0 CHECK (billet_weight_kg_x100 >= 0),
  oxidation_weight_kg_x100 INTEGER NOT NULL DEFAULT 0 CHECK (oxidation_weight_kg_x100 >= 0),
  electrophoresis_weight_kg_x100 INTEGER NOT NULL DEFAULT 0 CHECK (electrophoresis_weight_kg_x100 >= 0),
  extra_charge_name TEXT NOT NULL DEFAULT '',
  extra_charge_amount_x100 INTEGER NOT NULL DEFAULT 0 CHECK (extra_charge_amount_x100 >= 0),
  pricing_profile_name TEXT NOT NULL DEFAULT '历史库存价',
  pricing_trigger_keyword TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  special_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES customer_inventory_batches(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS customer_inventory_delivery_note_price_groups (
  id TEXT PRIMARY KEY,
  delivery_note_id TEXT NOT NULL,
  group_index INTEGER NOT NULL CHECK (group_index > 0),
  title TEXT NOT NULL DEFAULT '',
  aluminum_ingot_price_x100 INTEGER NOT NULL CHECK (aluminum_ingot_price_x100 > 0),
  pricing_tax_included INTEGER NOT NULL DEFAULT 1 CHECK (pricing_tax_included IN (0, 1)),
  bridge_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (bridge_processing_fee_x100 >= 0),
  powder_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (powder_processing_fee_x100 >= 0),
  billet_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (billet_processing_fee_x100 >= 0),
  oxidation_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (oxidation_processing_fee_x100 >= 0),
  electrophoresis_processing_fee_x100 INTEGER NOT NULL DEFAULT 0 CHECK (electrophoresis_processing_fee_x100 >= 0),
  bridge_weight_kg_x100 INTEGER NOT NULL DEFAULT 0 CHECK (bridge_weight_kg_x100 >= 0),
  powder_weight_kg_x100 INTEGER NOT NULL DEFAULT 0 CHECK (powder_weight_kg_x100 >= 0),
  billet_weight_kg_x100 INTEGER NOT NULL DEFAULT 0 CHECK (billet_weight_kg_x100 >= 0),
  oxidation_weight_kg_x100 INTEGER NOT NULL DEFAULT 0 CHECK (oxidation_weight_kg_x100 >= 0),
  electrophoresis_weight_kg_x100 INTEGER NOT NULL DEFAULT 0 CHECK (electrophoresis_weight_kg_x100 >= 0),
  extra_charge_name TEXT NOT NULL DEFAULT '',
  extra_charge_amount_x100 INTEGER NOT NULL DEFAULT 0 CHECK (extra_charge_amount_x100 >= 0),
  pricing_profile_name TEXT NOT NULL DEFAULT '历史库存价',
  pricing_trigger_keyword TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (delivery_note_id) REFERENCES customer_inventory_delivery_notes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customer_inventory_delivery_note_items (
  id TEXT PRIMARY KEY,
  delivery_note_id TEXT NOT NULL,
  price_group_id TEXT,
  stock_id TEXT,
  product_id TEXT,
  product_name TEXT NOT NULL,
  mold_code TEXT NOT NULL,
  length_mm INTEGER NOT NULL CHECK (length_mm > 0),
  color TEXT NOT NULL,
  order_quantity INTEGER NOT NULL CHECK (order_quantity > 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  note TEXT NOT NULL DEFAULT '',
  group_label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (delivery_note_id) REFERENCES customer_inventory_delivery_notes(id) ON DELETE CASCADE,
  FOREIGN KEY (price_group_id) REFERENCES customer_inventory_delivery_note_price_groups(id) ON DELETE SET NULL,
  FOREIGN KEY (stock_id) REFERENCES customer_inventory_stocks(id) ON DELETE SET NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_ordered_date ON orders(ordered_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_handler_name ON orders(handler_name);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_product_name_unique ON products(product_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_mold_code_unique ON products(mold_code);
CREATE INDEX IF NOT EXISTS idx_customer_products_customer_id ON customer_products(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_products_product_id ON customer_products(product_id);
CREATE INDEX IF NOT EXISTS idx_order_inventory_stocks_order_id ON order_inventory_stocks(order_id);
CREATE INDEX IF NOT EXISTS idx_order_inventory_stocks_product_id ON order_inventory_stocks(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stocks_product_id ON inventory_stocks(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_order_id ON inventory_movements(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_delivery_note_id ON inventory_movements(delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_order_id ON delivery_notes(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_delivery_date ON delivery_notes(delivery_date DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_delivery_note_id ON delivery_note_items(delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_customer_inventory_batches_customer_id ON customer_inventory_batches(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_inventory_batches_historical_order_date ON customer_inventory_batches(historical_order_date DESC);
CREATE INDEX IF NOT EXISTS idx_customer_inventory_stocks_batch_id ON customer_inventory_stocks(batch_id);
CREATE INDEX IF NOT EXISTS idx_customer_inventory_stocks_product_id ON customer_inventory_stocks(product_id);
CREATE INDEX IF NOT EXISTS idx_customer_inventory_movements_batch_id ON customer_inventory_movements(batch_id);
CREATE INDEX IF NOT EXISTS idx_customer_inventory_movements_customer_id ON customer_inventory_movements(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_inventory_movements_delivery_note_id ON customer_inventory_movements(delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_customer_inventory_movements_created_at ON customer_inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_inventory_delivery_notes_batch_id ON customer_inventory_delivery_notes(batch_id);
CREATE INDEX IF NOT EXISTS idx_customer_inventory_delivery_notes_customer_id ON customer_inventory_delivery_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_inventory_delivery_notes_delivery_date ON customer_inventory_delivery_notes(delivery_date DESC);
CREATE INDEX IF NOT EXISTS idx_customer_inventory_delivery_note_price_groups_delivery_note_id ON customer_inventory_delivery_note_price_groups(delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_customer_inventory_delivery_note_items_delivery_note_id ON customer_inventory_delivery_note_items(delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_customer_inventory_delivery_note_items_price_group_id ON customer_inventory_delivery_note_items(price_group_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_customer_name_unique ON customers(customer_name);

-- Optional charges for order delivery notes; totals are calculated from these rows.
CREATE TABLE IF NOT EXISTS delivery_note_extra_charges (
  delivery_note_id TEXT NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  amount_x100 INTEGER NOT NULL CHECK (amount_x100 > 0),
  PRIMARY KEY (delivery_note_id, position)
);
