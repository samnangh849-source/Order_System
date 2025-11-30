
import React, { useState, useEffect, createContext, useCallback } from 'react';
import { User, AppData, MasterProduct } from './types';
import { GoogleGenAI } from "@google/genai";
import LoginPage from './pages/LoginPage';
import RoleSelectionPage from './pages/RoleSelectionPage';
import AdminDashboard from './pages/AdminDashboard';
import UserJourney from './pages/UserJourney';
import Header from './components/common/Header';
import ImpersonationBanner from './components/common/ImpersonationBanner';
import Modal from './components/common/Modal';
import ChatWidget from './components/chat/ChatWidget';
import { WEB_APP_URL } from './constants';
import { useUrlState } from './hooks/useUrlState';

export interface AppContextType {
    currentUser: User | null;
    appData: AppData;
    login: (user: User) => void;
    logout: () => void;
    refreshData: () => Promise<void>;
    originalAdminUser: User | null;
    returnToAdmin: () => void;
    previewImage: (url: string) => void;
    updateCurrentUser: (updatedData: Partial<User>) => void;
    setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
    geminiAi: GoogleGenAI | null;
    updateProductInData: (productName: string, newData: Partial<MasterProduct>) => void;
    apiKey: string;
    setAppState: (newState: 'login' | 'role_selection' | 'admin_dashboard' | 'user_journey') => void;
    setOriginalAdminUser: React.Dispatch<React.SetStateAction<User | null>>;
    fetchData: (force?: boolean) => Promise<void>;
    setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
    setChatVisibility: (visible: boolean) => void;
}

export const AppContext = createContext<AppContextType>({} as AppContextType);

export default function App() {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [originalAdminUser, setOriginalAdminUser] = useState<User | null>(null);
    const [appData, setAppData] = useState<AppData>({} as AppData);
    
    // Use URL state for the main view to support back/forward buttons
    const [appState, setAppState] = useUrlState<'login' | 'role_selection' | 'admin_dashboard' | 'user_journey'>('view', 'login');
    
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isChatVisible, setChatVisible] = useState(true); // New state for chat visibility
    const [geminiAi, setGeminiAi] = useState<GoogleGenAI | null>(null);
    
    useEffect(() => {
        const sessionString = localStorage.getItem('orderAppSession');
        if (sessionString) {
            try {
                const session = JSON.parse(sessionString);
                if (session.user) {
                    setCurrentUser(session.user);
                    // The appState will be determined by the URL or default logic in determineAppState
                }
            } catch (e) {
                console.error("Invalid session", e);
                localStorage.removeItem('orderAppSession');
            }
        }
    }, []);

    const fetchData = useCallback(async (force = false) => {
        const cacheKey = 'appDataCache';
        const cached = localStorage.getItem(cacheKey);
        if (!force && cached) {
            try {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < 5 * 60 * 1000) { 
                    setAppData(data);
                    const apiKeySetting = data.settings?.find((s: any) => s.SettingName === 'GEMINI_API_KEY');
                    if (apiKeySetting?.SettingValue) {
                         const ai = new GoogleGenAI({ apiKey: apiKeySetting.SettingValue });
                         setGeminiAi(ai);
                    }
                    return;
                }
            } catch (e) {}
        }

        try {
            const response = await fetch(`${WEB_APP_URL}/api/static-data`);
            if (response.ok) {
                const result = await response.json();
                if (result.status === 'success') {
                    setAppData(result.data);
                    localStorage.setItem(cacheKey, JSON.stringify({ data: result.data, timestamp: Date.now() }));
                    
                    const apiKeySetting = result.data.settings?.find((s: any) => s.SettingName === 'GEMINI_API_KEY');
                    if (apiKeySetting?.SettingValue) {
                        const ai = new GoogleGenAI({ apiKey: apiKeySetting.SettingValue });
                        setGeminiAi(ai);
                    }
                }
            }
        } catch (e) {
            console.error("Failed to fetch data", e);
        }
    }, []);

    const determineAppState = useCallback((user: User, isImpersonating: boolean) => {
        // If a view is already set in the URL, try to respect it
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

    const setChatVisibility = (visible: boolean) => {
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
            setChatVisibility
        }}>
            <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
                {currentUser && appState !== 'login' && (
                    <>
                        <Header onBackToRoleSelect={() => setAppState('role_selection')} />
                        {originalAdminUser && <ImpersonationBanner />}
                        <div className={`pt-16 ${originalAdminUser ? 'mt-10' : ''}`}>
                            {renderContent()}
                        </div>
                        {isChatVisible && (
                             <button 
                                className="fixed bottom-6 right-6 p-4 bg-blue-600 text-white rounded-full shadow-lg z-40 hover:bg-blue-700"
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

                {previewImageUrl && (
                    <Modal isOpen={true} onClose={() => setPreviewImageUrl(null)} maxWidth="max-w-4xl">
                         <div className="flex justify-center">
                            <img src={previewImageUrl} alt="Preview" className="max-h-[80vh] max-w-full object-contain" />
                        </div>
                    </Modal>
                )}
            </div>
        </AppContext.Provider>
    );
}
