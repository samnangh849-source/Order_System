
import React, { useState, useEffect } from 'react';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

interface UserAvatarProps {
    avatarUrl?: string;
    name: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    onClick?: () => void;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ avatarUrl, name, size, className = '', onClick }) => {
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        setImgError(false);
    }, [avatarUrl]);

    const getInitials = (n: string) => {
        if (!n) return '?';
        const parts = n.trim().split(' ').filter(Boolean);
        if (parts.length === 0) return '?';
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };

    let dimClasses = "";
    // If size is provided, set standard dimensions and text size. 
    // If not, rely on className (useful for responsive headers).
    if (size === 'sm') dimClasses = "w-8 h-8 text-xs";
    else if (size === 'md') dimClasses = "w-10 h-10 text-sm";
    else if (size === 'lg') dimClasses = "w-12 h-12 text-base";
    else if (size === 'xl') dimClasses = "w-16 h-16 text-lg";

    const processedUrl = convertGoogleDriveUrl(avatarUrl);
    // Check if it's the default fallback from utils or we have an error
    const isFallback = processedUrl.includes('placehold.co') && processedUrl.includes('text=N/A');
    
    const showImage = processedUrl && !imgError && !isFallback;

    const bgColors = [
        'bg-blue-600', 'bg-green-600', 'bg-yellow-600', 
        'bg-red-600', 'bg-purple-600', 'bg-pink-600', 
        'bg-indigo-600', 'bg-teal-600'
    ];
    // Generate consistent color from name
    const charCodeSum = (name || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colorIndex = charCodeSum % bgColors.length;

    const baseClasses = `rounded-full object-cover flex-shrink-0 select-none transition-opacity ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`;

    if (showImage) {
        return (
            <img 
                src={processedUrl} 
                alt={name} 
                className={`${dimClasses} ${baseClasses} ${className}`}
                onError={() => setImgError(true)}
                onClick={onClick}
                referrerPolicy="no-referrer"
            />
        );
    }

    return (
        <div 
            className={`${dimClasses} ${baseClasses} flex items-center justify-center font-bold text-white border border-gray-600 ${bgColors[colorIndex]} ${className}`}
            onClick={onClick}
            title={name}
        >
            {getInitials(name)}
        </div>
    );
};

export default UserAvatar;
