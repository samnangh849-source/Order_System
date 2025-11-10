
import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { User } from './types';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import RoleSelectionPage from './pages/RoleSelectionPage';
import UserJourney from './pages/UserJourney';
import Header from './components/common/Header';
import ImpersonationBanner from './components/common/ImpersonationBanner';
import Spinner from './components/common/Spinner';
import { WEB_APP_URL } from './constants';
import ChatWidget from './components/chat/ChatWidget';

declare global {
    interface Window {
        Html5Qrcode: any;
    }
}

// Mock environment variable for demonstration
// In a real environment, this would be set through a build process or server-side injection.
if (!process.env.API_KEY) {
    process.env.API_KEY = "YOUR_GEMINI_API_KEY"; // Replace with a placeholder or handle appropriately
}

export const AppContext = React.createContext<{
    currentUser: User | null;
    originalAdminUser: User | null;
    appData: any;
    login: (user: User) => void;
    logout: () => void;
    loginAs: (targetUser: User) => void;
    returnToAdmin: () => void;
    refreshData: () => Promise<void>;
    geminiAi: GoogleGenAI | null;
    isChatVisible: boolean;
    setChatVisibility: (visible: boolean) => void;
    previewImage: (url: string) => void;
}>({
    currentUser: null,
    originalAdminUser: null,
    appData: {},
    login: () => {},
    logout: () => {},
    loginAs: () => {},
    returnToAdmin: () => {},
    refreshData: async () => {},
    geminiAi: null,
    isChatVisible: true,
    setChatVisibility: () => {},
    previewImage: () => {},
});

