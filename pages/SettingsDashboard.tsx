
import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import Spinner from '../components/common/Spinner';
import Modal from '../components/common/Modal';
import { WEB_APP_URL } from '../constants';
import { fileToBase64, convertGoogleDriveUrl } from '../utils/fileUtils';
import PagesPdfExportModal from '../components/admin/PagesPdfExportModal';

interface SettingsDashboardProps {
    onBack: () => void;
    initialSection?: string;
}

// Define explicit types for configuration to prevent inference errors
type FieldType = 'text' | 'number' | 'password' | 'checkbox' | 'image_url';

interface ConfigField {
    name: string;
    label: string;
    type: FieldType;
}

interface ConfigSection {
    id: string;
    title: string;
    icon: string;
    dataKey: string;
    sheetName: string;
    primaryKeyField: string;
    fields: ConfigField[];
    displayField: string;
}

// Configuration matches the Go Backend Structs exactly
const configSections: ConfigSection[] = [
    { 
        id: 'users', 
        title: 'អ្នកប្រើប្រាស់', 
        icon: '👤', 
        dataKey: 'users', 
        sheetName: 'Users', 
        primaryKeyField: 'UserName', 
        fields: [ 
            { name: 'FullName', label: 'ឈ្មោះពេញ', type: 'text' }, 
            { name: 'UserName', label: 'ឈ្មោះគណនី (Login)', type: 'text' }, 
            { name: 'Password', label: 'ពាក្យសម្ងាត់', type: 'password' }, 
            { name: 'Role', label: 'តួនាទី (Role)', type: 'text' }, 
            { name: 'Team', label: 'ក្រុម (Team)', type: 'text' }, 
            { name: 'ProfilePictureURL', label: 'URL រូបភាព', type: 'image_url' }, 
            { name: 'IsSystemAdmin', label: 'System Admin?', type: 'checkbox' } 
        ], 
        displayField: 'FullName' 
    },
    { 
        id: 'products', 
        title: 'ផលិតផល', 
        icon: '🛍️', 
        dataKey: 'products', 
        sheetName: 'Products', 
        primaryKeyField: 'ProductName', 
        fields: [ 
            { name: 'ProductName', label: 'ឈ្មោះផលិតផល', type: 'text' }, 
            { name: 'Barcode', label: 'Barcode', type: 'text' }, 
            { name: 'Price', label: 'តម្លៃ ($)', type: 'number' }, 
            { name: 'Cost', label: 'តម្លៃដើម ($)', type: 'number' }, 
            { name: 'ImageURL', label: 'URL រូបភាព', type: 'image_url' },
            { name: 'Tags', label: 'Tags (comma separated)', type: 'text' }
        ], 
        displayField: 'ProductName' 
    },
    { 
        id: 'pages', 
        title: 'ក្រុម & Page', 
        icon: '👥', 
        dataKey: 'pages', 
        sheetName: 'TeamsPages', 
        primaryKeyField: 'PageName', 
        fields: [ 
            { name: 'PageName', label: 'ឈ្មោះ Page', type: 'text' }, 
            { name: 'Team', label: 'ក្រុម', type: 'text' }, 
            { name: 'TelegramValue', label: 'Telegram Value', type: 'text' }, 
            { name: 'PageLogoURL', label: 'URL ឡូហ្គោ', type: 'image_url' } 
        ], 
        displayField: 'PageName' 
    },
    { 
        id: 'shippingMethods', 
        title: 'សេវាដឹកជញ្ជូន', 
        icon: '🚚', 
        dataKey: 'shippingMethods', 
        sheetName: 'ShippingMethods', 
        primaryKeyField: 'MethodName', 
        fields: [ 
            { name: 'MethodName', label: 'ឈ្មោះសេវា', type: 'text' }, 
            { name: 'RequireDriverSelection', label: 'ត្រូវការអ្នកដឹក?', type: 'checkbox' }, 
            { name: 'LogosURL', label: 'URL ឡូហ្គោ', type: 'image_url' } 
        ], 
        displayField: 'MethodName' 
    },
    { 
        id: 'drivers', 
        title: 'អ្នកដឹក', 
        icon: '🛵', 
        dataKey: 'drivers', 
        sheetName: 'Drivers', 
        primaryKeyField: 'DriverName', 
        fields: [ 
            { name: 'DriverName', label: 'ឈ្មោះអ្នកដឹក', type: 'text' }, 
            { name: 'ImageURL', label: 'URL រូបថត', type: 'image_url' } 
        ], 
        displayField: 'DriverName' 
    },
    { 
        id: 'bankAccounts', 
        title: 'គណនីធនាគារ', 
        icon: '🏦', 
        dataKey: 'bankAccounts', 
        sheetName: 'BankAccounts', 
        primaryKeyField: 'BankName', 
        fields: [ 
            { name: 'BankName', label: 'ឈ្មោះធនាគារ', type: 'text' }, 
            // Note: Backend struct 'BankAccount' only has BankName and LogoURL. 
            // AccountName/Number are not returned by GET /static-data in current backend implementation.
            { name: 'LogoURL', label: 'URL ឡូហ្គោ', type: 'image_url' } 
        ], 
        displayField: 'BankName' 
    },
    { 
        id: 'phoneCarriers', 
        title: 'ក្រុមហ៊ុនទូរស័ព្ទ', 
        icon: '📱', 
        dataKey: 'phoneCarriers', 
        sheetName: 'PhoneCarriers', 
        primaryKeyField: 'CarrierName', 
        fields: [ 
            { name: 'CarrierName', label: 'ឈ្មោះក្រុមហ៊ុន', type: 'text' }, 
            { name: 'Prefixes', label: 'Prefixes (បំបែកដោយក្បៀស)', type: 'text' }, 
            { name: 'CarrierLogoURL', label: 'URL ឡូហ្គោ', type: 'image_url' } 
        ], 
        displayField: 'CarrierName' 
    },
];

