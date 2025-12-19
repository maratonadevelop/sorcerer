import React, { useState } from 'react';
import { useAudio } from '@/contexts/AudioProvider';
import { Volume2, VolumeX, Music2, X } from 'lucide-react';

// Further minimized: subtle button, no tooltip, reduced gold usage, smaller panel.
export default function AudioControls() {
  const { currentTrack, muted, toggleMute, volume, volumeUserMax, setVolume, autoplayBlocked, play } = useAudio();
  const [open, setOpen] = useState(false);

  const accent = '#c8a64a';
  const [sliderActive, setSliderActive] = useState(false);

  const maxPct = typeof volumeUserMax === 'number' ? Math.round(volumeUserMax * 100) : 100;

  return (
    <div style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 50 }} className="select-none">
      <button
        aria-label="Áudio"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-center w-10 h-10 rounded-full border text-xs"
        style={{
          background: '#151515',
          borderColor: '#2f2f2f',
          color: accent,
        }}
      >
        <Music2 className="h-5 w-5" />
      </button>
      {open && (
        <div
          className="relative mt-2 w-56 rounded-md p-3 text-[11px]"
          style={{ background: '#101010', border: '1px solid #252525' }}
        >
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar"
            className="absolute top-1.5 right-1.5 p-1 rounded"
            style={{ color: '#777' }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center justify-between gap-2 pr-6">
            <span className="truncate" style={{ color: accent }}>{currentTrack?.title || 'Sem trilha'}</span>
            <button
              onClick={toggleMute}
              aria-label={muted ? 'Desmutar' : 'Mutar'}
              className="p-1 rounded"
              style={{ color: accent }}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="relative flex-1 h-3 select-none" onMouseLeave={() => setSliderActive(false)}>
              {/* Track background */}
              <div className="absolute inset-0 rounded-full" style={{ background:'#1e1e1e', boxShadow:'inset 0 0 0 1px #2a2a2a' }} />
              {/* Filled bar */}
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: Math.round(volume*100)+'%',
                  background: sliderActive
                    ? 'repeating-linear-gradient(45deg,'+accent+', '+accent+' 6px,#b28d33 6px,#b28d33 12px)'
                    : 'linear-gradient(90deg,'+accent+' 0%, #e2c572 100%)',
                  filter: sliderActive ? 'drop-shadow(0 0 4px rgba(200,166,74,0.5))' : 'none',
                  transition: 'width .15s ease'
                }}
              />
              {/* Interactive range hidden visually */}
              <input
                aria-label="Volume"
                type="range"
                min={0}
                max={maxPct}
                step={1}
                value={Math.round(volume * 100)}
                onChange={(e) => setVolume(parseInt(e.target.value, 10) / 100)}
                onMouseDown={() => setSliderActive(true)}
                onMouseUp={() => setSliderActive(false)}
                onTouchStart={() => setSliderActive(true)}
                onTouchEnd={() => setSliderActive(false)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <span style={{ color: '#666', minWidth:34, textAlign:'right' }}>{Math.round(volume*100)}%</span>
          </div>
          {autoplayBlocked && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <div style={{ color: '#777' }}>Autoplay bloqueado</div>
              <button
                onClick={play}
                className="px-2 py-1 rounded border"
                style={{ borderColor: '#2f2f2f', color: accent, background: '#151515' }}
              >
                Tocar
              </button>
            </div>
          )}
          {/* Removed bottom close and play/pause for minimalist, always-playing behavior */}
        </div>
      )}
    </div>
  );
}
