-- Create storage bucket for moodboard images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'moodboard-images',
    'moodboard-images',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies (drop if exists first to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can view moodboard images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload moodboard images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own moodboard images" ON storage.objects;

-- Recreate policies
CREATE POLICY "Anyone can view moodboard images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'moodboard-images');

CREATE POLICY "Authenticated users can upload moodboard images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'moodboard-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own moodboard images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'moodboard-images' AND auth.uid()::text = (storage.foldername(name))[1]);
