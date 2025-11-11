import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../App';
import Spinner from '../components/common/Spinner';
import { WEB_APP_URL } from '../constants';
import { User } from '../types';

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
            
            const maxRetries = 10; // Increased from 5
            const retryDelay = 3500; // Increased from 3000ms

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
                        return; // Success, exit the loop
                    } else {
                        setConnectionStatus({ 
                            status: 'warning', 
                            message: 'Server អាចតភ្ជាប់បាន ប៉ុន្តែការឆ្លើយតបពី ping ខុសពីការរំពឹងទុក។' 
                        });
                        return; // Warning, but still connected, exit loop
                    }
                } catch (error: any) {
                    console.error(`Connection attempt ${attempt} failed:`, error);
                    if (attempt === maxRetries) {
                        // Last attempt failed, set final error message
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
                        // Wait before retrying
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
            // WORKAROUND: Since /api/login is not implemented in the Go backend,
            // we fetch all users and check credentials on the client-side.
            // This is insecure and should be replaced with a proper backend login endpoint.
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
                delete userToLogin.Password; // Don't store password in state/localStorage
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
    
    const ConnectionStatusIcon = () => {
        switch (connectionStatus.status) {
            case 'checking': return <Spinner size="sm" />;
            case 'warning': return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.636-1.21 2.252-1.21 2.888 0l6.294 12.022c.626 1.196-.285 2.629-1.624 2.629H3.587c-1.339 0-2.25-1.433-1.624-2.629L8.257 3.099zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-4a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
            case 'success': return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>;
            case 'error': return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>;
        }
    };

    const statusClasses = {
        checking: 'bg-yellow-900/50 text-yellow-300',
        success: 'bg-green-900/50 text-green-300',
        error: 'bg-red-900/50 text-red-300',
        warning: 'bg-yellow-900/50 text-yellow-300'
    };

    return (
        <div className="w-full max-w-md mx-auto login-page-container">
            <div className="page-card text-center">
                <div className="mb-8">
                     <svg className="w-20 h-20 mx-auto text-blue-400" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19 9H15V3H9V9H5L12 16L19 9ZM5 18V20H19V18H5Z"/>
                    </svg>
                    <h1 className="text-2xl sm:text-3xl font-bold mt-4 text-white">កម្មវិធីទម្លាក់ការកម្មង់</h1>
                    <p className="text-gray-400 mt-2 text-sm sm:text-base">សូមបញ្ចូលគណនីដើម្បីបន្ត</p>
                </div>

                <form onSubmit={handleLogin}>
                    <div className="space-y-6">
                        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ឈ្មោះគណនី" className="form-input text-center" required />
                        <div className="relative">
                            <input type={isPasswordVisible ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="ពាក្យសម្ងាត់" className="form-input text-center pr-10" required />
                            <button type="button" onClick={() => setIsPasswordVisible(!isPasswordVisible)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-white">
                                {isPasswordVisible ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 .847 0 1.67.126 2.454.364m-3.033 2.446a3 3 0 11-4.243 4.243m4.242-4.242l4.243 4.243M3 3l18 18" /></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                )}
                            </button>
                        </div>
                    </div>
                    <p className="text-red-400 mt-4 h-5">{error}</p>
                    <button type="submit" className="btn btn-primary w-full mt-8" disabled={loading || !['success', 'warning'].includes(connectionStatus.status)}>
                        {loading ? (
                            <>
                                <Spinner size="sm"/>
                                <span className="ml-2">កំពុងដំណើរការ...</span>
                            </>
                        ) : 'ចូលប្រើ'}
                    </button>
                </form>

                 <div className={`text-sm rounded-lg p-3 mt-8 flex items-center justify-center space-x-2 ${statusClasses[connectionStatus.status]}`}>
                    <ConnectionStatusIcon />
                    <span className="font-medium">{connectionStatus.message}</span>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
