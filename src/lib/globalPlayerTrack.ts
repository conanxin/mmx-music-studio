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

// Phase Product Polish-H: Playback queue
export interface GlobalPlaybackQueue {
  tracks: GlobalPlayerTrack[];
  currentIndex: number;
  sourceLabel?: string;
}
