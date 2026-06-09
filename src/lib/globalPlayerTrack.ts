// Shared global player track type — imported by App.tsx and Layout.tsx
// to avoid circular import between those two files
export interface GlobalPlayerTrack {
  id: string;
  title: string;
  audioUrl: string;
  downloadUrl?: string;
  durationText?: string;
  generationSource?: string;
  mode?: string;
}

// Phase Product Polish-I: Playback modes
export type PlaybackMode = 'sequence' | 'repeat-all' | 'repeat-one' | 'shuffle';

// Phase Product Polish-H: Playback queue
export interface GlobalPlaybackQueue {
  tracks: GlobalPlayerTrack[];
  currentIndex: number;
  sourceLabel?: string;
  playbackMode: PlaybackMode;
}

// Phase Product Polish-I: localStorage persisted queue state
export interface PersistedPlaybackState {
  tracks: GlobalPlayerTrack[];
  currentIndex: number;
  sourceLabel?: string;
  playbackMode: PlaybackMode;
  updatedAt: string;
}

// Phase Product Polish-I: playback progress per track
export interface PlaybackProgressMap {
  [trackId: string]: {
    currentTime: number;
    duration?: number;
    updatedAt: string;
  };
}
