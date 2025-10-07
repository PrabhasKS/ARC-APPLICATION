CREATE DATABASE IF NOT EXISTS sports_booking;

USE sports_booking;

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) DEFAULT 'staff'
);

CREATE TABLE IF NOT EXISTS `sports` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS `courts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sport_id` INT,
  `name` VARCHAR(255) NOT NULL,
  `status` ENUM('Available', 'Booked', 'Under Maintenance') DEFAULT 'Available',
    FOREIGN KEY (`sport_id`) REFERENCES `sports`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `bookings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `court_id` INT,
  `sport_id` INT,
  `created_by_user_id` INT,
  `customer_name` VARCHAR(255) NOT NULL,
  `customer_contact` VARCHAR(255) NOT NULL,
  `customer_email` VARCHAR(255),
  `date` DATE NOT NULL,
  `time_slot` VARCHAR(255) NOT NULL,
  `status` VARCHAR(50) DEFAULT 'Booked',
  `payment_mode` ENUM('cash', 'online'),
  `amount_paid` DECIMAL(10, 2),
    FOREIGN KEY (`sport_id`) REFERENCES `sports`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
);

-- Insert some sample data

INSERT INTO `users` (username, password) VALUES ('reception', 'password123');

INSERT INTO `sports` (name, price) VALUES ('Badminton', 300), ('Turf', 1200), ('Table Tennis', 150), ('Swimming', 150), ('Pickleball', 400);

INSERT INTO `courts` (sport_id, name) VALUES 
(1, 'Badminton Court 1'),
(1, 'Badminton Court 2'),
(2, '5v5 Turf 1'),
(3, 'Table Tennis Table 1'),
(4, 'Swimming Lane 1'),
(5, 'Pickleball Court 1');



  ALTER TABLE bookings
  ADD COLUMN balance_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'Pending';

  ALTER TABLE bookings
  ADD COLUMN total_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00;

-- Add capacity to sports table
ALTER TABLE sports ADD COLUMN capacity INT DEFAULT 1;

-- Add slots_booked to bookings table
ALTER TABLE bookings ADD COLUMN slots_booked INT DEFAULT 1;

-- Update capacity for Swimming
UPDATE sports SET capacity = 30 WHERE id = 4;

-- Drop the existing foreign key constraint on sport_id in the bookings table
-- The name of the constraint might be different on your system.
-- If this fails, you can find the correct name by running:
-- SHOW CREATE TABLE bookings;
ALTER TABLE bookings DROP FOREIGN KEY `bookings_ibfk_1`;

-- Add the foreign key constraint back with ON DELETE SET NULL
ALTER TABLE bookings ADD CONSTRAINT `fk_bookings_sport_id` FOREIGN KEY (`sport_id`) REFERENCES `sports`(`id`) ON DELETE SET NULL;

-- Add a new foreign key constraint for court_id with ON DELETE SET NULL
ALTER TABLE bookings ADD CONSTRAINT `fk_bookings_court_id` FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON DELETE SET NULL;

select * from bookings;
select * from courts;

 DELETE FROM bookings WHERE id = 1;



  ALTER TABLE bookings
  MODIFY COLUMN payment_mode VARCHAR(50);
  
      ALTER TABLE bookings
  ADD COLUMN payment_id VARCHAR(255) NULL;
  

ALTER TABLE bookings
ADD COLUMN is_rescheduled BOOLEAN DEFAULT FALSE;

ALTER TABLE bookings
ADD COLUMN discount_amount DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN discount_reason VARCHAR(255);