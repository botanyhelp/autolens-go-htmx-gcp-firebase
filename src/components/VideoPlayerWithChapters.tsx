import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize2, Bookmark, CheckCircle2, Video as VideoIcon } from 'lucide-react';
import { VideoReview, VideoChapter } from '../types/estimate';
import { formatTime } from '../utils/videoUtils';

interface VideoPlayerProps {
  video?: VideoReview;
  autoPlay?: boolean;
  onAddChapter?: (chapter: Omit<VideoChapter, 'id'>) => void;
  allowChapterCreation?: boolean;
}

export const VideoPlayerWithChapters: React.FC<VideoPlayerProps> = ({
  video,
  autoPlay = false,
  onAddChapter,
  allowChapterCreation = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video?.durationSeconds || 0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [activeChapter, setActiveChapter] = useState<VideoChapter | null>(null);

  // New chapter inline form
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterNote, setChapterNote] = useState('');

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const handleTimeUpdate = () => {
      const cur = vid.currentTime;
      setCurrentTime(cur);

      // Find current active chapter
      if (video?.chapters && video.chapters.length > 0) {
        const sorted = [...video.chapters].sort((a, b) => b.timeSeconds - a.timeSeconds);
        const match = sorted.find((c) => cur >= c.timeSeconds);
        setActiveChapter(match || video.chapters[0] || null);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(vid.duration || video?.durationSeconds || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    vid.addEventListener('timeupdate', handleTimeUpdate);
    vid.addEventListener('loadedmetadata', handleLoadedMetadata);
    vid.addEventListener('ended', handleEnded);

    return () => {
      vid.removeEventListener('timeupdate', handleTimeUpdate);
      vid.removeEventListener('loadedmetadata', handleLoadedMetadata);
      vid.removeEventListener('ended', handleEnded);
    };
  }, [video]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const jumpToSeconds = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = seconds;
    setCurrentTime(seconds);
    if (!isPlaying) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const handleRateChange = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        videoRef.current.requestFullscreen().catch(() => {});
      }
    }
  };

  const submitNewChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapterTitle.trim() || !onAddChapter) return;

    onAddChapter({
      timeSeconds: Math.floor(currentTime),
      title: chapterTitle.trim(),
      note: chapterNote.trim() || undefined,
    });

    setChapterTitle('');
    setChapterNote('');
    setShowChapterModal(false);
  };

  if (!video || !video.url) {
    return (
      <div className="aspect-video w-full rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mb-3">
          <VideoIcon className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-slate-200">No Walkaround Video Recorded Yet</h4>
        <p className="text-xs text-slate-400 max-w-sm mt-1">
          Record a live walkaround inspection from your phone/camera or upload a video file to give the customer complete visual transparency.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Video Container */}
      <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-2xl group">
        <video
          ref={videoRef}
          src={video.url}
          playsInline
          muted={isMuted}
          className="w-full h-full object-contain cursor-pointer"
          onClick={togglePlay}
        />

        {/* Floating Active Chapter Indicator Overlay */}
        {activeChapter && (
          <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-lg shadow-lg text-xs pointer-events-none transition-all flex items-center gap-2 max-w-[85%]">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-semibold text-white truncate">{activeChapter.title}</span>
            <span className="text-slate-400 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded font-mono">
              {formatTime(activeChapter.timeSeconds)}
            </span>
          </div>
        )}

        {/* Video Overlay Controls */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-6 flex flex-col gap-2 opacity-95 transition-opacity">
          
          {/* Progress / Timeline Bar with Chapter Pins */}
          <div className="relative flex items-center w-full">
            <input
              type="range"
              min={0}
              max={duration || 10}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-slate-700/80 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:h-2 transition-all"
            />

            {/* Chapter Marker Ticks on the timeline */}
            {duration > 0 &&
              video.chapters?.map((chap) => {
                const posPercent = (chap.timeSeconds / duration) * 100;
                return (
                  <button
                    key={chap.id}
                    title={`${chap.title} (${formatTime(chap.timeSeconds)})`}
                    onClick={() => jumpToSeconds(chap.timeSeconds)}
                    style={{ left: `${Math.min(posPercent, 98)}%` }}
                    className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-400 border border-black shadow hover:scale-150 transition cursor-pointer"
                  />
                );
              })}
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2.5">
              <button
                onClick={togglePlay}
                className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition cursor-pointer"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
              </button>

              <button
                onClick={() => jumpToSeconds(0)}
                className="text-slate-400 hover:text-white transition p-1 cursor-pointer"
                title="Restart"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <div className="font-mono text-[11px] text-slate-300">
                <span>{formatTime(currentTime)}</span>
                <span className="text-slate-500 mx-1">/</span>
                <span>{formatTime(duration)}</span>
              </div>

              <button
                onClick={() => setIsMuted(!isMuted)}
                className="text-slate-400 hover:text-white transition p-1 cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Playback speed buttons */}
              <div className="bg-slate-800/80 rounded-md p-0.5 flex text-[10px] font-mono">
                {[1, 1.25, 1.5].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => handleRateChange(rate)}
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${
                      playbackRate === rate ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>

              {allowChapterCreation && (
                <button
                  onClick={() => setShowChapterModal(true)}
                  className="flex items-center gap-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer"
                >
                  <Bookmark className="w-3 h-3" />
                  <span>Pin Note</span>
                </button>
              )}

              <button
                onClick={toggleFullscreen}
                className="text-slate-400 hover:text-white transition p-1 cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chapters list / timeline navigation */}
      {video.chapters && video.chapters.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-amber-400" />
              Mechanic Key Inspection Moments ({video.chapters.length})
            </span>
            <span className="text-[10px] text-slate-500">Tap to jump directly to timestamp</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {video.chapters.map((chap) => {
              const isCurrent = activeChapter?.id === chap.id;
              return (
                <button
                  key={chap.id}
                  onClick={() => jumpToSeconds(chap.timeSeconds)}
                  className={`text-left p-2 rounded-lg border text-xs transition cursor-pointer flex flex-col justify-between ${
                    isCurrent
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-200 shadow-sm'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-semibold truncate text-[11px]">{chap.title}</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-950/60 border border-slate-700/40 text-amber-400">
                      {formatTime(chap.timeSeconds)}
                    </span>
                  </div>
                  {chap.note && (
                    <p className="text-[10px] text-slate-400 line-clamp-2 italic">
                      "{chap.note}"
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Inline Chapter Add Modal */}
      {showChapterModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-amber-400" />
              Pin Timestamp at {formatTime(currentTime)}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Tag this exact frame for the customer so they can inspect the worn or damaged part.
            </p>

            <form onSubmit={submitNewChapter} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Observation / Issue Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scored rotor surface / metal shaving"
                  value={chapterTitle}
                  onChange={(e) => setChapterTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Technician Note (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Thickness measured at 1.8mm vs 3mm legal limit."
                  value={chapterNote}
                  onChange={(e) => setChapterNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChapterModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer"
                >
                  Save Timestamp Pin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
