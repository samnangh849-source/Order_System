import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../App';
import Spinner from '../components/common/Spinner';
import BottomNavBar from '../components/admin/BottomNavBar';
import PerformanceTrackingPage from './PerformanceTrackingPage';
import ReportDashboard from './ReportDashboard';
import SettingsDashboard from './SettingsDashboard';
import OrdersDashboard from './OrdersDashboard';
import { useUrlState } from '../hooks/useUrlState';
import { WEB_APP_URL } from '../constants';
import { FullOrder } from '../types';


type AdminView = 'dashboard' | 'performance';
type ActiveDashboard = 'admin' | 'orders' | 'reports' | 'settings';

const AdminDashboard: React.FC = () => {
    const { appData, currentUser } = useContext(AppContext);
    
    // Use URL state for navigation
    const [activeDashboard, setActiveDashboard] = useUrlState<ActiveDashboard>('tab', 'admin');
    const [currentAdminView, setCurrentAdminView] = useUrlState<AdminView>('subview', 'dashboard');
    const [settingsSection, setSettingsSection] = useUrlState<string>('settingsSection', ''); // To deep link into settings
    
    const [initialReportType, setInitialReportType] = useState<any>('overview');
    
    // Dashboard Real-time Metrics State
    const [dashboardMetrics, setDashboardMetrics] = useState({
        todayRevenue: 0,
        todayOrders: 0,
        pendingOrders: 0,
        loading: false
    });

    // Dedicated state for user count to handle cases where appData.users might be empty
    const [realUserCount, setRealUserCount] = useState(0);
    
    // Check if appData is truly empty (ignoring initial empty arrays)
    const appDataLoading = !appData;

    // Fetch real-time orders data when on dashboard view
    useEffect(() => {
        if (activeDashboard === 'admin' && currentAdminView === 'dashboard') {
            const fetchMetrics = async () => {
                setDashboardMetrics(prev => ({ ...prev, loading: true }));
                try {
                    const response = await fetch(`${WEB_APP_URL}/api/admin/all-orders`);
                    if (response.ok) {
                        const result = await response.json();
                        if (result.status === 'success') {
                            // SAFEGUARD: Ensure result.data is an array and filter out nulls
                            const orders: FullOrder[] = Array.isArray(result.data) ? result.data.filter((o: any) => o !== null) : [];
                            
                            // Get today's date in YYYY-MM-DD format based on local time or UTC as per your requirement
                            const today = new Date();
                            const todayStr = today.toISOString().slice(0, 10);
                            
                            const todayOrdersList = orders.filter(o => o && o.Timestamp && o.Timestamp.startsWith(todayStr));
                            const revenue = todayOrdersList.reduce((sum, o) => sum + (Number(o['Grand Total']) || 0), 0);
                            const pending = orders.filter(o => o && o['Payment Status'] === 'Unpaid').length;

                            setDashboardMetrics({
                                todayRevenue: revenue,
                                todayOrders: todayOrdersList.length,
                                pendingOrders: pending,
                                loading: false
                            });
                        }
                    }
                } catch (e) {
                    console.error("Failed to fetch dashboard metrics", e);
                } finally {
                    setDashboardMetrics(prev => ({ ...prev, loading: false }));
                }
            };
            fetchMetrics();
        }
    }, [activeDashboard, currentAdminView]);

    // Robust fetch for user count
    useEffect(() => {
        const fetchUserCount = async () => {
            // If appData has users, use that
            if (appData.users && appData.users.length > 0) {
                setRealUserCount(appData.users.length);
                return;
            }

            // Fallback: Fetch from API specifically
            try {
                const response = await fetch(`${WEB_APP_URL}/api/users`);
                if (response.ok) {
                    const result = await response.json();
                    if (result.status === 'success' && Array.isArray(result.data)) {
                        setRealUserCount(result.data.length);
                    }
                }
            } catch (e) {
                console.error("Failed to fetch user count", e);
            }
        };

        if (activeDashboard === 'admin') {
            fetchUserCount();
        }
    }, [activeDashboard, appData.users]);

    const handleNavChange = (dashboard: ActiveDashboard) => {
        if (dashboard === 'reports') {
            setInitialReportType('overview');
        }
        setActiveDashboard(dashboard);
        // If switching back to the main admin panel, reset its view to the dashboard
        if (dashboard === 'admin') {
            setCurrentAdminView('dashboard');
        }
    };
    
    const viewConfig: Record<AdminView, { label: string; icon: React.ReactElement; }> = {
        dashboard: { 
            label: 'ទិន្នន័យសង្ខេប', 
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg> 
        },
        performance: { 
            label: 'សមិទ្ធផល', 
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> 
        },
    };
    
     const navConfig = {
        dashboard: { label: 'ទិន្នន័យសង្ខេប', icon: viewConfig.dashboard.icon, component: 'admin' },
        orders: { label: 'ប្រតិបត្តិការណ៍', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002 2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>, component: 'orders' },
        reports: { 
            label: 'របាយការណ៍', 
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>, 
            component: 'reports' 
        },
        performance: { label: 'សមិទ្ធផល', icon: viewConfig.performance.icon, component: 'admin' },
        settings: { label: 'ការគ្រប់គ្រង', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0h9.75m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" /></svg>, component: 'settings' },
    };

    const handleBottomNavChange = (view: keyof typeof navConfig) => {
        const targetComponent = navConfig[view].component as ActiveDashboard;
        if (targetComponent === 'admin') {
            setCurrentAdminView(view as AdminView);
        }
        setActiveDashboard(targetComponent);
    }
    
    const navigateToSettings = (sectionId: string) => {
        setSettingsSection(sectionId);
        setActiveDashboard('settings');
    }

    const AdminDashboardContent = () => {
         const DashboardView = () => {
            const safeLength = (data: any) => (Array.isArray(data) ? data.length : 0);
            
            // Business Metrics (Top Row)
            const businessStats = [
                {
                    label: 'ចំណូលថ្ងៃនេះ',
                    value: `$${dashboardMetrics.todayRevenue.toFixed(2)}`,
                    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
                    color: 'from-green-500/20 to-emerald-600/10',
                    border: 'border-green-500/30',
                    text: 'text-green-400',
                    loading: dashboardMetrics.loading
                },
                {
                    label: 'ការកម្មង់ថ្ងៃនេះ',
                    value: dashboardMetrics.todayOrders,
                    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>,
                    color: 'from-blue-500/20 to-indigo-600/10',
                    border: 'border-blue-500/30',
                    text: 'text-blue-400',
                    loading: dashboardMetrics.loading
                },
                {
                    label: 'មិនទាន់ទូទាត់ (Unpaid)',
                    value: dashboardMetrics.pendingOrders,
                    icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                    color: 'from-yellow-500/20 to-orange-600/10',
                    border: 'border-yellow-500/30',
                    text: 'text-yellow-400',
                    loading: dashboardMetrics.loading
                }
            ];

            // System Entities (Bottom Grid)
            // Note: Users uses realUserCount to be more accurate
            // SAFEGUARD: Added fallback arrays [] and optional chaining map to prevent crashes if appData props are missing or null
            const entityStats = [
                { id: 'users', label: 'អ្នកប្រើប្រាស់ (Users)', value: realUserCount, icon: '👤', color: 'text-purple-400' },
                { id: 'pages', label: 'ក្រុម (Teams)', value: safeLength((appData.pages || []).map((p: any) => p?.Team).filter((v: any, i: any, a: any) => v && a.indexOf(v) === i)), icon: '👥', color: 'text-pink-400' },
                { id: 'products', label: 'ផលិតផល (Products)', value: safeLength(appData.products), icon: '🛍️', color: 'text-teal-400' },
                { id: 'drivers', label: 'អ្នកដឹក (Drivers)', value: safeLength(appData.drivers), icon: '🚚', color: 'text-cyan-400' },
                { id: 'bankAccounts', label: 'គណនីធនាគារ', value: safeLength(appData.bankAccounts), icon: '🏦', color: 'text-indigo-400' }
            ];

            return (
                <div className="space-y-8 animate-fade-in">
                    {/* Welcome Section */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-white">សួស្តី, {currentUser?.FullName} 👋</h2>
                            <p className="text-gray-400 text-sm mt-1">នេះជាទិន្នន័យសង្ខេបសម្រាប់ថ្ងៃនេះ ({new Date().toLocaleDateString('km-KH')})</p>
                        </div>
                    </div>

                    {/* Business Metrics Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {businessStats.map((stat, idx) => (
                            <div key={idx} className={`relative overflow-hidden rounded-2xl p-6 border ${stat.border} bg-gradient-to-br ${stat.color} backdrop-blur-md transition-all hover:scale-[1.02] shadow-lg`}>
                                <div className="flex justify-between items-start relative z-10">
                                    <div>
                                        <p className="text-gray-300 text-sm font-medium mb-1">{stat.label}</p>
                                        {stat.loading ? (
                                            <div className="h-8 w-24 bg-gray-700/50 rounded animate-pulse"></div>
                                        ) : (
                                            <h3 className={`text-3xl font-bold ${stat.text}`}>{stat.value}</h3>
                                        )}
                                    </div>
                                    <div className={`p-3 rounded-xl bg-white/5 ${stat.text}`}>
                                        {stat.icon}
                                    </div>
                                </div>
                                {/* Decorative circle */}
                                <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-white/5 blur-xl`}></div>
                            </div>
                        ))}
                    </div>

                    {/* System Entities Grid */}
                    <div>
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                            </svg>
                            ការគ្រប់គ្រងប្រព័ន្ធ (System Management)
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            {entityStats.map(stat => (
                                <button 
                                    key={stat.id} 
                                    onClick={() => navigateToSettings(stat.id)}
                                    className="page-card group flex flex-col items-center justify-center p-4 text-center transition-all duration-300 hover:bg-gray-700/50 hover:border-blue-500/50 hover:shadow-lg hover:-translate-y-1 cursor-pointer"
                                >
                                    <div className="text-3xl mb-3 transform group-hover:scale-110 transition-transform duration-300">{stat.icon}</div>
                                    <p className={`text-2xl font-bold text-white mb-1`}>{stat.value}</p>
                                    <p className={`text-xs font-medium ${stat.color}`}>{stat.label}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            );
        };

        const renderAdminContent = () => {
            if (appDataLoading) {
                return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
            }
            switch (currentAdminView) {
                case 'dashboard': return <DashboardView />;
                case 'performance': return <PerformanceTrackingPage orders={[]} users={appData.users || []} targets={appData.targets || []} />;
                default: return <div>Select a view</div>;
            }
        };

        const sidebarNavItems = [
            { id: 'dashboard', label: 'ទិន្នន័យសង្ខេប', icon: viewConfig.dashboard.icon, component: 'admin' },
            { id: 'orders', label: 'ប្រតិបត្តិការណ៍', icon: navConfig.orders.icon, component: 'orders' },
            { id: 'reports', label: 'របាយការណ៍', icon: navConfig.reports.icon, component: 'reports' },
            { id: 'performance', label: 'សមិទ្ធផល', icon: viewConfig.performance.icon, component: 'admin' },
            { id: 'settings', label: 'ការគ្រប់គ្រង', icon: navConfig.settings.icon, component: 'settings' },
        ];

        return (
            <div className="flex h-full min-h-[calc(100vh-6rem)] w-full max-w-7xl mx-auto">
                <aside className="hidden md:flex w-64 bg-gray-800 text-gray-300 flex-shrink-0 p-4 flex-col rounded-r-xl border-r border-gray-700/50">
                    <h2 className="text-xl font-bold text-white mb-6 px-2">Admin Panel</h2>
                    <nav className="admin-sidebar-nav flex flex-col space-y-2">
                        {sidebarNavItems.map(item => {
                            const isActive = (item.component === activeDashboard) && (item.component !== 'admin' || item.id === currentAdminView);
                            return (
                                <a 
                                    href="#" 
                                    key={item.id}
                                    onClick={(e) => { e.preventDefault(); handleBottomNavChange(item.id as keyof typeof navConfig); }}
                                    className={`flex items-center p-3 rounded-lg transition-all duration-200 ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-gray-700/50 hover:text-white'}`}
                                    title={item.label}
                                >
                                    {item.icon}
                                    <span className="ml-3 font-medium">{item.label}</span>
                                </a>
                            );
                        })}
                    </nav>
                </aside>
                <main className="flex-1 p-2 sm:p-4 lg:p-6 overflow-y-auto pb-20 md:pb-6">
                     <div className="flex justify-between items-center mb-6 md:hidden">
                        <h1 className="text-2xl font-bold text-white">
                            {viewConfig[currentAdminView].label}
                        </h1>
                    </div>
                    {renderAdminContent()}
                </main>
                 <BottomNavBar currentView={activeDashboard === 'admin' ? currentAdminView : activeDashboard} onViewChange={handleBottomNavChange} viewConfig={navConfig} />
            </div>
        );
    }
    
    const handleBackToAdmin = () => {
        setActiveDashboard('admin');
        setCurrentAdminView('dashboard');
    }

    switch (activeDashboard) {
        case 'admin':
            return <AdminDashboardContent />;
        case 'orders':
            return <OrdersDashboard onBack={handleBackToAdmin} />;
        case 'reports':
            return <ReportDashboard initialReportType={initialReportType} onBack={handleBackToAdmin} />;
        case 'settings':
            return <SettingsDashboard onBack={handleBackToAdmin} initialSection={settingsSection} />;
        default:
            return <AdminDashboardContent />;
    }
};

export default AdminDashboard;