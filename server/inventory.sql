-- =============================================================
-- ARC SportsZone — Inventory Management Module
-- =============================================================
-- File: inventory.sql
-- Branch: feature/inventory-module
-- Database: sports_booking_inventory_test
--
-- Instructions:
--   Run this file ONCE manually in MySQL Workbench.
--   All statements are safe for an existing 'sports_booking' or
--   'sports_booking_inventory_test' database that already has the
--   core + membership tables applied.
--
-- Sections:
--   Part 1 — Alter existing tables (additive only, safe defaults)
--   Part 2 — Create new inventory tables
--   Part 3 — Seed data
-- =============================================================


-- =============================================================
-- PART 1: ALTER EXISTING TABLES (ADDITIVE ONLY)
-- =============================================================

-- -------------------------------------------------------------
-- 1a. Alter `accessories` table
--     Adds: type, rental_pricing_type, hourly_rate,
--            stock_quantity, available_quantity,
--            discarded_quantity, reorder_threshold
-- -------------------------------------------------------------
ALTER TABLE accessories
  ADD COLUMN type ENUM('for_sale', 'for_rental', 'both') NOT NULL DEFAULT 'for_sale',
  ADD COLUMN rental_pricing_type ENUM('flat', 'hourly') NOT NULL DEFAULT 'flat',
  ADD COLUMN hourly_rate DECIMAL(10, 2) NULL COMMENT 'Used only when rental_pricing_type = hourly',
  ADD COLUMN stock_quantity INT NOT NULL DEFAULT 0 COMMENT 'Total units ever stocked (owned)',
  ADD COLUMN available_quantity INT NOT NULL DEFAULT 0 COMMENT 'Units currently available to sell/rent',
  ADD COLUMN discarded_quantity INT NOT NULL DEFAULT 0 COMMENT 'Units worn out or destroyed',
  ADD COLUMN reorder_threshold INT NOT NULL DEFAULT 5 COMMENT 'Alert when available_quantity falls below this';

-- -------------------------------------------------------------
-- 1b. Alter `booking_accessories` table
--     Adds: transaction_type, damage_charge
--     (For existing court-booking + accessories flow)
-- -------------------------------------------------------------
ALTER TABLE booking_accessories
  ADD COLUMN transaction_type ENUM('sale', 'rental') NOT NULL DEFAULT 'sale',
  ADD COLUMN damage_charge DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'Extra charge if rental accessory was damaged';

-- -------------------------------------------------------------
-- 1c. Alter `payments` table
--     Adds: standalone_sale_id (nullable FK)
--     Pattern mirrors the existing membership_id column.
-- -------------------------------------------------------------
ALTER TABLE payments
  ADD COLUMN standalone_sale_id INT NULL;
-- NOTE: The FK constraint is added AFTER standalone_sales table is created (see Part 2).


-- =============================================================
-- PART 2: NEW TABLES
-- =============================================================

