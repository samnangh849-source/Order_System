import React, { useState, useContext, useRef, useEffect } from 'react';
import { AppContext } from '../../App';
import EditProfileModal from './EditProfileModal';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

interface HeaderProps {
    onBackToRoleSelect: () => void;
}

const Header: React.FC<HeaderProps> = ({ onBackToRoleSelect }) => {
    const { currentUser, logout, refreshData, originalAdminUser, previewImage } = useContext(AppContext);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [editProfileModalOpen, setEditProfileModalOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const isHybridAdmin = currentUser?.IsSystemAdmin && (currentUser.Team || '').split(',').map(t => t.trim()).filter(Boolean).length > 0;
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!currentUser) return null;

    return (
        <>
            <header className="fixed top-0 left-0 right-0 bg-gray-900/70 backdrop-blur-sm border-b border-gray-700 z-40 p-2 sm:p-3 shadow-lg"
                    style={originalAdminUser ? { top: '40px' } : {}}>
                <div className="w-full max-w-7xl mx-auto flex justify-between items-center px-4">
                    <h1 className="text-lg sm:text-xl font-bold text-white truncate">កម្មវិធីទម្លាក់ការកម្មង់</h1>
                    <div className="flex items-center space-x-2 sm:space-x-4">
                        <div className="text-right hidden sm:block">
                            <p className="font-semibold text-white text-sm sm:text-base truncate">{currentUser.FullName}</p>
                            <p className="text-xs text-blue-300">{currentUser.IsSystemAdmin ? 'System Admin' : currentUser.Role}</p>
                        </div>
                        <img 
                            src={convertGoogleDriveUrl(currentUser.ProfilePictureURL)} 
                            alt="Avatar" 
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-blue-500 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => previewImage(convertGoogleDriveUrl(currentUser.ProfilePictureURL) || '')}
                        />
                        <div className="relative" ref={dropdownRef}>
                            <button onClick={() => setDropdownOpen(!dropdownOpen)} className="p-2 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {dropdownOpen && (
                                <div className="absolute right-0 mt-2 w-56 bg-gray-800 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5">
                                    <a href="#" onClick={(e) => { e.preventDefault(); setEditProfileModalOpen(true); setDropdownOpen(false); }} className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700">កែសម្រួល Profile</a>
                                    <a href="#" onClick={(e) => { e.preventDefault(); refreshData(); setDropdownOpen(false); }} className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700">ទាញទិន្នន័យថ្មី</a>
                                    {isHybridAdmin && !originalAdminUser && (
                                         <a href="#" onClick={(e) => { e.preventDefault(); onBackToRoleSelect(); setDropdownOpen(false); }} className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700">ត្រឡប់ទៅជ្រើសរើសតួនាទី</a>
                                    )}
                                    <a href="#" onClick={(e) => { e.preventDefault(); logout(); }} className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700">ចាកចេញ</a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>
            {editProfileModalOpen && <EditProfileModal onClose={() => setEditProfileModalOpen(false)} />}
        </>
    );
};

export default Header;