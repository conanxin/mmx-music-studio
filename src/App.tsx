import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SettingsProvider } from './lib/settingsStore';
import Layout from './components/Layout';
import Home from './features/home/Home';
import Studio from './features/studio/Studio';
import Library from './features/library/Library';
import Settings from './features/settings/Settings';
import Docs from './features/docs/Docs';
import Jobs from './features/jobs/Jobs';
import PreviewAccessGate from './components/PreviewAccessGate';
import { useState, useCallback, useRef } from 'react';
import type { GlobalPlayerTrack, PlaybackMode } from './lib/globalPlayerTrack';

const QUEUE_KEY = 'mmx-studio:playback-queue:v1';

// Phase Product Polish-I: Load persisted queue from localStorage
function loadPersistedQueue(): { tracks: GlobalPlayerTrack[]; currentIndex: number; sourceLabel?: string; playbackMode: PlaybackMode } | null {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.tracks) || data.tracks.length === 0) return null;
    // Validate at least id + audioUrl present
    if (!data.tracks[0]?.id || !data.tracks[0]?.audioUrl) return null;
    return {
      tracks: data.tracks,
      currentIndex: typeof data.currentIndex === 'number' ? data.currentIndex : 0,
      sourceLabel: data.sourceLabel,
      playbackMode: (data.playbackMode || 'sequence'),
    };
  } catch {
    return null;
  }
}

// Phase Product Polish-I: Save queue + mode to localStorage
function saveQueueToStorage(tracks: GlobalPlayerTrack[], currentIndex: number, sourceLabel: string | undefined, playbackMode: PlaybackMode) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify({
      tracks,
      currentIndex,
      sourceLabel,
      playbackMode,
      updatedAt: new Date().toISOString(),
    }));
  } catch { /* storage full — ignore */ }
}

// Phase Product Polish-I: Clear queue from localStorage
function clearQueueFromStorage() {
  try { localStorage.removeItem(QUEUE_KEY); } catch { /* ignore */ }
}

// Phase Product Polish-I: Pick next track index based on mode
function getNextTrackIndex(tracks: GlobalPlayerTrack[], currentIndex: number, playbackMode: PlaybackMode): number {
  if (tracks.length === 0) return currentIndex;
  switch (playbackMode) {
    case 'repeat-one':
      return currentIndex; // replay same
    case 'shuffle': {
      // Random, avoid same track if queue > 1
      const available = tracks.map((_, i) => i).filter(i => i !== currentIndex);
      if (available.length === 0) return currentIndex;
      return available[Math.floor(Math.random() * available.length)];
    }
    case 'repeat-all':
      return (currentIndex + 1) % tracks.length;
    case 'sequence':
    default:
      return currentIndex + 1 < tracks.length ? currentIndex + 1 : currentIndex;
  }
}

