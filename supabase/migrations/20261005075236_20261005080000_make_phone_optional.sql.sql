/*
# Make phone optional on profiles table

Google OAuth users don't have a phone number at sign-up.
The phone column was NOT NULL UNIQUE, which blocked profile creation.
This migration makes phone nullable and removes the unique constraint
so users can add their WhatsApp number later when setting up a business.
*/

ALTER TABLE profiles ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_phone_key;
