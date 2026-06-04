import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Trash2 } from 'lucide-react';

function formatAudioTime(value) {
  if (!Number.isFinite(value) || value <= 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function CompactAudioPreview({
  src,
  name = '',
  onRemove,
  removeLabel = 'Supprimer le son',
}) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    setIsPlaying(false);
    setDuration(0);
    setCurrentTime(0);
  }, [src]);

  if (!src) return null;

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
      return;
    }
    audio.pause();
  };

  return (
    <div className="compact-audio-preview">
      <audio
        ref={audioRef}
        preload="metadata"
        src={src}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />
      <button
        type="button"
        className="compact-audio-preview__play"
        aria-label={isPlaying ? 'Mettre en pause' : 'Lire le son'}
        onClick={togglePlayback}
      >
        {isPlaying ? <Pause aria-hidden="true" size={14} /> : <Play aria-hidden="true" size={14} />}
      </button>
      <div className="compact-audio-preview__meta">
        <strong>{name || 'Son importe'}</strong>
        <span>{formatAudioTime(currentTime)} / {formatAudioTime(duration)}</span>
      </div>
      <button
        type="button"
        className="compact-audio-preview__remove"
        aria-label={removeLabel}
        title={removeLabel}
        onClick={onRemove}
      >
        <Trash2 aria-hidden="true" size={14} />
      </button>
    </div>
  );
}
