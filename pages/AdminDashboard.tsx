
import React, { useState, useContext, useEffect, useMemo, useRef } from 'react';
import { AppContext } from '../App';
import Spinner from '../components/common/Spinner';
import { User, FullOrder, ParsedOrder } from '../types';
import EditOrderPage from './EditOrderPage';
import BottomNavBar from '../components/admin/BottomNavBar';
import OrdersList from '../components/orders/OrdersList';
import ReportsView from '../components/admin/ReportsView';
import Modal from '../components/common/Modal';
import { WEB_APP_URL } from '../constants';
import PerformanceTrackingPage from './PerformanceTrackingPage';
import { fileToBase64, convertGoogleDriveUrl } from '../utils/fileUtils';


type AdminView = 'dashboard' | 'orders' | 'reports' | 'performance' | 'config';

const configSections = [
    { id: 'users', title: 'អ្នកប្រើប្រាស់', icon: '👤', dataKey: 'users', sheetName: 'Users', primaryKeyField: 'UserName', fields: [ { name: 'FullName', label: 'ឈ្មោះពេញ', type: 'text' }, { name: 'UserName', label: 'ឈ្មោះគណនី', type: 'text' }, { name: 'Password', label: 'ពាក្យសម្ងាត់', type: 'password' }, { name: 'Role', label: 'តួនាទី', type: 'text' }, { name: 'Team', label: 'ក្រុម', type: 'text' }, { name: 'ProfilePictureURL', label: 'URL រូបភាព', type: 'image_url' }, { name: 'IsSystemAdmin', label: 'Admin?', type: 'checkbox' } ], displayField: 'FullName' },
    { id: 'products', title: 'ផលិតផល', icon: '🛍️', dataKey: 'products', sheetName: 'Products', primaryKeyField: 'ProductName', fields: [ { name: 'ProductName', label: 'ឈ្មោះផលិតផល', type: 'text' }, { name: 'Barcode', label: 'Barcode', type: 'text' }, { name: 'Price', label: 'តម្លៃ', type: 'number' }, { name: 'Cost', label: 'តម្លៃដើម', type: 'number' }, { name: 'ImageURL', label: 'URL រូបភាព', type: 'image_url' } ], displayField: 'ProductName' },
    { id: 'pages', title: 'ក្រុម & Page', icon: '👥', dataKey: 'pages', sheetName: 'TeamsPages', primaryKeyField: 'PageName', fields: [ { name: 'PageName', label: 'ឈ្មោះ Page', type: 'text' }, { name: 'Team', label: 'ក្រុម', type: 'text' }, { name: 'TelegramValue', label: 'Telegram Value', type: 'text' }, { name: 'PageLogoURL', label: 'URL ឡូហ្គោ', type: 'image_url' } ], displayField: 'PageName' },
    { id: 'shippingMethods', title: 'សេវាដឹកជញ្ជូន', icon: '🚚', dataKey: 'shippingMethods', sheetName: 'ShippingMethods', primaryKeyField: 'MethodName', fields: [ { name: 'MethodName', label: 'ឈ្មោះសេវា', type: 'text' }, { name: 'RequireDriverSelection', label: 'ត្រូវការអ្នកដឹក?', type: 'checkbox' }, { name: 'LogosURL', label: 'URL ឡូហ្គោ', type: 'image_url' } ], displayField: 'MethodName' },
    { id: 'drivers', title: 'អ្នកដឹក', icon: '🛵', dataKey: 'drivers', sheetName: 'Drivers', primaryKeyField: 'DriverName', fields: [ { name: 'DriverName', label: 'ឈ្មោះអ្នកដឹក', type: 'text' }, { name: 'ImageURL', label: 'URL រូបថត', type: 'image_url' } ], displayField: 'DriverName' },
    { id: 'bankAccounts', title: 'គណនីធនាគារ', icon: '🏦', dataKey: 'bankAccounts', sheetName: 'BankAccounts', primaryKeyField: 'AccountNumber', fields: [ { name: 'BankName', label: 'ឈ្មោះធនាគារ', type: 'text' }, { name: 'AccountName', label: 'ឈ្មោះគណនី', type: 'text' }, { name: 'AccountNumber', label: 'លេខគណនី', type: 'text' }, { name: 'LogoURL', label: 'URL ឡូហ្គោ', type: 'image_url' } ], displayField: 'BankName' },
    { id: 'phoneCarriers', title: 'ក្រុមហ៊ុនទូរស័ព្ទ', icon: '📱', dataKey: 'phoneCarriers', sheetName: 'PhoneCarriers', primaryKeyField: 'CarrierName', fields: [ { name: 'CarrierName', label: 'ឈ្មោះក្រុមហ៊ុន', type: 'text' }, { name: 'Prefixes', label: 'Prefixes (បំបែកដោយក្បៀស)', type: 'text' }, { name: 'CarrierLogoURL', label: 'URL ឡូហ្គោ', type: 'image_url' } ], displayField: 'CarrierName' },
];

