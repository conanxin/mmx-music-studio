import { useState, useRef, useEffect } from 'react';
import styles from './WaveformPlayer.module.css';

interface WaveformPlayerProps {
  duration?: number; // seconds, 0 = unknown/mock
  durationText?: string; // e.g. "2:31"
  audioUrl?: string;
  modeLabel?: string;
  disabled?: boolean;
}

function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function WaveformPlayer({
  duration = 0,
  durationText,
  audioUrl,
  modeLabel,
  disabled = false,
}: WaveformPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [audioError, setAudioError] = useState(false);

  const hasAudio = !!audioUrl;
  // Display duration: show "读取中" while audio is loading, then real time
  const isDurationKnown = totalDuration > 0 || !!durationText;
  const displayDuration = durationText
    ? durationText
    : hasAudio && !isDurationKnown
    ? '读取中'
    : totalDuration > 0
    ? formatSeconds(totalDuration)
    : '';

  // Sync audio element when audioUrl changes
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;

    if (audioUrl) {
      audio.src = audioUrl;
      audio.load();
    } else {
      audio.src = '';
    }
    setPlaying(false);
    setCurrentTime(0);
    setAudioError(false);
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current || !hasAudio || disabled) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {
        setAudioError(true);
      });
    }
  };

  // Sync play state from audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => { setPlaying(false); setCurrentTime(0); };
    const onError = () => setAudioError(true);
    const onCanPlay = () => {
      if (audio.duration) setTotalDuration(audio.duration);
    };
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration) setTotalDuration(audio.duration);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('timeupdate', onTimeUpdate);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('timeupdate', onTimeUpdate);
    };
  });

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  const displayCurrent = formatSeconds(currentTime);

  // Mock waveform bars
  const bars = Array.from({ length: 48 }, (_, i) => {
    const heights = [30, 45, 60, 75, 90, 60, 45, 75, 55, 80, 65, 90, 50, 70, 85, 60, 45, 75, 80, 55, 90, 65, 50, 80, 70, 60, 85, 45, 75, 55, 90, 60, 80, 50, 70, 85, 45, 65, 75, 55, 90, 60, 80, 50, 70, 65, 80, 55];
    return heights[i % heights.length];
  });

  return (
    <div className={styles.player}>
      {/* Waveform */}
      <div className={styles.waveform}>
        <div className={styles.bars}>
          {bars.map((h, i) => (
            <div
              key={i}
              className={`${styles.bar} ${i < (progress / 100) * bars.length ? styles.active : ''}`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        {totalDuration > 0 && (
          <div className={styles.progress} style={{ width: `${progress}%` }} />
        )}
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <button
          className={styles.playBtn}
          onClick={togglePlay}
          disabled={disabled || (!hasAudio && !duration)}
          aria-label={playing ? '暂停' : '播放'}
        >
          {playing ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1"/>
              <rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        <div className={styles.time}>
          <span>{hasAudio ? displayCurrent : '0:00'}</span>
          <span className={styles.separator}>/</span>
          <span>{displayDuration}</span>
        </div>

        {modeLabel && (
          <span className={styles.modeTag}>{modeLabel}</span>
        )}
      </div>

      {/* Audio error state */}
      {audioError && hasAudio && (
        <p className={styles.audioError}>音频暂时无法播放</p>
      )}
    </div>
  );
}
