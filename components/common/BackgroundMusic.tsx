
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { BACKGROUND_MUSIC_URL } from '../../constants';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

const BackgroundMusic: React.FC = () => {
    const audioRef = useRef<HTMLAudioElement>(null);
    // State is still needed for logic, even if UI is hidden
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasError, setHasError] = useState(false);
    const volume = 0.3; // Fixed volume at 30% since slider is hidden

    // Process the URL to handle Google Drive links automatically
    const musicSource = useMemo(() => {
        return convertGoogleDriveUrl(BACKGROUND_MUSIC_URL, 'audio');
    }, []);

    // Effect to handle volume changes
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    useEffect(() => {
        setHasError(false);
    }, [musicSource]);

    // NEW: Autoplay Logic
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !musicSource) return;

        // Ensure volume is set specifically to 30% before playing
        audio.volume = 0.3;

        const attemptPlay = async () => {
            try {
                await audio.play();
                setIsPlaying(true);
            } catch (error) {
                console.log("Autoplay prevented by browser policy. Waiting for user interaction...");
                
                // Fallback: If autoplay is blocked, wait for the first user interaction anywhere on the page
                const onInteraction = async () => {
                    try {
                        if (audio.paused) {
                            await audio.play();
                            setIsPlaying(true);
                        }
                    } catch (e) {
                        console.error("Play failed after interaction", e);
                    } finally {
                        // Cleanup listeners once played
                        document.removeEventListener('click', onInteraction);
                        document.removeEventListener('keydown', onInteraction);
                        document.removeEventListener('touchstart', onInteraction);
                    }
                };

                document.addEventListener('click', onInteraction, { once: true });
                document.addEventListener('keydown', onInteraction, { once: true });
                document.addEventListener('touchstart', onInteraction, { once: true });
            }
        };

        // Try to play immediately when component mounts
        attemptPlay();

    }, [musicSource]);

    const handleAudioError = (e: any) => {
        console.error("Background Music Error:", e);
        setHasError(true);
        setIsPlaying(false);
    };

    // If no URL is provided, don't render anything
    if (!musicSource) return null;

    // Render hidden audio element only
    return (
        <audio 
            ref={audioRef} 
            src={musicSource} 
            loop 
            onError={handleAudioError}
            style={{ display: 'none' }}
        />
    );
};

export default BackgroundMusic;