// Helper to find value case-insensitively with STRICT safety checks
const getValueCaseInsensitive = (item: any, key: string) => {
    if (!item || typeof item !== 'object') {
        return undefined;
    }
    if (!key) return undefined;

    // 1. Try exact match
    if (item[key] !== undefined) return item[key];
    
    // 2. Try lowercase match
    try {
        const lowerKey = key.toLowerCase();
        const keys = Object.keys(item);
        const foundKey = keys.find(k => 
            k.toLowerCase() === lowerKey || 
            k.toLowerCase().replace(/_/g, '') === lowerKey.replace(/_/g, '')
        );
        
        if (foundKey) return item[foundKey];
    } catch (e) {
        console.warn("Error accessing property case-insensitively:", e);
    }
    return undefined;
};

// Helper to find an array in the main data object case-insensitively
const getArrayCaseInsensitive = (data: any, key: string): any[] => {
    if (!data || typeof data !== 'object') return [];
    
    // Try exact match
    if (Array.isArray(data[key])) return data[key];

    // Try case insensitive match
    try {
        const lowerKey = key.toLowerCase();
        const keys = Object.keys(data);
        const foundKey = keys.find(k => k.toLowerCase() === lowerKey);
        if (foundKey && Array.isArray(data[foundKey])) {
            return data[foundKey];
        }
    } catch (e) {
        console.warn("Error accessing data array case-insensitively:", e);
    }
    
    return [];
};

