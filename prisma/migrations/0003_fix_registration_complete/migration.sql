-- Fix existing registered users incorrectly set to registration_complete = false
-- Users with a real password hash are fully registered
UPDATE "users" SET "registration_complete" = true
WHERE "password_hash" != '' AND "registration_complete" = false;