const ImagePreviewModal: React.FC<{ imageUrl: string | null; onClose: () => void }> = ({ imageUrl, onClose }) => {
    if (!imageUrl) return null;

    const handleDownload = (e: React.MouseEvent) => {
        e.preventDefault();
        fetch(imageUrl)
            .then(response => response.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                const name = imageUrl.substring(imageUrl.lastIndexOf('/') + 1).split('?')[0] || 'image.jpg';
                a.download = name;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            })
            .catch(() => alert('Could not download image.'));
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[9999] p-4 animate-fade-in"
            onClick={onClose}
        >
            <div
                className="relative max-w-4xl max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <img src={imageUrl} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
                <div className="absolute top-2 right-2 flex gap-2">
                     <a
                        href={imageUrl}
                        onClick={handleDownload}
                        className="p-2 bg-gray-800/80 text-white rounded-full hover:bg-gray-700 transition-colors"
                        title="Download Image"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                    </a>
                    <button 
                        onClick={onClose} 
                        className="p-2 bg-gray-800/80 text-white rounded-full hover:bg-gray-700 transition-colors"
                        title="Close"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                         </svg>
                    </button>
                </div>
            </div>
             <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in { animation: fade-in 0.2s forwards; }
            `}</style>
        </div>
    );
};


const App: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [originalAdminUser, setOriginalAdminUser] = useState<User | null>(null);
    const [appData, setAppData] = useState<any>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [appState, setAppState] = useState<'login' | 'role_selection' | 'user_journey' | 'admin_dashboard'>('login');
    const [geminiAi, setGeminiAi] = useState<GoogleGenAI | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isChatVisible, setIsChatVisible] = useState(true);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const flare = document.querySelector('.flare-light');
            if (flare) {
                (flare as HTMLElement).style.setProperty('--x', `${e.clientX}px`);
                (flare as HTMLElement).style.setProperty('--y', `${e.clientY}px`);
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setPreviewImageUrl(null);
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    useEffect(() => {
        const isAdminView = appState === 'admin_dashboard';
        if (isAdminView) {
            document.body.classList.add('admin-view');
        } else {
            document.body.classList.remove('admin-view');
        }
        // Cleanup on appState change or unmount
        return () => {
            document.body.classList.remove('admin-view');
        };
    }, [appState]);

    const logout = useCallback(() => {
        localStorage.removeItem('orderAppSession');
        localStorage.removeItem('originalAdminSession');
        localStorage.removeItem('appDataCache');
        setCurrentUser(null);
        setOriginalAdminUser(null);
        setAppData({});
        setAppState('login');
    }, []);

    const fetchData = useCallback(async (forceRefresh = false) => {
        setLoading(true);
        const CACHE_KEY = 'appDataCache';
        const CACHE_DURATION = 3600 * 1000; // 1 hour

        const cachedDataString = localStorage.getItem(CACHE_KEY);
        let cachedDataJson: any = null;
        if (cachedDataString) {
            try {
                cachedDataJson = JSON.parse(cachedDataString);
            } catch (e) {
                console.error("Failed to parse cache", e);
                localStorage.removeItem(CACHE_KEY); // Clear corrupted cache
            }
        }

        const isCacheFresh = cachedDataJson && (new Date().getTime() - cachedDataJson.timestamp < CACHE_DURATION);

        if (isCacheFresh && !forceRefresh) {
            setAppData(cachedDataJson.data);
            setLoading(false);
            return;
        }

        // If we're fetching, but have some (even stale) cache, set it first for a better UX
        if (cachedDataJson) {
            setAppData(cachedDataJson.data);
        }

        try {
            // Fetch data sequentially to improve reliability on slow-starting servers
            const staticResponse = await fetch(`${WEB_APP_URL}/api/static-data`);
            if (!staticResponse.ok) {
                throw new Error(`Could not fetch static app data from server. Status: ${staticResponse.status}`);
            }
            
            const usersResponse = await fetch(`${WEB_APP_URL}/api/users`);
            if (!usersResponse.ok) {
                throw new Error(`Could not fetch users data from server. Status: ${usersResponse.status}`);
            }

            const staticResult = await staticResponse.json();
            const usersResult = await usersResponse.json();

            if (staticResult.status !== 'success' || usersResult.status !== 'success') {
                throw new Error('Failed to parse app data.');
            }

            const combinedData = { ...staticResult.data, users: usersResult.data };
            setAppData(combinedData);
            localStorage.setItem(CACHE_KEY, JSON.stringify({ data: combinedData, timestamp: new Date().getTime() }));
        } catch (error) {
            console.error("Data Fetching Error:", error);

            let alertMessage = "An unexpected error occurred while fetching data. The app will use older, cached data if available.";

            if (error instanceof Error && error.message.includes("Status: 500")) {
                alertMessage = "A server error (500) occurred while fetching data.\n\n" +
                               "This is likely caused by an issue with the data in your Google Sheets.\n\n" +
                               "Common causes:\n" +
                               "- Text in a column that should be a number (e.g., 'Price', 'Cost').\n" +
                               "- A sheet name or column header has been changed.\n\n" +
                               "Please check the data in your sheets, especially 'Products', for any errors.\n\n" +
                               "The app will now try to use older, cached data.";
            }

            if (!cachedDataJson) {
                alert("Critical Error: Could not load initial application data.\n" + (error instanceof Error ? error.message : String(error)) + "\n\nPlease resolve the server issue and try again. The session will now be closed.");
                logout();
            } else {
                alert("Warning:\n" + alertMessage);
                console.warn("Failed to refresh data, using stale cached version.");
            }
        } finally {
            setLoading(false);
        }
    }, [logout]);

    const determineAppState = useCallback((user: User, isImpersonating: boolean) => {
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
    }, []);

    const checkSession = useCallback(async () => {
        setLoading(true);
        try {
            const originalAdminSessionString = localStorage.getItem('originalAdminSession');
            const sessionDataString = localStorage.getItem('orderAppSession');

            if (sessionDataString) {
                const sessionData = JSON.parse(sessionDataString);
                const now = new Date().getTime();
                const sevenDaysInMillis = 7 * 24 * 60 * 60 * 1000;

                if (now - sessionData.timestamp > sevenDaysInMillis) {
                    logout();
                } else {
                    const user = sessionData.user;
                    setCurrentUser(user);
                    await fetchData();
                    let isImpersonating = false;
                    if (originalAdminSessionString) {
                        setOriginalAdminUser(JSON.parse(originalAdminSessionString).user);
                        isImpersonating = true;
                    }
                    determineAppState(user, isImpersonating);
                }
            }
        } catch (error) {
            console.error("Session check failed:", error);
            logout(); // Clear corrupted session
        } finally {
            setLoading(false);
        }
    }, [fetchData, determineAppState, logout]);

    useEffect(() => {
        checkSession();
        if (process.env.API_KEY && process.env.API_KEY !== "YOUR_GEMINI_API_KEY") {
             setGeminiAi(new GoogleGenAI({apiKey: process.env.API_KEY}));
        } else {
            console.warn("Gemini API key is not configured. AI features will be disabled.");
        }
    }, [checkSession]);

    const login = (user: User) => {
        const sessionData = { user, timestamp: new Date().getTime() };
        localStorage.setItem('orderAppSession', JSON.stringify(sessionData));
        setCurrentUser(user);
        fetchData(true).then(() => {
            determineAppState(user, false);
        });
    };
    
    const loginAs = (targetUser: User) => {
        if (!currentUser || !currentUser.IsSystemAdmin) return;
        
        const adminSession = { user: currentUser, timestamp: new Date().getTime() };
        localStorage.setItem('originalAdminSession', JSON.stringify(adminSession));
        
        const userSession = { user: targetUser, timestamp: new Date().getTime() };
        localStorage.setItem('orderAppSession', JSON.stringify(userSession));
        
        setOriginalAdminUser(currentUser);
        setCurrentUser(targetUser);
        setAppState('user_journey');
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
        await fetchData(true);
    };
    
    const previewImage = (url: string) => {
        if (url && !url.includes('placehold.co')) {
             setPreviewImageUrl(url);
        }
    };

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen">
                     <div className="page-card inline-flex flex-col items-center">
                        <Spinner size="lg"/>
                        <p className="font-semibold text-lg mt-4">កំពុងទាញយកទិន្នន័យ...</p>
                     </div>
                </div>
            );
        }

        switch (appState) {
            case 'login':
                return <LoginPage />;
            case 'role_selection':
                return <RoleSelectionPage onSelect={(role) => setAppState(role)} />;
            case 'admin_dashboard':
                return <AdminDashboard />;
            case 'user_journey':
                return <UserJourney onBackToRoleSelect={() => setAppState('role_selection')} />;
            default:
                return <LoginPage />;
        }
    };
    
    return (
        <AppContext.Provider value={{ currentUser, originalAdminUser, appData, login, logout, loginAs, returnToAdmin, refreshData, geminiAi, isChatVisible, setChatVisibility: setIsChatVisible, previewImage }}>
            <div className="min-h-screen w-full">
                {originalAdminUser && <ImpersonationBanner />}
                {currentUser && <Header onBackToRoleSelect={() => setAppState('role_selection')} />}
                <main className={`w-full transition-all duration-500 ${currentUser ? `pt-24 pb-8 px-2 sm:px-4 ${originalAdminUser ? 'mt-10' : ''}` : 'flex items-center justify-center min-h-screen p-2 sm:p-4'}`}>
                   {renderContent()}
                </main>
                {currentUser && isChatVisible && (
                    <>
                        <ChatWidget isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
                        {!isChatOpen && (
                            <button onClick={() => setIsChatOpen(true)} className="chat-fab" aria-label="Open Chat">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </button>
                        )}
                    </>
                )}
                 <ImagePreviewModal imageUrl={previewImageUrl} onClose={() => setPreviewImageUrl(null)} />
            </div>
        </AppContext.Provider>
    );
};

export default App;
