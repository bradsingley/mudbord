-- Add width and height columns to moodboard_images for persisting resize
ALTER TABLE moodboard_images 
ADD COLUMN IF NOT EXISTS width FLOAT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS height FLOAT DEFAULT NULL;
