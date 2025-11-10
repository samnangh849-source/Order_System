/**
 * Converts a Blob (like a File) into a Base64 encoded string, without the data URI prefix.
 * @param file The Blob or File to convert.
 * @returns A promise that resolves with the Base64 string.
 */
export const fileToBase64 = (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // The result is "data:mime/type;base64,the_base_64_string"
            // We only need the part after the comma.
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
};

/**
 * Converts various Google Drive URL formats into a direct, embeddable image URL.
 * Also handles standard image URLs.
 * @param url The original URL from Google Drive or another source.
 * @param type The type of content, 'image' for image URLs, 'audio' for audio download links.
 * @returns A processed, directly usable URL or a fallback for images.
 */
export const convertGoogleDriveUrl = (url?: string, type: 'image' | 'audio' = 'image'): string => {
    const fallbackImage = 'https://placehold.co/100x100/1f2937/4b5563?text=N/A';
    if (!url || typeof url !== 'string' || url.trim() === '') {
        return type === 'image' ? fallbackImage : '';
    }

    // If it's already a direct Google content URL, return it
    if (url.includes('lh3.googleusercontent.com') || url.includes('uc?export=media')) {
        return url;
    }

    if (url.includes('drive.google.com')) {
        // Regex to find the file ID from various Drive URL formats like /d/ID/view or uc?id=ID
        const idRegex = /(?:d\/|id=)([^/?&]+)/;
        const match = url.match(idRegex);
        if (match && match[1]) {
            const fileId = match[1];
            return type === 'image'
                ? `https://lh3.googleusercontent.com/d/${fileId}`
                : `https://drive.google.com/uc?export=media&id=${fileId}`;
        }
    }

    // If it's a standard URL that doesn't seem to be a Google Drive link, trust it
    if (url.startsWith('http')) {
        return url;
    }

    // If no match and not a standard URL, return fallback
    console.warn(`Could not process URL, returning fallback: ${url}`);
    return type === 'image' ? fallbackImage : '';
};
