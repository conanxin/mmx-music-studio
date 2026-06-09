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
import { useState, useCallback } from 'react';
import type { GlobalPlayerTrack } from './lib/globalPlayerTrack';

export default function App() {
  const [currentPlayingTrack, setCurrentPlayingTrack] = useState<GlobalPlayerTrack | null>(null);

  // Phase Product Polish-H: Playback queue state
  const [playbackQueue, setPlaybackQueue] = useState<GlobalPlayerTrack[]>([]);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [queueSourceLabel, setQueueSourceLabel] = useState<string | undefined>();

  // Play a list as queue starting at a given index
  const playQueue = useCallback((tracks: GlobalPlayerTrack[], startIndex = 0, sourceLabel?: string) => {
    if (tracks.length === 0) return;
    const safeIndex = Math.min(Math.max(0, startIndex), tracks.length - 1);
    setPlaybackQueue(tracks);
    setPlaybackIndex(safeIndex);
    setQueueSourceLabel(sourceLabel);
    setCurrentPlayingTrack(tracks[safeIndex]);
  }, []);

  // Add a track to the end of the current queue
  const addToQueue = useCallback((track: GlobalPlayerTrack) => {
    setPlaybackQueue(prev => [...prev, track]);
  }, []);

  // Advance to next track in queue
  const playNextTrack = useCallback(() => {
    setPlaybackQueue(prev => {
      if (prev.length === 0) return prev;
      const nextIndex = playbackIndex + 1;
      if (nextIndex >= prev.length) return prev; // at end, do nothing
      setPlaybackIndex(nextIndex);
      setCurrentPlayingTrack(prev[nextIndex]);
      return prev;
    });
  }, [playbackIndex]);

  // Go to previous track in queue
  const playPreviousTrack = useCallback(() => {
    setPlaybackQueue(prev => {
      if (prev.length === 0) return prev;
      const prevIndex = playbackIndex - 1;
      if (prevIndex < 0) return prev; // at start, do nothing
      setPlaybackIndex(prevIndex);
      setCurrentPlayingTrack(prev[prevIndex]);
      return prev;
    });
  }, [playbackIndex]);

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
        return [];
      }
      // adjust playbackIndex if needed
      if (index < playbackIndex) {
        setPlaybackIndex(playbackIndex - 1);
      } else if (index === playbackIndex) {
        const newIndex = Math.min(playbackIndex, next.length - 1);
        setPlaybackIndex(newIndex);
        setCurrentPlayingTrack(next[newIndex]);
      }
      return next;
    });
  }, [playbackIndex]);

  // Clear the entire queue
  const clearQueue = useCallback(() => {
    setCurrentPlayingTrack(null);
    setPlaybackQueue([]);
    setPlaybackIndex(0);
    setQueueSourceLabel(undefined);
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
                onPlayNext={playNextTrack}
                onPlayPrevious={playPreviousTrack}
                onRemoveFromQueue={removeFromQueue}
                onClearQueue={clearQueue}
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