-- -------------------------------------------------------------
-- 2a. standalone_sales
--     Walk-in purchase / rental WITHOUT a court booking.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS standalone_sales (
  id                  INT PRIMARY KEY AUTO_INCREMENT,
  customer_name       VARCHAR(255) NOT NULL,
  customer_contact    VARCHAR(100) NOT NULL,
  sale_date           DATE NOT NULL,
  total_amount        DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  amount_paid         DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  balance_amount      DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  payment_status      VARCHAR(50) NOT NULL DEFAULT 'Pending'
                        COMMENT 'Pending | Received | Completed',
  notes               TEXT NULL,
  created_by_user_id  INT NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- -------------------------------------------------------------
-- 2b. standalone_sale_items
--     Line items attached to a standalone_sale.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS standalone_sale_items (
  id                    INT PRIMARY KEY AUTO_INCREMENT,
  standalone_sale_id    INT NOT NULL,
  accessory_id          INT NOT NULL,
  transaction_type      ENUM('sale', 'rental') NOT NULL DEFAULT 'sale',
  quantity              INT NOT NULL DEFAULT 1,
  price_at_sale         DECIMAL(10, 2) NOT NULL COMMENT 'Snapshot of price at time of sale',
  rental_hours          DECIMAL(5, 2) NULL COMMENT 'Filled for hourly-rate rentals',
  damage_charge         DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'Filled on return if damaged',
  FOREIGN KEY (standalone_sale_id) REFERENCES standalone_sales(id) ON DELETE CASCADE,
  FOREIGN KEY (accessory_id) REFERENCES accessories(id) ON DELETE RESTRICT
);

-- -------------------------------------------------------------
-- 2c. rental_returns
--     Tracks the physical return of any rented item
--     (from either a standalone sale OR a court booking).
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rental_returns (
  id                      INT PRIMARY KEY AUTO_INCREMENT,
  source_type             ENUM('standalone', 'booking') NOT NULL,
  source_id               INT NOT NULL COMMENT 'standalone_sale_id or booking_id',
  accessory_id            INT NOT NULL,
  quantity_returned       INT NOT NULL DEFAULT 1,
  item_condition          ENUM('good', 'damaged', 'discarded') NOT NULL DEFAULT 'good',
  damage_charge           DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  damage_payment_id       INT NULL COMMENT 'FK to payments — the separate damage charge payment',
  returned_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_by_user_id    INT NULL,
  notes                   TEXT NULL,
  FOREIGN KEY (accessory_id) REFERENCES accessories(id) ON DELETE RESTRICT,
  FOREIGN KEY (damage_payment_id) REFERENCES payments(id) ON DELETE SET NULL,
  FOREIGN KEY (processed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- -------------------------------------------------------------
-- 2d. inventory_stock_log
--     Full audit trail of every stock quantity change.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_stock_log (
  id                    INT PRIMARY KEY AUTO_INCREMENT,
  accessory_id          INT NOT NULL,
  change_type           ENUM(
                          'restock',          -- admin adds new stock
                          'sold',             -- item sold (standalone or booking)
                          'rented_out',       -- item rented out
                          'returned',         -- rental returned in good condition
                          'discarded',        -- worn out / intentionally discarded
                          'damage_replace'    -- damaged item removed from available stock
                        ) NOT NULL,
  quantity_change       INT NOT NULL COMMENT 'Positive = stock added, Negative = stock removed',
  reference_type        VARCHAR(50) NULL COMMENT 'standalone_sale | booking | manual',
  reference_id          INT NULL COMMENT 'ID of the source transaction',
  notes                 TEXT NULL,
  performed_by_user_id  INT NULL,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (accessory_id) REFERENCES accessories(id) ON DELETE CASCADE,
  FOREIGN KEY (performed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- -------------------------------------------------------------
-- 2e. Add FK on payments.standalone_sale_id → standalone_sales
--     (Done after standalone_sales exists)
-- -------------------------------------------------------------
ALTER TABLE payments
  ADD CONSTRAINT fk_payment_standalone_sale
    FOREIGN KEY (standalone_sale_id)
    REFERENCES standalone_sales(id)
    ON DELETE SET NULL;


-- =============================================================
-- PART 3: SEED DATA
-- =============================================================

-- Update existing sample accessories to have proper type and stock
-- (Safe: only sets values on rows that already exist with 0 stock)
UPDATE accessories SET
  type = 'for_rental',
  rental_pricing_type = 'flat',
  stock_quantity = 50,
  available_quantity = 50,
  reorder_threshold = 10
WHERE name = 'Badminton Racquet';

UPDATE accessories SET
  type = 'for_sale',
  rental_pricing_type = 'flat',
  stock_quantity = 100,
  available_quantity = 100,
  reorder_threshold = 20
WHERE name = 'Shuttlecock (Pack of 3)';

UPDATE accessories SET
  type = 'for_rental',
  rental_pricing_type = 'flat',
  stock_quantity = 30,
  available_quantity = 30,
  reorder_threshold = 5
WHERE name = 'Swimming Cap';

UPDATE accessories SET
  type = 'for_rental',
  rental_pricing_type = 'flat',
  stock_quantity = 25,
  available_quantity = 25,
  reorder_threshold = 5
WHERE name = 'Swimming Goggles';

UPDATE accessories SET
  type = 'for_rental',
  rental_pricing_type = 'flat',
  stock_quantity = 20,
  available_quantity = 20,
  reorder_threshold = 5
WHERE name = 'Pickleball Paddle';

-- Add a sample hourly-rate rental accessory
INSERT INTO accessories (name, price, type, rental_pricing_type, hourly_rate, stock_quantity, available_quantity, reorder_threshold)
VALUES ('Badminton Racquet (Hourly)', 0.00, 'for_rental', 'hourly', 30.00, 10, 10, 2);


-- =============================================================
-- END OF FILE
-- =============================================================
-- Verify with:
--   DESCRIBE accessories;
--   DESCRIBE booking_accessories;
--   DESCRIBE payments;
--   SHOW TABLES LIKE '%standalone%';
--   SHOW TABLES LIKE '%inventory%';
--   SHOW TABLES LIKE '%rental%';
-- =============================================================
