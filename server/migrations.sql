-- Create the new 'payments' table
CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `booking_id` INT NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `payment_mode` VARCHAR(50) NOT NULL,
  `payment_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by_user_id` INT,
  FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
);

-- Add payment_id to payments table
ALTER TABLE payments
ADD COLUMN payment_id VARCHAR(255) NULL;

-- Migrate existing payment_id from the 'bookings' table to the 'payments' table
UPDATE payments p
JOIN bookings b ON p.booking_id = b.id
SET p.payment_id = b.payment_id
WHERE b.payment_id IS NOT NULL;