const ConfigEditModal = ({ section, item, onClose, onSave }: { section: ConfigSection, item: any | null, onClose: () => void, onSave: (item: any) => void }) => {
    const { refreshData } = useContext(AppContext);
    const [formData, setFormData] = useState<any>({}); 
    const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const [passwordVisibility, setPasswordVisibility] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (item) {
            // Load existing data with smart key matching
            const dataToLoad: any = {};
            section.fields.forEach(field => {
                let val = getValueCaseInsensitive(item, field.name);
                if (val === undefined || val === null) {
                    val = field.type === 'checkbox' ? false : field.type === 'number' ? 0 : '';
                }
                dataToLoad[field.name] = val;
            });
            
            // SECURITY: Clear password field on load for Users
            if (section.id === 'users') {
                dataToLoad.Password = ''; 
            }
            
            setFormData(dataToLoad);
        } else {
            // Initialize default values for new items
            const defaultData = section.fields.reduce((acc, field) => {
                acc[field.name] = field.type === 'checkbox' ? false : field.type === 'number' ? 0 : '';
                return acc;
            }, {} as any);
            setFormData(defaultData);
        }
    }, [item, section]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev: any) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleImageUpload = async (fieldName: string, file: File) => {
        if (!file) return;
        setUploadingFields(prev => ({ ...prev, [fieldName]: true }));
        setError('');
        try {
            const base64Data = await fileToBase64(file);
            const payload = {
                fileData: base64Data,
                fileName: file.name,
                mimeType: file.type,
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
            setFormData((prev: any) => ({ ...prev, [fieldName]: result.url }));
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setUploadingFields(prev => ({ ...prev, [fieldName]: false }));
        }
    };
    
    const handleSave = async () => {
        setError('');
        for (const field of section.fields) {
            // Basic validation
            if (field.type !== 'checkbox' && 
                (formData[field.name] === undefined || formData[field.name] === '') && 
                field.name !== 'Password' && !item) {
                 setError(`Please fill in the "${field.label}" field.`);
                 return;
            }
            // Require password when adding new user
            if (!item && section.id === 'users' && field.name === 'Password' && !formData[field.name]) {
                setError('Password is required for new users.');
                return;
            }
        }
        setIsLoading(true);
        try {
            const endpoint = item ? '/api/admin/update-sheet' : '/api/admin/add-row';
            
            // Prepare payload and convert types
            const payloadData = { ...formData };

            section.fields.forEach(field => {
                if (field.type === 'number' && payloadData[field.name] !== undefined) {
                    payloadData[field.name] = Number(payloadData[field.name]);
                }
            });

            // For Users edit, if password field is empty, remove it to prevent overwrite
            if (item && section.id === 'users' && !payloadData.Password) {
                delete payloadData.Password;
            }

            const payload: any = {
                sheetName: section.sheetName,
                newData: payloadData
            };
            if (item) {
                // Use smart key lookup for Primary Key too
                const pkValue = getValueCaseInsensitive(item, section.primaryKeyField);
                payload.primaryKey = { [section.primaryKeyField]: pkValue };
            }
            
            const response = await fetch(`${WEB_APP_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok || result.status !== 'success') {
                throw new Error(result.message || `Failed to ${item ? 'update' : 'add'} item.`);
            }
            await refreshData();
            onSave(formData);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-2xl">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">{(item ? 'កែសម្រួល' : 'បន្ថែម')} {section.title}</h2>
                <button onClick={onClose} className="text-2xl text-gray-500 hover:text-white">&times;</button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                {section.fields.map(field => (
                    <div key={field.name}>
                        <label className="block text-sm font-medium text-gray-400 mb-1">{field.label}</label>
                        {field.type === 'checkbox' ? (
                            <input
                                type="checkbox"
                                name={field.name}
                                checked={!!formData[field.name]}
                                onChange={handleChange}
                                className="h-5 w-5 rounded border-gray-500 bg-gray-700 text-blue-600 focus:ring-blue-500"
                            />
                        ) : field.type === 'image_url' ? (
                            <div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        name={field.name}
                                        value={formData[field.name] || ''}
                                        onChange={handleChange}
                                        placeholder="បិទភ្ជាប់ URL ឬ Upload"
                                        className="form-input flex-grow"
                                    />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        ref={el => { fileInputRefs.current[field.name] = el; }}
                                        onChange={(e) => e.target.files && handleImageUpload(field.name, e.target.files[0])}
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRefs.current[field.name]?.click()}
                                        className="btn btn-secondary !p-2 flex-shrink-0"
                                        disabled={uploadingFields[field.name]}
                                    >
                                        {uploadingFields[field.name] ? <Spinner size="sm" /> : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                {formData[field.name] && (
                                    <img 
                                        src={convertGoogleDriveUrl(formData[field.name])} 
                                        alt="Preview" 
                                        className="mt-2 h-20 w-auto rounded object-contain bg-gray-700 p-1"
                                        referrerPolicy="no-referrer" 
                                    />
                                )}
                            </div>
                        ) : field.type === 'password' ? (
                            <div className="relative">
                                <input
                                    type={passwordVisibility[field.name] ? 'text' : 'password'}
                                    name={field.name}
                                    value={formData[field.name] || ''}
                                    onChange={handleChange}
                                    className="form-input pr-10"
                                    placeholder={item ? '(មិនផ្លាស់ប្តូរ - ទុកទទេដើម្បីរក្សាចាស់)' : ''}
                                />
                                <button
                                    type="button"
                                    onClick={() => setPasswordVisibility(prev => ({ ...prev, [field.name]: !prev[field.name] }))}
                                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-white"
                                    aria-label="Toggle password visibility"
                                >
                                    {passwordVisibility[field.name] ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 .847 0 1.67 .126 2.454 .364m-3.033 2.446a3 3 0 11-4.243 4.243m4.242-4.242l4.243 4.243M3 3l18 18" /></svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <input
                                type={field.type}
                                name={field.name}
                                value={formData[field.name] || ''}
                                onChange={handleChange}
                                className="form-input"
                                readOnly={item && field.name === section.primaryKeyField} // Prevent editing PK
                            />
                        )}
                    </div>
                ))}
            </div>

            {error && <p className="text-red-400 mt-4">{error}</p>}

             <div className="flex justify-end pt-6 space-x-4 mt-4 border-t border-gray-700">
                <button type="button" onClick={onClose} className="btn btn-secondary">បោះបង់</button>
                <button type="button" onClick={handleSave} className="btn btn-primary" disabled={isLoading}>
                    {isLoading ? <Spinner size="sm" /> : 'រក្សាទុក'}
                </button>
            </div>
        </Modal>
    );
}

const SettingsDashboard: React.FC<SettingsDashboardProps> = ({ onBack, initialSection }) => {
    const { appData, refreshData, setAppState } = useContext(AppContext);
    const [desktopSelectedSectionId, setDesktopSelectedSectionId] = useState<string>(initialSection || 'users');
    const [mobileSelectedSectionId, setMobileSelectedSectionId] = useState<string | null>(initialSection || null);
    const [modalState, setModalState] = useState<{ isOpen: boolean, sectionId: string, item: any | null }>({ isOpen: false, sectionId: '', item: null });
    const [extraUsers, setExtraUsers] = useState<any[]>([]); // To store users fetched locally if appData is missing them
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

    const isMobile = window.innerWidth < 768;
    const activeSectionId = isMobile ? mobileSelectedSectionId : desktopSelectedSectionId;
    
    useEffect(() => {
        if (initialSection) {
            setDesktopSelectedSectionId(initialSection);
            if (isMobile) {
                setMobileSelectedSectionId(initialSection);
            }
        }
    }, [initialSection, isMobile]);

    const activeSection = useMemo(() => 
        configSections.find(s => s.id === activeSectionId) || undefined,
    [activeSectionId]);

    // Fetch users if they are missing from appData (backend /api/static-data doesn't return users)
    useEffect(() => {
        const fetchUsers = async () => {
            if (activeSectionId === 'users') {
                const currentUsers = getArrayCaseInsensitive(appData, 'users');
                if (currentUsers.length === 0) {
                    try {
                        const response = await fetch(`${WEB_APP_URL}/api/users`);
                        if (response.ok) {
                            const result = await response.json();
                            if (result.status === 'success') {
                                setExtraUsers(result.data || []); // Default to empty array if data is null
                            }
                        }
                    } catch (e) {
                        console.error("Failed to fetch users locally in settings", e);
                    }
                }
            }
        };
        fetchUsers();
    }, [activeSectionId, appData]);

    const openModal = (sectionId: string, item: any | null = null) => {
        setModalState({ isOpen: true, sectionId, item });
    };

    const closeModal = () => {
        setModalState({ isOpen: false, sectionId: '', item: null });
    };
    
    const handleSave = () => {
        closeModal();
        // If users were updated, re-fetch them locally if needed
        if (activeSectionId === 'users') {
             // A slight delay to allow backend cache to clear/update
             setTimeout(async () => {
                 try {
                    const response = await fetch(`${WEB_APP_URL}/api/users`);
                    if (response.ok) {
                        const result = await response.json();
                        if(result.status === 'success') setExtraUsers(result.data || []); // Safety check
                    }
                 } catch(e) {}
             }, 1000);
        }
    }

    const handleDelete = async (section: ConfigSection, item: any) => {
        const pkValue = getValueCaseInsensitive(item, section.primaryKeyField);
        const displayValue = getValueCaseInsensitive(item, section.displayField);
        
        if (!window.confirm(`តើអ្នកប្រាកដទេថាចង់លុប ${displayValue || 'Item'}?`)) return;

        try {
            const payload = {
                sheetName: section.sheetName,
                primaryKey: { [section.primaryKeyField]: pkValue }
            };
            const response = await fetch(`${WEB_APP_URL}/api/admin/delete-row`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok || result.status !== 'success') {
                throw new Error(result.message || 'Failed to delete item.');
            }
            await refreshData();
            // Handle local user refresh
            if (section.id === 'users') {
                 const userResponse = await fetch(`${WEB_APP_URL}/api/users`);
                 if (userResponse.ok) {
                     const userResult = await userResponse.json();
                     if(userResult.status === 'success') setExtraUsers(userResult.data || []); // Safety check
                 }
            }
        } catch (err) {
            alert(`Error deleting item: ${(err as Error).message}`);
        }
    }
    
    const handleOpenPdfModal = () => {
        const pages = getArrayCaseInsensitive(appData, 'pages');
        if (!pages || pages.length === 0) {
            alert("No pages data to export.");
            return;
        }
        setIsPdfModalOpen(true);
    };

    const getDisplayValue = (item: any, field: ConfigField) => {
        if (!item || typeof item !== 'object') return '';
        const value = getValueCaseInsensitive(item, field.name);

        if (value === null || value === undefined) return '';
        
        if (field.type === 'image_url' && value) {
            return <img 
                src={convertGoogleDriveUrl(String(value))} 
                alt="preview" 
                className="h-10 w-auto object-contain rounded bg-gray-700" 
                referrerPolicy="no-referrer"
            />;
        }
        if (typeof value === 'boolean') {
            return value ? '✔️' : '❌';
        }
        if (field.type === 'password') {
            return '********';
        }
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        return String(value);
    }

    // Determine the data source. If it's users, check extraUsers first if appData is empty.
    let dataForSection: any[] = [];
    if (activeSection) {
        if (activeSection.id === 'users') {
            const appDataUsers = getArrayCaseInsensitive(appData, 'users');
            dataForSection = appDataUsers.length > 0 ? appDataUsers : (extraUsers || []);
        } else {
            dataForSection = getArrayCaseInsensitive(appData, activeSection.dataKey) || [];
        }
    }

    if (!appData && !activeSection) {
        return <div className="flex justify-center items-center h-full"><Spinner size="lg" /></div>;
    }

    // MOBILE VIEW
    if (isMobile && mobileSelectedSectionId && activeSection) {
        return (
            <div className="w-full md:hidden animate-fade-in">
                <div className="settings-detail-header flex justify-between items-center">
                    <div className="flex items-center">
                        <button onClick={() => setMobileSelectedSectionId(null)} className="btn btn-secondary !p-2 mr-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        </button>
                        <h2 className="text-xl font-bold">{activeSection.icon} {activeSection.title}</h2>
                    </div>
                    {activeSection.id === 'pages' && (
                        <button onClick={handleOpenPdfModal} className="btn btn-secondary !p-2" title="Export PDF">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </button>
                    )}
                </div>
                <div className="space-y-3 pb-20">
                    {dataForSection.length > 0 ? (
                        dataForSection.map((item: any, index: number) => {
                            if (!item || typeof item !== 'object') return null; // Safe guard
                            const displayTitle = getValueCaseInsensitive(item, activeSection.displayField);
                            return (
                                <div key={index} className="page-card !p-3 flex justify-between items-center">
                                    <span className="font-semibold truncate pr-2">{String(displayTitle || 'Invalid Item')}</span>
                                    <div className="flex-shrink-0 space-x-2">
                                        <button onClick={() => openModal(activeSection.id, item)} className="btn btn-secondary !p-2 text-sm">កែ</button>
                                        <button onClick={() => handleDelete(activeSection, item)} className="btn !bg-red-600/50 hover:!bg-red-600 !p-2 text-sm">លុប</button>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="page-card p-8 text-center text-gray-400">
                            មិនមានទិន្នន័យ (No Data Available)
                        </div>
                    )}
                </div>
                <button onClick={() => openModal(activeSection.id, null)} className="fab" aria-label="Add new item">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </button>
                
                {modalState.isOpen && activeSection &&
                    <ConfigEditModal 
                        section={activeSection}
                        item={modalState.item}
                        onClose={closeModal}
                        onSave={handleSave}
                    />
                }
                
                {isPdfModalOpen && (
                    <PagesPdfExportModal 
                        isOpen={isPdfModalOpen} 
                        onClose={() => setIsPdfModalOpen(false)}
                        pages={getArrayCaseInsensitive(appData, 'pages')}
                    />
                )}
            </div>
        );
    }
    
    // MOBILE LIST
    if (isMobile && !mobileSelectedSectionId) {
        return (
            <div className="md:hidden space-y-3 animate-fade-in">
                 <div className="flex justify-between items-center mb-4 px-1">
                    <h2 className="text-xl font-bold text-white">ការកំណត់ (Settings)</h2>
                    <button onClick={onBack} className="btn btn-secondary !py-1 !px-3 text-sm">
                        ត្រឡប់
                    </button>
                </div>
                {configSections.map(section => (
                    <button key={section.id} onClick={() => setMobileSelectedSectionId(section.id)} className="settings-list-item">
                        <div className="flex items-center">
                            <span className="text-2xl mr-4">{section.icon}</span>
                            <span className="font-semibold text-lg">{section.title}</span>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                    </button>
                ))}
            </div>
        );
    }

    // DESKTOP VIEW
    return (
        <div className="hidden md:flex flex-col h-full animate-fade-in">
             <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-white">ការកំណត់ (Settings)</h1>
                <button onClick={onBack} className="btn btn-secondary flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="hidden sm:inline">ត្រឡប់ទៅផ្ទាំង Admin</span>
                </button>
            </div>

            <div className="flex gap-6 h-[calc(100vh-12rem)]">
                <div className="w-72 flex-shrink-0 bg-gray-800/50 rounded-lg p-4">
                    <nav className="flex flex-col space-y-2">
                        {configSections.map(section => (
                            <a 
                                href="#" 
                                key={section.id}
                                onClick={(e) => { e.preventDefault(); setDesktopSelectedSectionId(section.id); }}
                                className={`flex items-center p-3 rounded-md transition-colors ${desktopSelectedSectionId === section.id ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-gray-700'}`}
                            >
                                <span className="mr-3 text-lg">{section.icon}</span>
                                <span>{section.title}</span>
                            </a>
                        ))}
                    </nav>
                </div>
                
                <div className="flex-grow flex flex-col page-card">
                   {activeSection && (
                        <div key={activeSection.id} className="flex flex-col h-full">
                            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                                <h3 className="text-2xl font-bold text-white">{activeSection.title}</h3>
                                <div className="flex space-x-2">
                                    {activeSection.id === 'pages' && (
                                        <button onClick={handleOpenPdfModal} className="btn btn-secondary text-sm flex items-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
                                            </svg>
                                            Export PDF
                                        </button>
                                    )}
                                    <button onClick={() => openModal(activeSection.id, null)} className="btn btn-primary text-sm">បន្ថែមថ្មី</button>
                                </div>
                            </div>
                            <div className="flex-grow overflow-auto">
                                <table className="admin-table w-full">
                                    <thead>
                                        <tr>
                                            {activeSection.fields.map(field => <th key={field.name}>{field.label}</th>)}
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dataForSection.length > 0 ? (
                                            dataForSection.map((item: any, index: number) => {
                                                if (!item || typeof item !== 'object') return null;
                                                return (
                                                    <tr key={index} className="hover:bg-gray-700/30 transition-colors">
                                                        {activeSection.fields.map(field => <td key={field.name} className="truncate max-w-xs px-4 py-3 border-b border-gray-700">{getDisplayValue(item, field)}</td>)}
                                                        <td className="w-24 px-4 py-3 border-b border-gray-700">
                                                            <div className="flex space-x-2">
                                                                <button onClick={() => openModal(activeSection.id, item)} className="action-btn text-yellow-400 hover:text-yellow-300 p-1 transition-transform hover:scale-110" aria-label={`Edit`}>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                                </button>
                                                                <button onClick={() => handleDelete(activeSection, item)} className="action-btn text-red-400 hover:text-red-300 p-1 transition-transform hover:scale-110" aria-label={`Delete`}>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={activeSection.fields.length + 1} className="text-center p-12 text-gray-400">
                                                    <div className="flex flex-col items-center justify-center opacity-60">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                                        </svg>
                                                        <p className="text-lg font-medium">មិនមានទិន្នន័យ (No Data)</p>
                                                        <p className="text-sm mt-2 max-w-xs">
                                                            There are no items in this list yet. Click "បន្ថែមថ្មី" (Add New) to create one.
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                   )}
                </div>
            </div>

            {modalState.isOpen && activeSection &&
                <ConfigEditModal 
                    section={activeSection}
                    item={modalState.item}
                    onClose={closeModal}
                    onSave={handleSave}
                />
            }

            {isPdfModalOpen && (
                <PagesPdfExportModal 
                    isOpen={isPdfModalOpen} 
                    onClose={() => setIsPdfModalOpen(false)}
                    pages={getArrayCaseInsensitive(appData, 'pages')}
                />
            )}
        </div>
    ); 
};

export default SettingsDashboard;