export default function App() {
  const [currentPlayingTrack, setCurrentPlayingTrack] = useState<GlobalPlayerTrack | null>(null);

  // Phase Product Polish-H: Playback queue state
  const [playbackQueue, setPlaybackQueue] = useState<GlobalPlayerTrack[]>([]);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [queueSourceLabel, setQueueSourceLabel] = useState<string | undefined>();

  // Phase Product Polish-I: Playback mode
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('sequence');

  // Phase Product Polish-I: Restore queue from localStorage on mount
  const restoredRef = useRef(false);
  if (!restoredRef.current) {
    const persisted = loadPersistedQueue();
    if (persisted && persisted.tracks.length > 0) {
      playbackQueue.length === 0 && setPlaybackQueue(persisted.tracks);
      setPlaybackIndex(persisted.currentIndex);
      setQueueSourceLabel(persisted.sourceLabel);
      setCurrentPlayingTrack(persisted.tracks[persisted.currentIndex] || null);
      setPlaybackMode(persisted.playbackMode || 'sequence');
    }
    restoredRef.current = true;
  }

  // Play a list as queue starting at a given index
  const playQueue = useCallback((tracks: GlobalPlayerTrack[], startIndex = 0, sourceLabel?: string) => {
    if (tracks.length === 0) return;
    const safeIndex = Math.min(Math.max(0, startIndex), tracks.length - 1);
    setPlaybackQueue(tracks);
    setPlaybackIndex(safeIndex);
    setQueueSourceLabel(sourceLabel);
    setCurrentPlayingTrack(tracks[safeIndex]);
    saveQueueToStorage(tracks, safeIndex, sourceLabel, playbackMode);
  }, [playbackMode]);

  // Phase Product Polish-I: Add to queue + persist
  const addToQueue = useCallback((track: GlobalPlayerTrack) => {
    setPlaybackQueue(prev => {
      const next = [...prev, track];
      saveQueueToStorage(next, playbackIndex, queueSourceLabel, playbackMode);
      return next;
    });
  }, [playbackIndex, queueSourceLabel, playbackMode]);

  // Phase Product Polish-I: Advance based on playbackMode
  const playNextTrack = useCallback(() => {
    setPlaybackQueue(prev => {
      if (prev.length === 0) return prev;
      const nextIndex = getNextTrackIndex(prev, playbackIndex, playbackMode);
      setPlaybackIndex(nextIndex);
      setCurrentPlayingTrack(prev[nextIndex]);
      saveQueueToStorage(prev, nextIndex, queueSourceLabel, playbackMode);
      return prev;
    });
  }, [playbackIndex, playbackMode, queueSourceLabel]);

  // Go to previous track in queue
  const playPreviousTrack = useCallback(() => {
    setPlaybackQueue(prev => {
      if (prev.length === 0) return prev;
      const prevIndex = playbackIndex - 1;
      if (prevIndex < 0) return prev; // at start, do nothing
      setPlaybackIndex(prevIndex);
      setCurrentPlayingTrack(prev[prevIndex]);
      saveQueueToStorage(prev, prevIndex, queueSourceLabel, playbackMode);
      return prev;
    });
  }, [playbackIndex, queueSourceLabel, playbackMode]);

  // Remove a track from queue by index
  const removeFromQueue = useCallback((index: number) => {
    setPlaybackQueue(prev => {
      if (index < 0 || index >= prev.length) return prev;
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        setCurrentPlayingTrack(null);
        setPlaybackQueue([]);
        setPlaybackIndex(0);
        setQueueSourceLabel(undefined);
        clearQueueFromStorage();
        return [];
      }
      // adjust playbackIndex if needed
      let newIndex = playbackIndex;
      if (index < playbackIndex) {
        newIndex = playbackIndex - 1;
      } else if (index === playbackIndex) {
        newIndex = Math.min(playbackIndex, next.length - 1);
      }
      setPlaybackIndex(newIndex);
      setCurrentPlayingTrack(next[newIndex]);
      saveQueueToStorage(next, newIndex, queueSourceLabel, playbackMode);
      return next;
    });
  }, [playbackIndex, queueSourceLabel, playbackMode]);

  // Clear the entire queue
  const clearQueue = useCallback(() => {
    setCurrentPlayingTrack(null);
    setPlaybackQueue([]);
    setPlaybackIndex(0);
    setQueueSourceLabel(undefined);
    clearQueueFromStorage();
  }, []);

  return (
    <SettingsProvider>
      <PreviewAccessGate>
        <BrowserRouter>
          <Routes>
 <Route path="/" element={
              <Layout
                currentPlayingTrack={currentPlayingTrack}
                onSetPlayingTrack={setCurrentPlayingTrack}
                playbackQueue={playbackQueue}
                playbackIndex={playbackIndex}
                queueSourceLabel={queueSourceLabel}
                playbackMode={playbackMode}
                onPlaybackModeChange={setPlaybackMode}
                onPlayNext={playNextTrack}
                onPlayPrevious={playPreviousTrack}
                onRemoveFromQueue={removeFromQueue}
                onClearQueue={clearQueue}
                onJumpToQueueItem={(index: number) => {
                  if (index < 0 || index >= playbackQueue.length) return;
                  setPlaybackIndex(index);
                  setCurrentPlayingTrack(playbackQueue[index]);
                  saveQueueToStorage(playbackQueue, index, queueSourceLabel, playbackMode);
                }}
              />
            }>
              <Route index element={<Home />} />
              <Route path="studio" element={
                <Studio
                  currentPlayingTrack={currentPlayingTrack}
                  onSetPlayingTrack={setCurrentPlayingTrack}
                />
              } />
              <Route path="library" element={
                <Library
                  currentPlayingTrack={currentPlayingTrack}
                  onSetPlayingTrack={setCurrentPlayingTrack}
                  onPlayQueue={playQueue}
                  onAddToQueue={addToQueue}
                />
              } />
              <Route path="settings" element={<Settings />} />
              <Route path="docs" element={<Docs />} />
              <Route path="jobs" element={<Jobs />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </PreviewAccessGate>
    </SettingsProvider>
  );
}