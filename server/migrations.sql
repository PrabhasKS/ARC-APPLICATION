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

-- Migrate existing payments from the 'bookings' table to the 'payments' table
INSERT INTO `payments` (booking_id, amount, payment_mode, created_by_user_id)
SELECT id, amount_paid, payment_mode, created_by_user_id
FROM `bookings`
WHERE amount_paid > 0;
