import React, { useState, useRef, useEffect } from 'react';
import Spinner from '../common/Spinner';

interface AudioPlayerProps {
    src: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src }) => {
    const mediaRef = useRef<HTMLVideoElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const media = mediaRef.current;
        if (!media) return;

        // --- Event Handlers ---
        const onReady = () => {
            if (media.duration && isFinite(media.duration)) {
                setDuration(media.duration);
                setIsReady(true);
                setError(null);
            }
        };

        const onTimeUpdate = () => {
            setCurrentTime(media.currentTime);
        };
        
        const onEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
        };

        const onError = () => {
            const err = media.error;
            // Only log if src is present to avoid noise on initial render
            if (media.src && media.src !== window.location.href) {
                console.error(`Media Error: Code ${err?.code}, Message: ${err?.message}`);
            }
            let errorMessage = 'Could not play audio.';
            if (err?.code === 4) { // MEDIA_ERR_SRC_NOT_SUPPORTED
                 errorMessage = 'Audio format not supported or source unavailable.';
            }
            setError(errorMessage);
            setIsReady(false);
        };
        
        const onStalled = () => {
            // Only warn if we actually have a valid source we are trying to play
            if (media.src && media.src !== window.location.href && isPlaying) {
                console.warn("Media playback stalled due to insufficient data.");
            }
        };

        // --- Attach Listeners ---
        media.addEventListener('canplay', onReady);
        media.addEventListener('timeupdate', onTimeUpdate);
        media.addEventListener('ended', onEnded);
        media.addEventListener('error', onError);
        media.addEventListener('stalled', onStalled);

        // --- Source Loading Logic ---
        if (media.src !== src) {
            // Reset all state for the new source.
            setIsPlaying(false);
            setIsReady(false);
            setError(null);
            setDuration(0);
            setCurrentTime(0);

            if (src && src.trim() !== '') {
                media.src = src;
                media.load();
            } else {
                media.pause();
                media.removeAttribute('src');
                // Don't call load() on empty src to avoid error
            }
        }

        // --- Cleanup on unmount ---
        return () => {
            media.removeEventListener('canplay', onReady);
            media.removeEventListener('timeupdate', onTimeUpdate);
            media.removeEventListener('ended', onEnded);
            media.removeEventListener('error', onError);
            media.removeEventListener('stalled', onStalled);
        };
    }, [src]);

    const togglePlayPause = () => {
        if (!isReady || error || !src) return;
        const media = mediaRef.current;
        if (!media) return;

        if (isPlaying) {
            media.pause();
            setIsPlaying(false);
        } else {
            setIsPlaying(true);
            const playPromise = media.play();
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    if (err.name !== 'AbortError') {
                        console.error('Playback failed:', err);
                        setError("Playback failed.");
                        setIsPlaying(false);
                    }
                });
            }
        }
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const media = mediaRef.current;
        const progressBar = progressBarRef.current;
        if (!isReady || !media || !progressBar) return;
        
        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = Math.min(Math.max(clickX / progressBar.offsetWidth, 0), 1);
        media.currentTime = percentage * duration;
        setCurrentTime(media.currentTime);
    };

    const formatTime = (timeInSeconds: number) => {
        if (!isFinite(timeInSeconds) || timeInSeconds < 0) return '0:00';
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

    if (error) {
        return <div className="text-red-400 text-xs px-2 py-1 flex items-center">{error}</div>;
    }
    
    return (
        <div className="audio-player">
            <video ref={mediaRef} preload="metadata" style={{ display: 'none' }} playsInline />
            <button onClick={togglePlayPause} className="play-pause-btn" aria-label={isPlaying ? 'Pause' : 'Play'} disabled={!isReady || !src}>
                {!isReady ? <Spinner size="sm"/> : 
                isPlaying ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                )}
            </button>
            <div className="progress-bar-container" ref={progressBarRef} onClick={handleProgressClick}>
                <div className="progress-bar-fill" style={{ width: `${progressPercentage}%` }} />
                <div className="progress-thumb" style={{ left: `${progressPercentage}%` }} />
            </div>
            <span className="time-display">{isReady ? `${formatTime(currentTime)}/${formatTime(duration)}` : '-:--'}</span>
        </div>
    );
};

export default AudioPlayer;