
/**
 * Compresses an image file.
 * @param {File} file - The image file to compress.
 * @param {number} quality - The quality of the output image (0 to 1).
 * @param {number} maxWidth - The maximum width of the output image.
 * @returns {Promise<Blob>} A promise that resolves with the compressed image as a Blob.
 */
export const compressImage = (file: File, quality = 0.7, maxWidth = 800): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scaleRatio = maxWidth / img.width;
                canvas.width = maxWidth;
                canvas.height = img.height * scaleRatio;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Failed to get canvas context'));
                }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Canvas to Blob conversion failed'));
                        }
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};
