import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  Supabase credentials not configured. File uploads will be disabled.');
}

export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

const BUCKET_NAME = 'avatars';

/**
 * Upload a file to Supabase Storage
 * @param file - File buffer
 * @param fileName - Name for the file
 * @param contentType - MIME type of the file
 * @returns Public URL of the uploaded file
 */
export async function uploadAvatar(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  // Generate unique filename
  const timestamp = Date.now();
  const uniqueFileName = `${timestamp}-${fileName}`;

  // Upload file
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(uniqueFileName, file, {
      contentType,
      upsert: false,
    });

  if (error) {
    console.error('Supabase upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Delete a file from Supabase Storage
 * @param fileUrl - Public URL of the file to delete
 */
export async function deleteAvatar(fileUrl: string): Promise<void> {
  if (!supabase) {
    return; // Silently fail if Supabase not configured
  }

  try {
    // Extract file path from URL
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1];

    await supabase.storage
      .from(BUCKET_NAME)
      .remove([fileName]);
  } catch (error) {
    console.error('Error deleting avatar:', error);
    // Don't throw - deletion failure shouldn't block other operations
  }
}

/**
 * Check if Supabase is configured and available
 */
export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}