const ConfigEditModal = ({ section, item, onClose, onSave }: { section: typeof configSections[0], item: any | null, onClose: () => void, onSave: (item: any) => void }) => {
    const { refreshData } = useContext(AppContext);
    const [formData, setFormData] = useState<any>(item || {});
    const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const [passwordVisibility, setPasswordVisibility] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!item) {
            const defaultData = section.fields.reduce((acc, field) => {
                acc[field.name] = field.type === 'checkbox' ? false : field.type === 'number' ? 0 : '';
                return acc;
            }, {} as any);
            setFormData(defaultData);
        } else {
            setFormData(item);
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
            if (field.type !== 'checkbox' && !formData[field.name] && field.name !== 'Password' && !item) {
                 setError(`Please fill in the "${field.label}" field.`);
                 return;
            }
        }
        setIsLoading(true);
        try {
            const endpoint = item ? '/api/admin/update-sheet' : '/api/admin/add-row';
            const payload: any = {
                sheetName: section.sheetName,
                newData: formData
            };
            if (item) {
                payload.primaryKey = { [section.primaryKeyField]: item[section.primaryKeyField] };
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
                                    <img src={convertGoogleDriveUrl(formData[field.name])} alt="Preview" className="mt-2 h-20 w-auto rounded object-contain bg-gray-700 p-1" />
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
                                    placeholder={item ? '(មិនផ្លាស់ប្តូរ)' : ''}
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

const ConfigView = () => {
    const { appData, refreshData } = useContext(AppContext);
    const [selectedSectionId, setSelectedSectionId] = useState<string>('users'); // Default selection for desktop
    const [mobileSelectedSectionId, setMobileSelectedSectionId] = useState<string | null>(null); // For mobile view flow
    const [modalState, setModalState] = useState<{ isOpen: boolean, sectionId: string, item: any | null }>({ isOpen: false, sectionId: '', item: null });

    const activeSectionId = window.innerWidth < 768 ? mobileSelectedSectionId : selectedSectionId;
    const activeSection = configSections.find(s => s.id === activeSectionId);

    const openModal = (sectionId: string, item: any | null = null) => {
        setModalState({ isOpen: true, sectionId, item });
    };

    const closeModal = () => {
        setModalState({ isOpen: false, sectionId: '', item: null });
    };
    
    const handleSave = () => {
        // This is now handled inside the modal, which calls refreshData on success
        closeModal();
    }

    const handleDelete = async (section: typeof configSections[0], item: any) => {
        if (!window.confirm(`តើអ្នកប្រាកដទេថាចង់លុប ${item[section.displayField || '']}?`)) return;

        try {
            const payload = {
                sheetName: section.sheetName,
                primaryKey: { [section.primaryKeyField]: item[section.primaryKeyField] }
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
        } catch (err) {
            alert(`Error deleting item: ${(err as Error).message}`);
        }
    }
    
    const getDisplayValue = (item: any, field: any) => {
        const value = item[field.name];
        if (field.type === 'image_url' && value) {
            return <img src={convertGoogleDriveUrl(value)} alt="preview" className="h-10 w-auto object-contain rounded bg-gray-700" />;
        }
        if (typeof value === 'boolean') {
            return value ? '✔️' : '❌';
        }
        if (field.type === 'password') {
            return '********';
        }
        return String(value);
    }

    // MOBILE: Detail view for a selected section
    if (mobileSelectedSectionId && activeSection) {
        const dataForSelectedSection = appData[activeSection.dataKey as keyof typeof appData] || [];
        return (
            <div className="w-full md:hidden animate-fade-in">
                <div className="flex items-center mb-4">
                    <button onClick={() => setMobileSelectedSectionId(null)} className="btn btn-secondary !p-2 mr-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </button>
                    <h2 className="text-xl font-bold">{activeSection.icon} {activeSection.title}</h2>
                </div>
                <div className="space-y-3 pb-20">
                    {dataForSelectedSection.map((item: any, index: number) => (
                        <div key={index} className="page-card !p-3 flex justify-between items-center">
                            <span className="font-semibold truncate pr-2">{item[activeSection.displayField]}</span>
                            <div className="flex-shrink-0 space-x-2">
                                <button onClick={() => openModal(activeSection.id, item)} className="btn btn-secondary !p-2 text-sm">កែ</button>
                                <button onClick={() => handleDelete(activeSection, item)} className="btn !bg-red-600/50 hover:!bg-red-600 !p-2 text-sm">លុប</button>
                            </div>
                        </div>
                    ))}
                </div>
                <button onClick={() => openModal(activeSection.id, null)} className="chat-fab !w-14 !h-14" aria-label="Add new item">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </button>
            </div>
        );
    }
    
    return (
        <div className="w-full">
            <style>{`.animate-fade-in { animation: fadeIn 0.5s ease-in-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            
            {/* MOBILE: List of sections */}
            <div className="md:hidden space-y-3 animate-fade-in">
                {configSections.map(section => (
                    <button key={section.id} onClick={() => setMobileSelectedSectionId(section.id)} className="w-full text-left page-card !p-4 flex items-center justify-between hover:bg-gray-700 transition-colors">
                        <div className="flex items-center">
                            <span className="text-2xl mr-4">{section.icon}</span>
                            <span className="font-semibold text-lg">{section.title}</span>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                    </button>
                ))}
            </div>

            {/* DESKTOP/TABLET: Two-pane layout */}
            <div className="hidden md:flex gap-6 animate-fade-in h-[calc(100vh-12rem)]">
                {/* Left Navigation Sidebar */}
                <div className="w-72 flex-shrink-0 bg-gray-800/50 rounded-lg p-4">
                    <nav className="flex flex-col space-y-2">
                        {configSections.map(section => (
                            <a 
                                href="#" 
                                key={section.id}
                                onClick={(e) => { e.preventDefault(); setSelectedSectionId(section.id); }}
                                className={`flex items-center p-3 rounded-md transition-colors ${selectedSectionId === section.id ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-gray-700'}`}
                            >
                                <span className="mr-3 text-lg">{section.icon}</span>
                                <span>{section.title}</span>
                            </a>
                        ))}
                    </nav>
                </div>
                
                {/* Right Content Area */}
                <div className="flex-grow flex flex-col page-card">
                   {configSections.filter(s => s.id === selectedSectionId).map(section => {
                       const data = appData[section.dataKey as keyof typeof appData] || [];
                       const columns = section.fields;
                       return(
                            <div key={section.id} className="flex flex-col h-full">
                                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                                    <h3 className="text-2xl font-bold text-white">{section.title}</h3>
                                    <button onClick={() => openModal(section.id, null)} className="btn btn-primary text-sm">បន្ថែមថ្មី</button>
                                </div>
                                <div className="flex-grow overflow-auto">
                                    <table className="admin-table w-full">
                                        <thead>
                                            <tr>
                                                {columns.map(field => <th key={field.name}>{field.label}</th>)}
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.map((item: any, index: number) => (
                                                <tr key={index}>
                                                    {columns.map(field => <td key={field.name} className="truncate max-w-xs">{getDisplayValue(item, field)}</td>)}
                                                    <td className="w-24">
                                                        <div className="flex space-x-1">
                                                            <button onClick={() => openModal(section.id, item)} className="action-btn text-yellow-400 hover:text-yellow-600 p-1" aria-label={`Edit ${item[section.displayField]}`}>✏️</button>
                                                            <button onClick={() => handleDelete(section, item)} className="action-btn text-red-400 hover:text-red-600 p-1" aria-label={`Delete ${item[section.displayField]}`}>🗑️</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                       )
                    })}
                </div>
            </div>

            {modalState.isOpen && 
                <ConfigEditModal 
                    section={configSections.find(s => s.id === modalState.sectionId)!}
                    item={modalState.item}
                    onClose={closeModal}
                    onSave={handleSave}
                />
            }
        </div>
    );
};

const AdminDashboard: React.FC = () => {
    const { appData } = useContext(AppContext);
    const [currentView, setCurrentView] = useState<AdminView>('dashboard');
    const [isConfigPageVisible, setIsConfigPageVisible] = useState(false);
    const [editingOrder, setEditingOrder] = useState<ParsedOrder | null>(null);
    const [allOrders, setAllOrders] = useState<ParsedOrder[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [ordersError, setOrdersError] = useState('');
    
    const appDataLoading = !appData || Object.keys(appData).length === 0;

    useEffect(() => {
        const fetchOrders = async () => {
            if (currentView === 'orders' || currentView === 'reports' || currentView === 'performance') {
                setOrdersLoading(true);
                setOrdersError('');
                try {
                    const response = await fetch(`${WEB_APP_URL}/api/admin/all-orders`);
                    if (!response.ok) {
                        let errorMessage = 'Failed to fetch orders from the server.';
                        try {
                            const errorData = await response.json();
                            if (errorData && errorData.message) {
                                errorMessage = `Server responded with an error: ${errorData.message}`;
                            } else {
                                errorMessage = `Server responded with status: ${response.status}`;
                            }
                        } catch (e) {
                            errorMessage = `Failed to fetch orders from the server. Status: ${response.status}`;
                        }
                        throw new Error(errorMessage);
                    }
                    const result = await response.json();
                    if (result.status !== 'success') {
                        throw new Error(result.message || 'Error in API response for orders.');
                    }
                    
                    const rawOrders: FullOrder[] = result.data;
                    const parsed = rawOrders.map(o => {
                        let products = [];
                        try {
                            if (o['Products (JSON)'] && typeof o['Products (JSON)'] === 'string') {
                                products = JSON.parse(o['Products (JSON)']);
                            }
                        } catch(e) { 
                            console.error("Failed to parse products JSON for order:", o['Order ID'], o['Products (JSON)']);
                        }
                        return { ...o, Products: products };
                    });
                    setAllOrders(parsed);
                } catch (err: any) {
                    let friendlyErrorMessage = `មិនអាចទាញយកប្រតិបត្តិការណ៍បានទេ: ${err.message}`;
                    if (err.message && err.message.includes('cannot unmarshal number into Go struct field')) {
                        friendlyErrorMessage = `មានបញ្ហាទិន្នន័យនៅក្នុង Google Sheet!\n\n` +
                            `Server បានបរាជ័យក្នុងការអានទិន្នន័យ ព្រោះជួរឈរមួយចំនួនដូចជា "Customer Name" ឬ "Note" មានផ្ទុកទិន្នន័យជាលេខ ជំនួសឱ្យអក្សរ។\n\n` +
                            `➡️ សូមចូលទៅកាន់សន្លឹក "AllOrders" របស់អ្នក ហើយពិនិត្យមើលជួរឈរទាំងនោះ។\n` +
                            `➡️ សូមប្រាកដថា ទិន្នន័យទាំងអស់ក្នុងជួរឈរនេះជាអក្សរ។ (ឧទាហរណ៍៖ បើមានលេខ 123 សូមប្តូរទៅជា '123)។\n` +
                            `➡️ ដើម្បីជៀសវាងបញ្ហានេះនាពេលអនាគត សូម Format ជួរឈរទាំងមូលជា "Plain Text"។`;
                    }
                    setOrdersError(friendlyErrorMessage);
                } finally {
                    setOrdersLoading(false);
                }
            }
        };
        fetchOrders();
    }, [currentView]); // Refetch when view changes to orders or reports

    const handleNavChange = (view: AdminView) => {
        if (view === 'config') {
            setIsConfigPageVisible(true);
        } else {
            setCurrentView(view);
        }
    };

    const Sidebar = () => (
         <aside className="hidden md:flex w-64 bg-gray-800 text-gray-300 flex-shrink-0 p-4 flex-col">
            <h2 className="text-xl font-bold text-white mb-6">Admin Panel</h2>
            <nav className="admin-sidebar-nav flex flex-col space-y-2">
                {(Object.keys(viewConfig) as AdminView[]).map(view => {
                    const { label, icon } = viewConfig[view];
                    return (
                        <a 
                            href="#" 
                            key={view}
                            onClick={(e) => { e.preventDefault(); handleNavChange(view); }}
                            className={`flex items-center p-3 rounded-md ${currentView === view && view !== 'config' ? 'active' : ''}`}
                            title={label}
                        >
                            {icon}
                            <span className="ml-4">{label}</span>
                        </a>
                    );
                })}
            </nav>
        </aside>
    );

    const DashboardView = () => {
        const safeLength = (data: any) => (Array.isArray(data) ? data.length : 0);
        const stats = [
            { label: 'អ្នកប្រើប្រាស់', value: safeLength(appData.users), icon: '👤' },
            { label: 'ក្រុម (Teams)', value: safeLength(appData.pages?.map((p: any) => p.Team).filter((v: any, i: any, a: any) => a.indexOf(v) === i)), icon: '👥' },
            { label: 'ផលិតផល', value: safeLength(appData.products), icon: '🛍️' },
            { label: 'អ្នកដឹកជញ្ជូន', value: safeLength(appData.drivers), icon: '🚚' },
            { label: 'គណនីធនាគារ', value: safeLength(appData.bankAccounts), icon: '🏦' }
        ];
        return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {stats.map(stat => (
                    <div key={stat.label} className="page-card flex flex-col items-center justify-center p-4 text-center aspect-square transition-all duration-300 hover:bg-gray-700/50 hover:border-blue-500">
                        <div className="text-4xl sm:text-5xl mb-2">{stat.icon}</div>
                        <p className="text-3xl sm:text-4xl font-bold text-white">{stat.value}</p>
                        <p className="text-xs sm:text-sm text-gray-400 mt-1 truncate w-full">{stat.label}</p>
                    </div>
                ))}
            </div>
        );
    };

    const teams = useMemo(() => {
        if (!allOrders) return [];
        return Array.from(new Set(allOrders.map(o => o.Team).filter(Boolean)));
    }, [allOrders]);
    
    const viewConfig = {
        dashboard: { label: 'ទិន្នន័យសង្ខេប', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
        orders: { label: 'ប្រតិបត្តិការណ៍', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002 2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg> },
        reports: { label: 'របាយការណ៍', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
        performance: { label: 'សមិទ្ធផល', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> },
        config: { label: 'ការគ្រប់គ្រង', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" /></svg> },
    };

    const handleSaveOrder = (updatedOrder: ParsedOrder) => {
        console.log('Order saved:', updatedOrder);
        setEditingOrder(null);
    };

    const renderView = () => {
        if (appDataLoading) {
            return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
        }

        if (editingOrder) {
            return <EditOrderPage order={editingOrder} onSave={handleSaveOrder} onCancel={() => setEditingOrder(null)} />;
        }
        
        if (ordersLoading && (currentView === 'orders' || currentView === 'reports' || currentView === 'performance')) {
             return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
        }
        
        if (ordersError && (currentView === 'orders' || currentView === 'reports' || currentView === 'performance')) {
             return <p className="text-center text-red-400 p-8 whitespace-pre-wrap">{ordersError}</p>;
        }

        switch (currentView) {
            case 'dashboard': return <DashboardView />;
            case 'orders': return <OrdersList orders={allOrders} onEdit={setEditingOrder} showActions={true} teams={teams} />;
            case 'reports': return <ReportsView orders={allOrders} />;
            case 'performance': return <PerformanceTrackingPage orders={allOrders} users={appData.users || []} targets={appData.targets || []} />;
            default: return <div>Select a view</div>;
        }
    };

    if (isConfigPageVisible) {
        return (
            <div className="w-full max-w-7xl mx-auto p-2 sm:p-4 lg:p-6 animate-fade-in">
                 <style>{`.animate-fade-in { animation: fadeIn 0.5s ease-in-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center">
                        {viewConfig.config.icon}
                        <span className="ml-3">{viewConfig.config.label}</span>
                    </h1>
                    <button onClick={() => setIsConfigPageVisible(false)} className="btn btn-secondary">
                        ត្រឡប់ទៅ Dashboard
                    </button>
                </div>
                <ConfigView />
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-[calc(100vh-6rem)] w-full max-w-7xl mx-auto">
            <Sidebar />
            <main className="flex-1 p-2 sm:p-4 lg:p-6 overflow-y-auto md:ml-64 pb-20 md:pb-6">
                 <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl md:text-3xl font-bold text-white">{editingOrder ? `កែសម្រួល ID: ${editingOrder['Order ID']}` : viewConfig[currentView].label}</h1>
                </div>
                {renderView()}
            </main>
            <BottomNavBar currentView={currentView} onViewChange={handleNavChange} viewConfig={viewConfig} />
        </div>
    );
};

export default AdminDashboard;