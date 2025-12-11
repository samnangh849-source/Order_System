
import React, { useState, useContext, useRef } from 'react';
import { AppContext } from '../../context/AppContext';
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
    const [activeTab, setActiveTab] = useState<'general' | 'security'>('general');
    
    // General State
    const [fullName, setFullName] = useState(currentUser?.FullName || '');
    const [profilePicUrl, setProfilePicUrl] = useState(currentUser?.ProfilePictureURL || '');
    
    // Security State
    const [oldPassword, setOldPassword] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isOldPasswordVisible, setIsOldPasswordVisible] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);

    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
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

    const handleGeneralSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            const profilePayload = {
                userName: currentUser?.UserName,
                fullName: fullName,
                profilePictureURL: profilePicUrl
            };

            const response = await fetch(`${WEB_APP_URL}/api/profile/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profilePayload)
            });

            const result = await response.json();
            if (!response.ok || result.status !== 'success') {
                throw new Error(result.message || 'Failed to update profile.');
            }

            updateCurrentUser({
                FullName: fullName,
                ProfilePictureURL: profilePicUrl,
            });
            await refreshData();
            setSuccessMsg('ព័ត៌មានផ្ទាល់ខ្លួនត្រូវបានកែប្រែជោគជ័យ!');
            setTimeout(onClose, 1500);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSecuritySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        if (!oldPassword) {
            setError('សូមបញ្ចូលពាក្យសម្ងាត់បច្ចុប្បន្នរបស់អ្នក។');
            setLoading(false);
            return;
        }
        if (!password) {
            setError('សូមបញ្ចូលពាក្យសម្ងាត់ថ្មី។');
            setLoading(false);
            return;
        }
        if (password.length < 6) {
            setError('ពាក្យសម្ងាត់ថ្មីត្រូវមានយ៉ាងតិច ៦ តួអក្សរ។');
            setLoading(false);
            return;
        }
        if (password !== confirmPassword) {
            setError('ពាក្យសម្ងាត់ថ្មី និងការបញ្ជាក់មិនตรงគ្នាទេ។');
            setLoading(false);
            return;
        }

        try {
            const passwordPayload = {
                userName: currentUser?.UserName,
                oldPassword: oldPassword,
                newPassword: password,
            };
            const response = await fetch(`${WEB_APP_URL}/api/profile/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(passwordPayload)
            });
            const result = await response.json();
            
            if (!response.ok || result.status !== 'success') {
                throw new Error(result.message || 'Failed to change password.');
            }

            setSuccessMsg('ពាក្យសម្ងាត់ត្រូវបានផ្លាស់ប្តូរជោគជ័យ!');
            setOldPassword('');
            setPassword('');
            setConfirmPassword('');
            setTimeout(onClose, 1500);

        } catch (err: any) {
            setError(err.message);
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

            {/* Tabs */}
            <div className="flex border-b border-gray-700 mb-6">
                <button 
                    className={`flex-1 pb-2 text-sm font-medium transition-colors ${activeTab === 'general' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-300'}`}
                    onClick={() => { setActiveTab('general'); setError(''); setSuccessMsg(''); }}
                >
                    ព័ត៌មានទូទៅ
                </button>
                <button 
                    className={`flex-1 pb-2 text-sm font-medium transition-colors ${activeTab === 'security' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-300'}`}
                    onClick={() => { setActiveTab('security'); setError(''); setSuccessMsg(''); }}
                >
                    សុវត្ថិភាព (Password)
                </button>
            </div>

            {activeTab === 'general' ? (
                <form onSubmit={handleGeneralSubmit} className="space-y-4">
                    <div className="flex flex-col items-center mb-4">
                        <div className="relative group">
                            <img src={convertGoogleDriveUrl(profilePicUrl)} alt="Profile" className="w-24 h-24 rounded-full object-cover border-4 border-gray-700" />
                            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </div>
                        </div>
                        <input 
                            type="file" 
                            accept="image/*" 
                            ref={fileInputRef} 
                            onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])}
                            className="hidden"
                        />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm text-blue-400 mt-2 hover:underline" disabled={isUploading}>
                            {isUploading ? 'កំពុង Upload...' : 'ប្តូររូបភាព'}
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">ឈ្មោះគណនី (UserName)</label>
                        <input type="text" value={currentUser?.UserName || ''} className="form-input bg-gray-800 cursor-not-allowed text-gray-500" readOnly />
                    </div>
                    <div>
                        <label htmlFor="edit-fullname" className="block text-sm font-medium text-gray-400 mb-2">ឈ្មោះពេញ (Full Name)</label>
                        <input type="text" id="edit-fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} className="form-input" required />
                    </div>
                    
                    <div className="hidden">
                        <label className="block text-sm font-medium text-gray-400 mb-2">Image URL</label>
                        <input type="text" value={profilePicUrl} onChange={(e) => setProfilePicUrl(e.target.value)} className="form-input" />
                    </div>

                    {error && <p className="text-red-400 text-sm bg-red-900/20 p-2 rounded">{error}</p>}
                    {successMsg && <p className="text-green-400 text-sm bg-green-900/20 p-2 rounded">{successMsg}</p>}

                    <div className="flex justify-end pt-4 space-x-4">
                        <button type="button" onClick={onClose} className="btn btn-secondary">បោះបង់</button>
                        <button type="submit" className="btn btn-primary" disabled={loading || isUploading}>
                            {loading ? <Spinner size="sm" /> : 'រក្សាទុក'}
                        </button>
                    </div>
                </form>
            ) : (
                <form onSubmit={handleSecuritySubmit} className="space-y-4 animate-fade-in">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">ពាក្យសម្ងាត់បច្ចុប្បន្ន</label>
                        <div className="relative">
                            <input type={isOldPasswordVisible ? "text" : "password"} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="form-input pr-10" />
                             <button type="button" onClick={() => setIsOldPasswordVisible(!isOldPasswordVisible)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-white">
                                {isOldPasswordVisible ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 .847 0 1.67 .126 2.454 .364m-3.033 2.446a3 3 0 11-4.243 4.243m4.242-4.242l4.243 4.243M3 3l18 18" /></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                )}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">ពាក្យសម្ងាត់ថ្មី</label>
                        <div className="relative">
                            <input type={isPasswordVisible ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="form-input pr-10" />
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
                        <label className="block text-sm font-medium text-gray-400 mb-2">បញ្ជាក់ពាក្យសម្ងាត់ថ្មី</label>
                        <div className="relative">
                            <input type={isConfirmPasswordVisible ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="form-input pr-10" />
                            <button type="button" onClick={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-white">
                                {isConfirmPasswordVisible ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 .847 0 1.67 .126 2.454 .364m-3.033 2.446a3 3 0 11-4.243 4.243m4.242-4.242l4.243 4.243M3 3l18 18" /></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {error && <p className="text-red-400 text-sm bg-red-900/20 p-2 rounded">{error}</p>}
                    {successMsg && <p className="text-green-400 text-sm bg-green-900/20 p-2 rounded">{successMsg}</p>}

                    <div className="flex justify-end pt-4 space-x-4">
                        <button type="button" onClick={onClose} className="btn btn-secondary">បោះបង់</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? <Spinner size="sm" /> : 'ផ្លាស់ប្តូរពាក្យសម្ងាត់'}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
};

export default EditProfileModal;
