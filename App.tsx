
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { User, AppData, MasterProduct } from './types';
import { GoogleGenAI } from "@google/genai";
import { WEB_APP_URL } from './constants';
import { useUrlState } from './hooks/useUrlState';
import Spinner from './components/common/Spinner';
import Modal from './components/common/Modal';
import DataErrorModal from './components/common/DataErrorModal';
import { AppContext, AppContextType } from './context/AppContext';

// Lazy load pages and complex components to prevent circular dependency issues
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const RoleSelectionPage = React.lazy(() => import('./pages/RoleSelectionPage'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const UserJourney = React.lazy(() => import('./pages/UserJourney'));
const Header = React.lazy(() => import('./components/common/Header'));
const ImpersonationBanner = React.lazy(() => import('./components/common/ImpersonationBanner'));
const ChatWidget = React.lazy(() => import('./components/chat/ChatWidget'));

// Default empty state to prevent undefined errors
const initialAppData: AppData = {
    users: [],
    products: [],
    pages: [],
    locations: [],
    shippingMethods: [],
    drivers: [],
    bankAccounts: [],
    phoneCarriers: [],
    colors: [],
    settings: [],
    targets: []
};

const App: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [originalAdminUser, setOriginalAdminUser] = useState<User | null>(null);
    const [appData, setAppData] = useState<AppData>(initialAppData);
    
    // Use URL state for the main view to support back/forward buttons
    const [appState, setAppState] = useUrlState<'login' | 'role_selection' | 'admin_dashboard' | 'user_journey'>('view', 'login');
    
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isChatVisible, setChatVisible] = useState(true);
    const [geminiAi, setGeminiAi] = useState<GoogleGenAI | null>(null);
    const [dataError, setDataError] = useState<{ message: string; title: string; critical: boolean } | null>(null);
    
    useEffect(() => {
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            console.error("Unhandled promise rejection:", event.reason);
            // Prevent the default console error from showing up if we want to suppress it,
            // but usually we want to log it. We don't want to crash the app though.
        };
        window.addEventListener('unhandledrejection', handleUnhandledRejection);
        return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    }, []);

    // Initialize Gemini AI using environment variable
    useEffect(() => {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            setGeminiAi(ai);
        } catch (e) {
            console.error("Failed to initialize Gemini AI", e);
        }
    }, []);

    useEffect(() => {
        const sessionString = localStorage.getItem('orderAppSession');
        if (sessionString) {
            try {
                const session = JSON.parse(sessionString);
                if (session.user) {
                    setCurrentUser(session.user);
                    // App state will be determined by URL or logic below
                }
            } catch (e) {
                console.error("Invalid session", e);
                localStorage.removeItem('orderAppSession');
            }
        }
    }, []);

    const normalizeData = (data: any): AppData => {
        // CRITICAL FIX: Ensure we return an object with initialized arrays
        if (!data || typeof data !== 'object') return initialAppData;
        
        const normalized: any = {};
        Object.keys(data).forEach(key => {
            // Convert TitleCase keys (often from Go backend) to camelCase
            const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
            normalized[camelKey] = data[key];
        });

        // Ensure critical arrays are initialized even if missing from API
        // AND strictly filter out null/undefined items from within the arrays
        const arrayKeys = ['users', 'products', 'pages', 'locations', 'shippingMethods', 'drivers', 'bankAccounts', 'phoneCarriers', 'colors', 'settings', 'targets'];
        arrayKeys.forEach(key => {
            if (!normalized[key] || !Array.isArray(normalized[key])) {
                normalized[key] = [];
            } else {
                // Filter out any null or non-object items that might crash components
                normalized[key] = normalized[key].filter((item: any) => item !== null && typeof item === 'object');
            }
        });

        return normalized as AppData;
    };

    const fetchData = useCallback(async (force = false) => {
        const cacheKey = 'appDataCache';
        const cached = localStorage.getItem(cacheKey);
        if (!force && cached) {
            try {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < 5 * 60 * 1000) { 
                    setAppData(data);
                    return;
                }
            } catch (e) {}
        }

        try {
            const response = await fetch(`${WEB_APP_URL}/api/static-data`);
            if (response.ok) {
                const result = await response.json();
                if (result.status === 'success') {
                    // Normalize the data before setting state
                    const normalizedData = normalizeData(result.data);
                    
                    setAppData(normalizedData);
                    localStorage.setItem(cacheKey, JSON.stringify({ data: normalizedData, timestamp: Date.now() }));
                    setDataError(null); // Clear error on success
                } else {
                    throw new Error(result.message || "Unknown error from server");
                }
            } else {
                throw new Error(`HTTP Error: ${response.status}`);
            }
        } catch (e: any) {
            console.error("Failed to fetch data", e);
            // Only show blocking error if we have no cached data to show
            if (!localStorage.getItem(cacheKey)) {
                setDataError({
                    title: "ការតភ្ជាប់មានបញ្ហា (Connection Error)",
                    message: `មិនអាចទាញយកទិន្នន័យពី Server បានទេ។ សូមពិនិត្យមើលការតភ្ជាប់ Internet របស់អ្នក។\n\n(Error: ${e.message})`,
                    critical: true
                });
            }
        }
    }, []);

    const determineAppState = useCallback((user: User, isImpersonating: boolean) => {
        const params = new URLSearchParams(window.location.search);
        const currentView = params.get('view');
        
        if (currentView && ['role_selection', 'user_journey', 'admin_dashboard'].includes(currentView)) {
             if (currentView === 'admin_dashboard' && !user.IsSystemAdmin) {
                 // Fall through if permission denied
             } else {
                 setAppState(currentView as any);
                 return;
             }
        }

        if (isImpersonating) {
            setAppState('user_journey');
            return;
        }

        const teams = (user.Team || '').split(',').map(t => t.trim()).filter(Boolean);
        if (user.IsSystemAdmin) {
            if (teams.length > 0) {
                setAppState('role_selection');
            } else {
                setAppState('admin_dashboard');
            }
        } else {
            setAppState('user_journey');
        }
    }, [setAppState]);

    useEffect(() => {
        if (currentUser) {
            fetchData();
            if (appState === 'login') {
                 determineAppState(currentUser, !!originalAdminUser);
            }
        }
    }, [currentUser, fetchData, determineAppState, appState, originalAdminUser]);


    const login = (user: User) => {
        setCurrentUser(user);
        localStorage.setItem('orderAppSession', JSON.stringify({ user, timestamp: Date.now() }));
        determineAppState(user, false);
    };

    const logout = () => {
        setCurrentUser(null);
        setOriginalAdminUser(null);
        setAppState('login');
        localStorage.removeItem('orderAppSession');
        localStorage.removeItem('originalAdminSession');
    };

    const returnToAdmin = () => {
        const adminSessionString = localStorage.getItem('originalAdminSession');
        if (!adminSessionString) { logout(); return; }

        const adminSession = JSON.parse(adminSessionString);
        localStorage.setItem('orderAppSession', JSON.stringify(adminSession));
        localStorage.removeItem('originalAdminSession');

        setCurrentUser(adminSession.user);
        setOriginalAdminUser(null);
        setAppState('admin_dashboard');
    };

    const refreshData = async () => {
        localStorage.removeItem('appDataCache');
        await fetchData(true);
    };

    const updateCurrentUser = (updatedData: Partial<User>) => {
        if (currentUser) {
            const newUser = { ...currentUser, ...updatedData };
            setCurrentUser(newUser);
            localStorage.setItem('orderAppSession', JSON.stringify({ user: newUser, timestamp: Date.now() }));
        }
    };
    
    const updateProductInData = (productName: string, newData: Partial<MasterProduct>) => {
        setAppData(prev => {
            if (!prev.products) return prev;
            const updatedProducts = prev.products.map(p => 
                p.ProductName === productName ? { ...p, ...newData } : p
            );
            return { ...prev, products: updatedProducts };
        });
    };

    const setChatVisibilityState = (visible: boolean) => {
        setChatVisible(visible);
    };

    const previewImage = (url: string) => setPreviewImageUrl(url);

    const apiKey = appData.settings?.find((s: any) => s.SettingName === 'GOOGLE_MAPS_API_KEY')?.SettingValue || '';

    const renderContent = () => {
        if (!currentUser && appState !== 'login') {
             return <LoginPage />;
        }

        switch(appState) {
            case 'login': return <LoginPage />;
            case 'role_selection': return <RoleSelectionPage onSelect={(role) => setAppState(role)} />;
            case 'admin_dashboard': return <AdminDashboard />;
            case 'user_journey': return <UserJourney onBackToRoleSelect={() => setAppState('role_selection')} />;
            default: return <LoginPage />;
        }
    };

    return (
        <AppContext.Provider value={{
            currentUser,
            appData,
            login,
            logout,
            refreshData,
            originalAdminUser,
            returnToAdmin,
            previewImage,
            updateCurrentUser,
            setUnreadCount,
            geminiAi,
            updateProductInData,
            apiKey,
            setAppState,
            setOriginalAdminUser,
            fetchData,
            setCurrentUser,
            setChatVisibility: setChatVisibilityState
        }}>
            <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
                <Suspense fallback={<div className="flex h-screen items-center justify-center"><Spinner size="lg" /></div>}>
                    {currentUser && appState !== 'login' && (
                        <>
                            <Header onBackToRoleSelect={() => setAppState('role_selection')} />
                            {originalAdminUser && <ImpersonationBanner />}
                            <div className={`pt-16 ${originalAdminUser ? 'mt-10' : ''}`}>
                                {renderContent()}
                            </div>
                            {isChatVisible && (
                                <button 
                                    className={`fixed right-6 p-4 bg-blue-600 text-white rounded-full shadow-lg z-[60] hover:bg-blue-700 transition-all duration-300 ${appState === 'admin_dashboard' ? 'bottom-24 md:bottom-6' : 'bottom-6'}`}
                                    onClick={() => setIsChatOpen(true)}
                                >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">{unreadCount}</span>}
                                </button>
                            )}
                            <ChatWidget isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
                        </>
                    )}
                    {(!currentUser || appState === 'login') && <LoginPage />}
                </Suspense>

                {previewImageUrl && (
                    <Modal isOpen={true} onClose={() => setPreviewImageUrl(null)} maxWidth="max-w-4xl">
                         <div className="flex justify-center">
                            <img src={previewImageUrl} alt="Preview" className="max-h-[80vh] max-w-full object-contain" />
                        </div>
                    </Modal>
                )}

                {dataError && (
                    <DataErrorModal 
                        error={dataError} 
                        onRetry={() => { setDataError(null); fetchData(true); }} 
                        onLogout={logout} 
                    />
                )}
            </div>
        </AppContext.Provider>
    );
};

export default App;
