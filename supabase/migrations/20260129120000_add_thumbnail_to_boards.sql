-- Add thumbnail_image_id column to moodboard_boards
ALTER TABLE moodboard_boards 
ADD COLUMN IF NOT EXISTS thumbnail_image_id UUID REFERENCES moodboard_images(id) ON DELETE SET NULL;
