--
-- SQL Commands for Membership Module Redesign
--
-- This script contains DDL statements to transition exactly to the new 
-- Teams and Team Memberships schema.
--

-- 1. Safely remove existing foreign key constraints linked to active_memberships
ALTER TABLE payments DROP FOREIGN KEY fk_membership_payment;
ALTER TABLE membership_leave DROP FOREIGN KEY membership_leave_ibfk_1;
ALTER TABLE team_attendance DROP FOREIGN KEY team_attendance_ibfk_1;

-- 2. Drop the old conflicting tables
DROP TABLE IF EXISTS membership_team;
DROP TABLE IF EXISTS active_memberships;

-- 3. Modify membership_packages
-- Drop the max_team_size as team size is now managed by the Team itself
ALTER TABLE membership_packages DROP COLUMN max_team_size;
-- Rename price to per_person_price for clarity (if not already done)
-- ALTER TABLE membership_packages RENAME COLUMN price TO per_person_price;

-- 4. Create NEW teams Table
CREATE TABLE teams (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  court_id INT NOT NULL,
  time_slot VARCHAR(50) NOT NULL,
  max_players INT NOT NULL DEFAULT 1,
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'expired', or 'terminated'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by_user_id INT NULL,
  FOREIGN KEY (court_id) REFERENCES courts(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 5. Create NEW team_memberships Table
CREATE TABLE team_memberships (
  id INT PRIMARY KEY AUTO_INCREMENT,
  team_id INT NOT NULL,
  member_id INT NOT NULL,
  package_id INT NOT NULL,
  start_date DATE NOT NULL,
  original_end_date DATE NOT NULL,
  current_end_date DATE NOT NULL,
  amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  balance_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  payment_status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  discount_details VARCHAR(255) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'expired', or 'terminated'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES membership_packages(id)
);

-- 6. Modify existing dependency tables to point to the new team_memberships.id instead of active_memberships.id

-- 6a. payments table
-- If membership_id column already exists, we rename it for clarity and point it to team_memberships
ALTER TABLE payments RENAME COLUMN membership_id TO team_membership_id;
ALTER TABLE payments ADD CONSTRAINT fk_team_membership_payment
  FOREIGN KEY (team_membership_id) REFERENCES team_memberships(id) ON DELETE SET NULL;

-- 6b. membership_leave table
ALTER TABLE membership_leave RENAME COLUMN membership_id TO team_membership_id;
ALTER TABLE membership_leave ADD CONSTRAINT fk_membership_leave
  FOREIGN KEY (team_membership_id) REFERENCES team_memberships(id) ON DELETE CASCADE;

-- 6c. team_attendance table
ALTER TABLE team_attendance RENAME COLUMN membership_id TO team_membership_id;
ALTER TABLE team_attendance ADD CONSTRAINT fk_team_attendance_membership
  FOREIGN KEY (team_membership_id) REFERENCES team_memberships(id) ON DELETE CASCADE;

-- 7. Late Fixes (Broken flow restoration)
ALTER TABLE team_memberships ADD COLUMN discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER amount_paid;
