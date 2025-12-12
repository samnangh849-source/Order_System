
import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import Spinner from '../components/common/Spinner';
import { WEB_APP_URL, APP_LOGO_URL } from '../constants';
import { User } from '../types';
import { convertGoogleDriveUrl } from '../utils/fileUtils';

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<{
        status: 'checking' | 'success' | 'error' | 'warning';
        message: string;
    }>({ status: 'checking', message: 'កំពុងពិនិត្យការតភ្ជាប់...' });
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const { login } = useContext(AppContext);

    useEffect(() => {
        const verifyWebAppUrl = async () => {
            if (!WEB_APP_URL || WEB_APP_URL.includes("your-app-name.onrender.com")) {
                setConnectionStatus({ 
                    status: 'error', 
                    message: 'URL មិនទាន់បានកំណត់រចនាសម្ព័ន្ធ។ សូមដាក់ Render URL នៅក្នុងไฟล์ constants.ts' 
                });
                return;
            }
            
            const maxRetries = 10;
            const retryDelay = 3500;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    setConnectionStatus({ 
                        status: 'checking', 
                        message: `កំពុងព្យាយាមភ្ជាប់ (លើកទី ${attempt}/${maxRetries})...` 
                    });

                    const response = await fetch(`${WEB_APP_URL}/api/ping?t=${new Date().getTime()}`);

                    if (!response.ok) {
                        if (response.status === 404) throw new Error('404 Not Found');
                        if (response.status === 401 || response.status === 403) throw new Error('403 Forbidden');
                        throw new Error(`Server responded with status: ${response.status}`);
                    }

                    const data = await response.json();
                    if (data.status === 'success' && data.message === 'Go backend pong') {
                        setConnectionStatus({ status: 'success', message: 'ការតភ្ជាប់ជោគជ័យ' });
                        return;
                    } else {
                        setConnectionStatus({ 
                            status: 'warning', 
                            message: 'Server អាចតភ្ជាប់បាន ប៉ុន្តែការឆ្លើយតបពី ping ខុសពីការរំពឹងទុក។' 
                        });
                        return;
                    }
                } catch (error: any) {
                    console.error(`Connection attempt ${attempt} failed:`, error);
                    if (attempt === maxRetries) {
                        let userMessage = 'ការតភ្ជាប់បរាជ័យ។ សូមពិនិត្យ URL, ការតភ្ជាប់ Internet, និងការកំណត់ Deployment របស់អ្នក។';
                        if (error.message && error.message.includes('404')) {
                            userMessage = 'API endpoint រកមិនឃើញ (404)។ សូមប្រាកដថាអ្នកបាន Deploy API របស់អ្នកត្រឹមត្រូវ។';
                        } else if (error.message && (error.message.includes('401') || error.message.includes('403'))) {
                            userMessage = 'បញ្ហាសិទ្ធិ (403)។ សូមពិនិត្យការកំណត់ API key ឬ security rules។';
                        } else if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
                            userMessage = 'មិនអាចភ្ជាប់ទៅ Server បានទេ។ Server ប្រហែលជាត្រូវចំណាយពេលដើម្បីចាប់ផ្តើម។ សូមពិនិត្យមើល Internet របស់អ្នក និងការកំណត់ CORS លើ Render service។';
                        }
                        setConnectionStatus({ status: 'error', message: userMessage });
                    } else {
                        await new Promise(res => setTimeout(res, retryDelay));
                    }
                }
            }
        };
        verifyWebAppUrl();
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch(`${WEB_APP_URL}/api/users`);
            if (!response.ok) {
                throw new Error('មិនអាចទាញយកទិន្នន័យអ្នកប្រើប្រាស់បានទេ។');
            }
            const result = await response.json();
            if (result.status !== 'success') {
                 throw new Error(result.message || 'ការទាញយកទិន្នន័យអ្នកប្រើប្រាស់បានបរាជ័យ។');
            }

            const users: User[] = result.data;
            const foundUser = users.find(u => u.UserName === username && u.Password === password);
            
            if (foundUser) {
                const userToLogin = { ...foundUser };
                delete userToLogin.Password;
                login(userToLogin);
            } else {
                setError('ឈ្មោះគណនី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ');
            }
        } catch (err: any) {
            setError('ការ Login បរាជ័យ៖ ' + err.message);
        } finally {
            setLoading(false);
        }
    };
    
    const statusClasses = {
        checking: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        success: 'bg-green-500/10 text-green-400 border-green-500/20',
        error: 'bg-red-500/10 text-red-400 border-red-500/20',
        warning: 'bg-orange-500/10 text-orange-400 border-orange-500/20'
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 login-page-container bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
            <div className="w-full max-w-md bg-gray-800/60 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl p-8 transform transition-all hover:border-gray-600/50 animate-fade-in">
                <div className="text-center mb-8">
                    {APP_LOGO_URL ? (
                        <div className="w-24 h-24 mx-auto mb-4 relative">
                            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl"></div>
                            <img 
                                src={convertGoogleDriveUrl(APP_LOGO_URL)} 
                                alt="App Logo" 
                                className="w-full h-full object-contain relative z-10 drop-shadow-lg"
                                referrerPolicy="no-referrer"
                            />
                        </div>
                    ) : (
                        <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner ring-1 ring-blue-500/30">
                            <svg className="w-10 h-10 text-blue-400" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 9H15V3H9V9H5L12 16L19 9ZM5 18V20H19V18H5Z"/>
                            </svg>
                        </div>
                    )}
                    <h1 className="text-3xl font-bold text-white tracking-tight">កម្មវិធីទម្លាក់ការកម្មង់</h1>
                    <p className="text-gray-400 mt-2 text-sm">សូមបញ្ចូលគណនីដើម្បីបន្តការងារ</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1">ឈ្មោះគណនី</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <input 
                                type="text" 
                                value={username} 
                                onChange={(e) => setUsername(e.target.value)} 
                                className="form-input !pl-12 w-full bg-gray-900/50 border-gray-600 focus:border-blue-500 focus:ring-blue-500/20 transition-all rounded-lg py-3" 
                                placeholder="បញ្ចូលឈ្មោះគណនី"
                                required 
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1">ពាក្យសម្ងាត់</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <input 
                                type={isPasswordVisible ? "text" : "password"} 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)} 
                                className="form-input !pl-12 !pr-12 w-full bg-gray-900/50 border-gray-600 focus:border-blue-500 focus:ring-blue-500/20 transition-all rounded-lg py-3" 
                                placeholder="បញ្ចូលពាក្យសម្ងាត់"
                                required 
                            />
                            <button type="button" onClick={() => setIsPasswordVisible(!isPasswordVisible)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-white transition-colors">
                                {isPasswordVisible ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 .847 0 1.67.126 2.454.364m-3.033 2.446a3 3 0 11-4.243 4.243m4.242-4.242l4.243 4.243M3 3l18 18" /></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex items-center text-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        className="btn btn-primary w-full py-3 text-base font-semibold shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 transition-all transform active:scale-95" 
                        disabled={loading || !['success', 'warning'].includes(connectionStatus.status)}
                    >
                        {loading ? (
                            <div className="flex items-center justify-center">
                                <Spinner size="sm"/>
                                <span className="ml-2">កំពុងដំណើរការ...</span>
                            </div>
                        ) : 'ចូលប្រើប្រាស់'}
                    </button>
                </form>

                 <div className={`mt-6 border rounded-lg p-3 flex items-start space-x-3 text-sm transition-all duration-300 ${statusClasses[connectionStatus.status]}`}>
                    <div className="flex-shrink-0 mt-0.5">
                        {connectionStatus.status === 'checking' && <Spinner size="sm" />}
                        {connectionStatus.status === 'success' && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                        {connectionStatus.status === 'error' && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>}
                        {connectionStatus.status === 'warning' && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.636-1.21 2.252-1.21 2.888 0l6.294 12.022c.626 1.196-.285 2.629-1.624 2.629H3.587c-1.339 0-2.25-1.433-1.624-2.629L8.257 3.099zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-4a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" /></svg>}
                    </div>
                    <span className="font-medium">{connectionStatus.message}</span>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
