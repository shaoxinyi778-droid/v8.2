
export interface Video {
  id: number;
  title: string;
  duration: string;
  orientation: 'portrait' | 'landscape';
  hasHuman: boolean;
  hasSubtitles?: boolean; // New field for subtitle detection
  color: string;
  heightClass: string; // Tailwind height class for masonry simulation
  uploadDate: string;
  isDeleted?: boolean;
  isFavorite?: boolean;
  url?: string;        // Real video URL (blob or remote)
  thumbnail?: string;  // Base64 thumbnail image
  projectId?: number;  // ID of the custom project folder
}

export interface Project {
  id: number;
  name: string;
  createdAt: string;
}

export type FilterFolder = 
  | 'all' 
  | 'fav' 
  | 'trash' 
  | string; // Allow dynamic strings like 'project-123'

export interface TopFilterState {
  orientation: 'all' | 'portrait' | 'landscape';
  content: 'all' | 'human' | 'scenery'; // 'scenery' maps to 'empty' in UI
  subtitle: 'all' | 'with' | 'without';
}

export type LogType = 'loading' | 'success' | 'ai' | 'done' | 'error';

export interface LogItem {
  id: string;
  text: string;
  type: LogType;
}