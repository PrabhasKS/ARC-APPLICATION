--
-- SQL Commands for Membership Module
--
-- This script contains DDL statements to:
-- 1. Modify the existing `payments` table to include a foreign key for memberships.
-- 2. Create new tables required for the membership module.
--
-- Designed to be safe for production environments.
--

--
-- Part 1: Modifications to Existing Tables
--

-- Modifying the 'payments' table to integrate membership payments.
--
-- Rationale:
-- To track revenue from the new membership module within the existing financial system,
-- we need a way to associate a payment with a membership purchase.
--
-- Changes:
--   - Adds a `membership_id` column that is a foreign key to the `active_memberships` table.
--   - This column is `NULL`able because existing payments are for daily bookings (`booking_id`)
--     and should not be affected. A payment will have either a `booking_id` OR a `membership_id`,
--     but not both.
--   - `ON DELETE SET NULL`: This is a safe constraint for production. If an active membership
--     record is ever deleted (which should be a controlled administrative action), the
--     financial record in the `payments` table will be preserved, but its link to the
--     deleted membership will be severed. This prevents accidental loss of financial history.
--
ALTER TABLE payments
ADD COLUMN membership_id INT NULL;

-- Note: The foreign key constraint for `membership_id` can be added AFTER the `active_memberships` table is created.
-- We'll add it at the end of this script to ensure `active_memberships` exists first.


--
-- Part 2: New Tables for the Membership Module
--

-- 1. Members Table
-- Purpose: Stores a record of all individual club members (customers).
--
CREATE TABLE members (
  id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(25) NOT NULL UNIQUE,
  email VARCHAR(255) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Membership Packages Table
-- Purpose: Defines the templates for membership plans (e.g., 1-month, 3-month).
--
CREATE TABLE membership_packages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  sport_id INT NOT NULL,
  duration_days INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  max_team_size INT NOT NULL DEFAULT 1,
  details TEXT NULL,
  FOREIGN KEY (sport_id) REFERENCES sports(id)
);

-- 3. Active Memberships Table
-- Purpose: Tracks active membership subscriptions purchased by teams/groups.
--
CREATE TABLE active_memberships (
  id INT PRIMARY KEY AUTO_INCREMENT,
  package_id INT NOT NULL,
  court_id INT NOT NULL,
  start_date DATE NOT NULL,
  original_end_date DATE NOT NULL,
  current_end_date DATE NOT NULL,
  final_price DECIMAL(10, 2) NOT NULL,
  discount_details VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (package_id) REFERENCES membership_packages(id),
  FOREIGN KEY (court_id) REFERENCES courts(id)
);

-- 4. Membership Team Table
-- Purpose: Links multiple members from the 'members' table to a single active membership, forming a team.
--
CREATE TABLE membership_team (
  membership_id INT NOT NULL,
  member_id INT NOT NULL,
  PRIMARY KEY (membership_id, member_id),
  FOREIGN KEY (membership_id) REFERENCES active_memberships(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- 5. Membership Leave Table
-- Purpose: Manages emergency leave requests and compensation for active memberships.
--
CREATE TABLE membership_leave (
  id INT PRIMARY KEY AUTO_INCREMENT,
  membership_id INT NOT NULL,
  leave_days INT NOT NULL,
  reason TEXT NULL,
  status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  compensation_applied BOOLEAN NOT NULL DEFAULT FALSE,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (membership_id) REFERENCES active_memberships(id) ON DELETE CASCADE
);

-- 6. Membership Attendance Table
-- Purpose: Records the daily attendance/check-in of each member of a team.
--
CREATE TABLE membership_attendance (
  id INT PRIMARY KEY AUTO_INCREMENT,
  membership_id INT NOT NULL,
  member_id INT NOT NULL,
  check_in_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), -- Ensure a primary key for efficient lookups
  FOREIGN KEY (membership_id) REFERENCES active_memberships(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- 7. Facility Holidays Table
-- Purpose: A record of dates when the facility is closed for maintenance, tournaments, etc.
--
CREATE TABLE facility_holidays (
  id INT PRIMARY KEY AUTO_INCREMENT,
  holiday_date DATE NOT NULL UNIQUE,
  reason VARCHAR(255) NOT NULL
);

-- Adding the foreign key constraint for `membership_id` to the `payments` table
-- This is done after `active_memberships` table is created to ensure referential integrity.
ALTER TABLE payments
ADD CONSTRAINT fk_membership_payment
  FOREIGN KEY (membership_id) REFERENCES active_memberships(id)
  ON DELETE SET NULL;



ALTER TABLE payments MODIFY COLUMN booking_id INT NULL;

ALTER TABLE active_memberships
ADD COLUMN time_slot VARCHAR(50) NOT NULL;

DROP TABLE membership_attendance;
-- 8. Team Attendance Table
  CREATE TABLE team_attendance (
    id INT PRIMARY KEY AUTO_INCREMENT,
    membership_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    marked_by_user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_attendance (membership_id, attendance_date),
    FOREIGN KEY (membership_id) REFERENCES active_memberships(id) ON DELETE CASCADE,
    FOREIGN KEY (marked_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);