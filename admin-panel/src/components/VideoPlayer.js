import React, { useEffect, useState } from 'react';
import { IconX } from './Icons';

export default function VideoPlayer({ videoUrl, title, onClose }) {
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    setLoadError(false);
  }, [videoUrl]);

  if (!videoUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl animate-scale-in overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#1c1d1f] to-[#2d2d30]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold text-[14px]">Now Playing</p>
              <p className="text-gray-400 text-[12px] truncate max-w-[300px]">{title}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
            <IconX className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Video Player */}
        <div className="aspect-video bg-black relative">
          {loadError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center">
              <p className="font-semibold mb-2">Video failed to load</p>
              <p className="text-sm text-white/70 mb-4">The stream URL may have expired. Close and open the lesson again.</p>
              <button
                type="button"
                onClick={() => setLoadError(false)}
                className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-sm font-semibold"
              >
                Retry
              </button>
            </div>
          ) : (
            <video
              key={videoUrl}
              src={videoUrl}
              controls
              autoPlay
              playsInline
              preload="auto"
              className="w-full h-full"
              controlsList="nodownload"
              onError={() => setLoadError(true)}
            >
              Your browser does not support the video tag.
            </video>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#f5f4f0] border-t border-[#e8e6e0] flex items-center justify-between">
          <p className="text-[11px] text-[#6a6f73]">
            Streamed via platform API for smooth playback
          </p>
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-brand-600 hover:text-brand-700 font-medium"
          >
            Open in new tab →
          </a>
        </div>
      </div>
    </div>
  );
}