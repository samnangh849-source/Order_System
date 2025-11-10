
import React, { useState, useContext, useRef } from 'react';
import { AppContext } from '../../App';
import Modal from './Modal';
import Spinner from './Spinner';
import { WEB_APP_URL } from '../../constants';
import { compressImage } from '../../utils/imageCompressor';
import { fileToBase64, convertGoogleDriveUrl } from '../../utils/fileUtils';

interface EditProfileModalProps {
    onClose: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ onClose }) => {
    const { currentUser, refreshData, updateCurrentUser } = useContext(AppContext);
    const [fullName, setFullName] = useState(currentUser?.FullName || '');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [profilePicUrl, setProfilePicUrl] = useState(currentUser?.ProfilePictureURL || '');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = async (file: File) => {
        if (!file) return;
        setIsUploading(true);
        setError('');
        try {
            const compressedBlob = await compressImage(file, 0.8, 1024);
            const base64Data = await fileToBase64(compressedBlob);
            const payload = {
                fileData: base64Data,
                fileName: file.name,
                mimeType: compressedBlob.type,
                userName: currentUser?.UserName || 'unknown'
            };
            const response = await fetch(`${WEB_APP_URL}/api/upload-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok || result.status !== 'success') {
                throw new Error(result.message || 'Image upload failed');
            }
            setProfilePicUrl(result.url);
        } catch (err) {
            console.error(err);
            setError((err as Error).message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!currentUser) {
            setError('No user logged in.');
            return;
        }

        if (!fullName) {
            setError('សូមបំពេញឈ្មោះពេញ។');
            return;
        }

        if (password) {
            setError('ការផ្លាស់ប្តូរពាក្យសម្ងាត់មិនត្រូវបានគាំទ្រនៅក្នុងទម្រង់នេះទេ។');
            return;
        }
        
        setLoading(true);

        const payload = {
            userName: currentUser.UserName,
            fullName: fullName,
            profilePictureURL: profilePicUrl,
        };

        try {
            const response = await fetch(`${WEB_APP_URL}/api/profile/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok || result.status !== 'success') {
                throw new Error(result.message || 'Failed to update profile.');
            }

            // Optimistically update the current user for instant UI feedback
            updateCurrentUser({
                FullName: fullName,
                ProfilePictureURL: profilePicUrl,
            });

            // Refresh all data from server for consistency
            await refreshData();
            onClose();

        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">កែសម្រួល Profile</h2>
                <button onClick={onClose} className="text-2xl text-gray-500 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">ឈ្មោះគណនី</label>
                    <input type="text" value={currentUser?.UserName || ''} className="form-input bg-gray-800 cursor-not-allowed" readOnly />
                </div>
                <div>
                    <label htmlFor="edit-fullname" className="block text-sm font-medium text-gray-400 mb-2">ឈ្មោះពេញ</label>
                    <input type="text" id="edit-fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} className="form-input" required />
                </div>
                 <div>
                    <label htmlFor="edit-profile-picture-url" className="block text-sm font-medium text-gray-400 mb-2">រូបភាព Profile</label>
                     <div className="flex items-center gap-4">
                        <img src={convertGoogleDriveUrl(profilePicUrl)} alt="Profile Preview" className="w-20 h-20 rounded-full object-cover border-2 border-gray-600" />
                        <div className="flex-grow space-y-2">
                            <input 
                                type="text" 
                                id="edit-profile-picture-url" 
                                value={profilePicUrl} 
                                onChange={(e) => setProfilePicUrl(e.target.value)} 
                                className="form-input" 
                                placeholder="បិទភ្ជាប់ URL រូបភាព" 
                            />
                            <input 
                                type="file" 
                                accept="image/*" 
                                ref={fileInputRef} 
                                onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])}
                                className="hidden"
                            />
                            <button 
                                type="button" 
                                onClick={() => fileInputRef.current?.click()}
                                className="btn btn-secondary w-full text-sm"
                                disabled={isUploading}
                            >
                                {isUploading ? <Spinner size="sm" /> : 'Upload ពីឧបករណ៍'}
                            </button>
                        </div>
                    </div>
                </div>
                <div>
                    <label htmlFor="edit-password" className="block text-sm font-medium text-gray-400 mb-2">ពាក្យសម្ងាត់ថ្មី (មិនអាចប្តូរនៅទីនេះបានទេ)</label>
                    <div className="relative">
                        <input type={isPasswordVisible ? "text" : "password"} id="edit-password" value={password} onChange={(e) => setPassword(e.target.value)} className="form-input pr-10 bg-gray-800 cursor-not-allowed" disabled />
                         <button type="button" onClick={() => setIsPasswordVisible(!isPasswordVisible)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-white">
                            {isPasswordVisible ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 .847 0 1.67 .126 2.454 .364m-3.033 2.446a3 3 0 11-4.243 4.243m4.242-4.242l4.243 4.243M3 3l18 18" /></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            )}
                        </button>
                    </div>
                </div>
                 <div>
                    <label htmlFor="edit-confirm-password" className="block text-sm font-medium text-gray-400 mb-2">បញ្ជាក់ពាក្យសម្ងាត់ថ្មី</label>
                    <div className="relative">
                        <input type={isConfirmPasswordVisible ? "text" : "password"} id="edit-confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="form-input pr-10 bg-gray-800 cursor-not-allowed" disabled />
                        <button type="button" onClick={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-white">
                            {isConfirmPasswordVisible ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 .847 0 1.67 .126 2.454 .364m-3.033 2.446a3 3 0 11-4.243 4.243m4.242-4.242l4.243 4.243M3 3l18 18" /></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            )}
                        </button>
                    </div>
                </div>
                {error && <p className="text-red-400 mt-2 h-5">{error}</p>}
                <div className="flex justify-end pt-4 space-x-4">
                    <button type="button" onClick={onClose} className="btn btn-secondary">បោះបង់</button>
                    <button type="submit" className="btn btn-primary" disabled={loading || isUploading}>
                        {loading ? <Spinner size="sm" /> : 'រក្សាទុក'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default EditProfileModal;
