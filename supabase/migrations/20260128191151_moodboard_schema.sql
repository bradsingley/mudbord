-- ============================================
-- Moodboard App Schema
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Table: moodboard_profiles
-- Stores user profile information
-- ============================================
CREATE TABLE IF NOT EXISTS moodboard_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE moodboard_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for moodboard_profiles
CREATE POLICY "Anyone can view profiles"
    ON moodboard_profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own profile"
    ON moodboard_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON moodboard_profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ============================================
-- Table: moodboard_boards
-- Stores moodboard information
-- ============================================
CREATE TABLE IF NOT EXISTS moodboard_boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID REFERENCES moodboard_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE moodboard_boards ENABLE ROW LEVEL SECURITY;

-- Policies for moodboard_boards
CREATE POLICY "Anyone can view boards"
    ON moodboard_boards FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can create boards"
    ON moodboard_boards FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Board creators can update their boards"
    ON moodboard_boards FOR UPDATE
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Board creators can delete their boards"
    ON moodboard_boards FOR DELETE
    USING (auth.uid() = created_by);

-- ============================================
-- Table: moodboard_images
-- Stores images on boards with positions
-- ============================================
CREATE TABLE IF NOT EXISTS moodboard_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID NOT NULL REFERENCES moodboard_boards(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES moodboard_profiles(id) ON DELETE SET NULL,
    storage_path TEXT NOT NULL,
    position_x FLOAT DEFAULT 100,
    position_y FLOAT DEFAULT 100,
    z_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE moodboard_images ENABLE ROW LEVEL SECURITY;

-- Policies for moodboard_images
CREATE POLICY "Anyone can view images"
    ON moodboard_images FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can add images"
    ON moodboard_images FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update image positions"
    ON moodboard_images FOR UPDATE
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Image uploaders can delete their images"
    ON moodboard_images FOR DELETE
    USING (auth.uid() = uploaded_by);

CREATE POLICY "Board creators can delete any image on their board"
    ON moodboard_images FOR DELETE
    USING (
        auth.uid() IN (
            SELECT created_by FROM moodboard_boards WHERE id = board_id
        )
    );

-- ============================================
-- Trigger: Auto-create profile on user signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.moodboard_profiles (id, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', 'Anonymous')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Storage Bucket: moodboard-images
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'moodboard-images',
    'moodboard-images',
    true,
    10485760, -- 10MB in bytes
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for moodboard-images bucket
CREATE POLICY "Anyone can view moodboard images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'moodboard-images');

CREATE POLICY "Authenticated users can upload moodboard images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'moodboard-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own moodboard images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'moodboard-images' AND auth.uid()::text = (storage.foldername(name))[1]);
