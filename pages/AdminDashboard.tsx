
import React, { useState, useContext } from 'react';
import { AppContext } from '../App';
import Spinner from '../components/common/Spinner';
import BottomNavBar from '../components/admin/BottomNavBar';
import PerformanceTrackingPage from './PerformanceTrackingPage';
import ReportDashboard from './ReportDashboard';
import SettingsDashboard from './SettingsDashboard';
import OrdersDashboard from './OrdersDashboard'; // NEW IMPORT


type AdminView = 'dashboard' | 'performance';
type ActiveDashboard = 'admin' | 'orders' | 'reports' | 'settings';

const AdminDashboard: React.FC = () => {
    const { appData } = useContext(AppContext);
    const [activeDashboard, setActiveDashboard] = useState<ActiveDashboard>('admin');
    const [currentAdminView, setCurrentAdminView] = useState<AdminView>('dashboard');
    const [initialReportType, setInitialReportType] = useState<any>('overview');
    
    const appDataLoading = !appData || Object.keys(appData).length === 0;

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

    const handleAdminViewChange = (view: AdminView) => {
        setCurrentAdminView(view);
    }
    
    const viewConfig: Record<AdminView, { label: string; icon: React.ReactElement; }> = {
        dashboard: { label: 'ទិន្នន័យសង្ខេប', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
        performance: { label: 'សមិទ្ធផល', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg> },
    };
    
     const navConfig = {
        dashboard: { label: 'ទិន្នន័យសង្ខេប', icon: viewConfig.dashboard.icon, component: 'admin' },
        orders: { label: 'ប្រតិបត្តិការណ៍', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002 2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>, component: 'orders' },
        reports: { label: 'របាយការណ៍', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>, component: 'reports' },
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

    const AdminDashboardContent = () => {
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
                <aside className="hidden md:flex w-64 bg-gray-800 text-gray-300 flex-shrink-0 p-4 flex-col">
                    <h2 className="text-xl font-bold text-white mb-6">Admin Panel</h2>
                    <nav className="admin-sidebar-nav flex flex-col space-y-2">
                        {sidebarNavItems.map(item => {
                            const isActive = (item.component === activeDashboard) && (item.component !== 'admin' || item.id === currentAdminView);
                            return (
                                <a 
                                    href="#" 
                                    key={item.id}
                                    onClick={(e) => { e.preventDefault(); handleBottomNavChange(item.id as keyof typeof navConfig); }}
                                    className={`flex items-center p-3 rounded-md ${isActive ? 'active' : ''}`}
                                    title={item.label}
                                >
                                    {item.icon}
                                    <span className="ml-4">{item.label}</span>
                                </a>
                            );
                        })}
                    </nav>
                </aside>
                <main className="flex-1 p-2 sm:p-4 lg:p-6 overflow-y-auto md:ml-64 pb-20 md:pb-6">
                     <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl md:text-3xl font-bold text-white">
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
            return <SettingsDashboard onBack={handleBackToAdmin} />;
        default:
            return <AdminDashboardContent />;
    }
};


export default AdminDashboard;
