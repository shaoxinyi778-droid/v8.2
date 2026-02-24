import { supabase } from '../lib/supabaseClient';
import { Video, Project } from '../types';

// --- Auth Helpers ---
export const getCurrentUser = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
};

// --- Projects ---
export const fetchRemoteProjects = async (): Promise<Project[]> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return data.map((p: any) => ({
    id: p.id,
    name: p.name,
    createdAt: p.created_at
  }));
};

export const createRemoteProject = async (name: string): Promise<Project | null> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("User not logged in");

  const { data, error } = await supabase
    .from('projects')
    .insert([{ name, user_id: user.id }])
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    createdAt: data.created_at
  };
};

export const deleteRemoteProject = async (id: number) => {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
};

// --- Videos ---

// Helper to get public URL for storage assets
const getPublicUrl = (path: string) => {
  if (!path) return '';
  const { data } = supabase.storage.from('assets').getPublicUrl(path);
  return data.publicUrl;
};

export const fetchRemoteVideos = async (): Promise<Video[]> => {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data.map((v: any) => ({
    id: v.id,
    title: v.title,
    duration: v.duration,
    orientation: v.orientation as 'portrait' | 'landscape',
    hasHuman: v.has_human,
    hasSubtitles: v.has_subtitles, // Map from DB
    color: v.color || 'bg-gray-100',
    heightClass: v.height_class || (v.orientation === 'portrait' ? 'aspect-[9/16]' : 'aspect-video'),
    uploadDate: new Date(v.created_at).toISOString().split('T')[0],
    isDeleted: v.is_deleted,
    isFavorite: v.is_favorite,
    url: getPublicUrl(v.storage_path),
    thumbnail: v.thumbnail_path ? getPublicUrl(v.thumbnail_path) : undefined,
    projectId: v.project_id
  }));
};

export const uploadVideoToCloud = async (
  file: File,
  meta: {
    duration: string;
    orientation: 'portrait' | 'landscape';
    hasHuman: boolean;
    hasSubtitles: boolean;
    thumbnailBase64: string;
    width: number;
    height: number;
    projectId?: number;
  }
): Promise<Video> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("User not logged in");

  const timestamp = Date.now();
  const fileExt = file.name.split('.').pop();
  const filePath = `${user.id}/${timestamp}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  
  // 1. Upload Video File
  const { error: uploadError } = await supabase.storage
    .from('assets')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  // 2. Upload Thumbnail (Convert Base64 to Blob)
  let thumbPath = '';
  if (meta.thumbnailBase64) {
    const res = await fetch(meta.thumbnailBase64);
    const blob = await res.blob();
    thumbPath = `${user.id}/thumbs/${timestamp}_thumb.jpg`;
    await supabase.storage.from('assets').upload(thumbPath, blob);
  }

  // 3. Insert Database Record
  const { data, error: dbError } = await supabase
    .from('videos')
    .insert([{
      user_id: user.id,
      title: file.name,
      storage_path: filePath,
      thumbnail_path: thumbPath,
      duration: meta.duration,
      orientation: meta.orientation,
      has_human: meta.hasHuman,
      has_subtitles: meta.hasSubtitles, // Insert to DB
      color: 'bg-gray-100', // Simplified color logic
      height_class: meta.orientation === 'portrait' ? 'aspect-[9/16]' : 'aspect-video',
      project_id: meta.projectId,
      is_deleted: false,
      is_favorite: false
    }])
    .select()
    .single();

  if (dbError) throw dbError;

  return {
    id: data.id,
    title: data.title,
    duration: data.duration,
    orientation: data.orientation,
    hasHuman: data.has_human,
    hasSubtitles: data.has_subtitles,
    color: data.color,
    heightClass: data.height_class,
    uploadDate: new Date(data.created_at).toISOString().split('T')[0],
    url: getPublicUrl(filePath),
    thumbnail: thumbPath ? getPublicUrl(thumbPath) : undefined,
    projectId: data.project_id,
    isDeleted: false,
    isFavorite: false
  };
};

export const updateRemoteVideoStatus = async (id: number, updates: Partial<Video>) => {
  // Map frontend fields to DB columns
  const dbUpdates: any = {};
  if (updates.isFavorite !== undefined) dbUpdates.is_favorite = updates.isFavorite;
  if (updates.isDeleted !== undefined) dbUpdates.is_deleted = updates.isDeleted;
  
  const { error } = await supabase
    .from('videos')
    .update(dbUpdates)
    .eq('id', id);

  if (error) throw error;
};

export const deleteRemoteVideoPermanently = async (id: number, storagePath?: string, thumbnailPath?: string) => {
  // 1. Delete from DB
  const { error } = await supabase.from('videos').delete().eq('id', id);
  if (error) throw error;

  // 2. Delete files from Storage (Fire and forget, or await)
  // We need the paths. Ideally, the caller passes them, or we fetch them first.
  if (storagePath) {
    await supabase.storage.from('assets').remove([storagePath]);
  }
  if (thumbnailPath) {
    await supabase.storage.from('assets').remove([thumbnailPath]);
  }
};