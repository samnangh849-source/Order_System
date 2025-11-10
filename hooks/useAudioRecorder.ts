import { useState, useRef } from 'react';

type AudioRecorderHook = {
    isRecording: boolean;
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<Blob | null>;
};

export const useAudioRecorder = (): AudioRecorderHook => {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const startRecording = async (): Promise<void> => {
        if (isRecording) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = () => {
                // Clean up the stream tracks
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error starting audio recording:", err);
            if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
                alert('ការអនុញ្ញាតឱ្យប្រើមីក្រូហ្វូនត្រូវបានបដិសេធ។ សូមអនុញ្ញាតឱ្យចូលប្រើមីក្រូហ្វូននៅក្នុងការកំណត់កម្មវិធីរុករករបស់អ្នក ដើម្បីប្រើមុខងារនេះ។');
            } else {
                alert('មិនអាចចាប់ផ្តើមការថតសំឡេងបានទេ។ សូមប្រាកដថាអ្នកបានភ្ជាប់មីក្រូហ្វូន ហើយបានផ្តល់ការអនុញ្ញាត។');
            }
        }
    };

    const stopRecording = (): Promise<Blob | null> => {
        return new Promise((resolve) => {
            if (!mediaRecorderRef.current || !isRecording) {
                resolve(null);
                return;
            }

            mediaRecorderRef.current.onstop = (event) => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                // Clean up the stream tracks
                if (mediaRecorderRef.current) {
                    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
                }
                resolve(audioBlob);
            };

            mediaRecorderRef.current.stop();
            setIsRecording(false);
        });
    };

    return { isRecording, startRecording, stopRecording };
};