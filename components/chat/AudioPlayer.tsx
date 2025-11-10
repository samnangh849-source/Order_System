
import React, { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
    src: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const setAudioData = () => {
            if (audio.duration && isFinite(audio.duration)) {
                setDuration(audio.duration);
            }
            setCurrentTime(audio.currentTime);
        };

        const updateCurrentTime = () => {
            setCurrentTime(audio.currentTime);
        };

        const onEnded = () => {
            // isPlaying is handled by the 'pause' event, but we reset time here
            setCurrentTime(0);
        };

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);

        audio.addEventListener('loadedmetadata', setAudioData);
        audio.addEventListener('timeupdate', updateCurrentTime);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        
        // If metadata is already loaded
        if (audio.readyState >= 1) {
            setAudioData();
        }

        return () => {
            // Cleanup function with a null check
            if (audio) {
                audio.removeEventListener('loadedmetadata', setAudioData);
                audio.removeEventListener('timeupdate', updateCurrentTime);
                audio.removeEventListener('ended', onEnded);
                audio.removeEventListener('play', onPlay);
                audio.removeEventListener('pause', onPause);
            }
        };
    }, [src]);

    const togglePlayPause = async () => {
        const audio = audioRef.current;
        if (!audio) return;

        try {
            if (isPlaying) {
                audio.pause();
            } else {
                await audio.play();
            }
        } catch (error) {
            // This error is common when the audio element is unmounted while play() is pending.
            // It's safe to ignore as it's a normal part of the component lifecycle.
            if (error instanceof DOMException && error.name === 'AbortError') {
                // Silently ignore.
            } else {
                console.error("Audio operation failed:", error);
                setIsPlaying(false); // Reset state on unexpected errors.
            }
        }
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        const progressBar = progressBarRef.current;
        
        if (!progressBar || !audio || !duration || duration === 0) return;
        
        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = Math.min(Math.max(clickX / progressBar.offsetWidth, 0), 1);
        const newTime = percentage * duration;
        
        audio.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const formatTime = (timeInSeconds: number) => {
        if (!timeInSeconds || isNaN(timeInSeconds) || !isFinite(timeInSeconds)) return '0:00';
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className="audio-player">
            <audio ref={audioRef} src={src} preload="metadata" />
            <button onClick={togglePlayPause} className="play-pause-btn" aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? (
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
            <span className="time-display">{formatTime(currentTime)}/{formatTime(duration)}</span>
        </div>
    );
};

export default AudioPlayer;
