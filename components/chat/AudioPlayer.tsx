import React, { useState, useRef, useEffect, useCallback } from 'react';
import Spinner from '../common/Spinner';

interface AudioPlayerProps {
    src: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);
    // FIX: Initialize useRef with null to satisfy TypeScript rule expecting one argument.
    const animationRef = useRef<number | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cleanup = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.removeAttribute('src'); // Use removeAttribute
            audioRef.current.load();
        }
        setIsPlaying(false);
        setDuration(0);
        setCurrentTime(0);
        setIsReady(false);
        setError(null);
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }
    }, []);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !src) {
            cleanup();
            return;
        }

        const onLoadedMetadata = () => {
            if (isFinite(audio.duration)) {
                setDuration(audio.duration);
                setIsReady(true);
                setError(null);
            }
        };

        const onEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
        };
        
        const onError = () => {
            console.error(`Audio error: ${audio.error?.code}; ${audio.error?.message}`);
            setError('Could not play audio.');
            setIsReady(false);
        };
        
        // Set up listeners before setting src
        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);

        // Set the source and load it
        audio.src = src;
        audio.load();

        return () => {
            // Cleanup: remove event listeners
            audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
            cleanup();
        };
    }, [src, cleanup]);


    const whilePlaying = useCallback(() => {
        if (audioRef.current?.paused === false) {
             setCurrentTime(audioRef.current.currentTime);
             animationRef.current = requestAnimationFrame(whilePlaying);
        } else {
             if(animationRef.current) cancelAnimationFrame(animationRef.current);
        }
    }, []);

    const togglePlayPause = () => {
        if (!isReady || error) return;
        
        const audio = audioRef.current;
        if (!audio) return;
        
        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
            if(animationRef.current) cancelAnimationFrame(animationRef.current);
        } else {
            audio.play().then(() => {
                setIsPlaying(true);
                animationRef.current = requestAnimationFrame(whilePlaying);
            }).catch(e => {
                console.error("Playback failed:", e);
                setError("Playback failed.");
                setIsPlaying(false);
            });
        }
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        const progressBar = progressBarRef.current;
        if (!isReady || !audio || !progressBar) return;
        
        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = Math.min(Math.max(clickX / progressBar.offsetWidth, 0), 1);
        const newTime = percentage * duration;
        
        audio.currentTime = newTime;
        setCurrentTime(newTime);
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
            <audio ref={audioRef} preload="metadata" />
            <button onClick={togglePlayPause} className="play-pause-btn" aria-label={isPlaying ? 'Pause' : 'Play'} disabled={!isReady}>
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
