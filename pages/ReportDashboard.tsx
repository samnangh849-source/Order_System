import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '../App';
import { ParsedOrder, ShippingMethod, Driver, MasterProduct, BankAccount } from '../types';
import ReportsView from '../components/admin/ReportsView';
import Spinner from '../components/common/Spinner';
import Modal from '../components/common/Modal'; // NEW: Import Modal for desktop
import { WEB_APP_URL } from '../constants';

interface ReportDashboardProps {
    initialReportType: 'overview' | 'performance' | 'profitability' | 'forecasting' | 'shipping';
    onBack: () => void;
}

type ReportType = 'overview' | 'performance' | 'profitability' | 'forecasting' | 'shipping';
type DateRangePreset = 'all' | 'today' | 'last_day' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'week1' | 'week2' | 'week3' | 'week4' | 'custom';

const reportSections: {id: ReportType, title: string, icon: React.ReactElement}[] = [
    { id: 'overview', title: 'ទិដ្ឋភាពទូទៅ', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
    { id: 'performance', title: 'ការអនុវត្ត', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7L21 7" /><path strokeLinecap="round" strokeLinejoin="round" d="M13 17L21 17" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L18 12" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 21L21 3" /></svg> },
    { id: 'profitability', title: 'ប្រាក់ចំណេញ', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg> },
    { id: 'forecasting', title: 'ការព្យាករណ៍', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> },
    { id: 'shipping', title: 'ចំណាយដឹកជញ្ជូន', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h8a1 1 0 001-1z" /><path strokeLinecap="round" strokeLinejoin="round" d="M18 18h1a1 1 0 001-1v-3.354a1.5 1.5 0 00-.9-1.342l-3.286-1.643A1 1 0 0016 11.236V16" /></svg> },
];

const datePresets: { label: string, value: DateRangePreset }[] = [
    { label: 'All Time', value: 'all' },
    { label: 'Today', value: 'today' },
    { label: 'Last Day', value: 'last_day' },
    { label: 'This Week', value: 'this_week' },
    { label: 'This Month', value: 'this_month' },
    { label: 'Last Month', value: 'last_month' },
    { label: 'This Year', value: 'this_year' },
    { label: 'Last Year', value: 'last_year' },
    { label: 'Week 1', value: 'week1' },
    { label: 'Week 2', value: 'week2' },
    { label: 'Week 3', value: 'week3' },
    { label: 'Week 4', value: 'week4' },
    { label: 'Custom', value: 'custom' },
];

const FilterPanel = ({ isOpen, onClose, children }: { isOpen: boolean, onClose: () => void, children: React.ReactNode }) => {
    return (
        <>
            <div className={`filter-panel-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
            <div className={`filter-panel ${isOpen ? 'open' : ''}`}>
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Filter Reports</h2>
                    <button onClick={onClose} className="text-2xl text-gray-400 hover:text-white">&times;</button>
                </div>
                <div className="p-4 overflow-y-auto">{children}</div>
                <div className="p-4 border-t border-gray-700">
                    <button onClick={onClose} className="btn btn-primary w-full">Apply Filters</button>
                </div>
            </div>
        </>
    );
};

const ReportDashboard: React.FC<ReportDashboardProps> = ({
    initialReportType,
    onBack,
}) => {
    const { appData } = useContext(AppContext);
    const [activeReport, setActiveReport] = useState<ReportType>(initialReportType);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [orders, setOrders] = useState<ParsedOrder[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [ordersError, setOrdersError] = useState('');
    const [dateRangeDisplay, setDateRangeDisplay] = useState('');

    const [filters, setFilters] = useState({
        datePreset: 'this_month' as DateRangePreset,
        startDate: '',
        endDate: '',
        team: '',
        user: '',
        paymentStatus: '',
        shippingService: '',
        driver: '',
        product: '',
        bank: '',
        monthForWeeks: new Date().toISOString().slice(0, 7), // YYYY-MM
    });
    
    useEffect(() => {
        const fetchAllOrders = async () => {
            setOrdersLoading(true);
            setOrdersError('');
            try {
                const response = await fetch(`${WEB_APP_URL}/api/admin/all-orders`);
                if (!response.ok) throw new Error('Failed to fetch orders');
                const result = await response.json();
                if (result.status !== 'success') throw new Error(result.message || 'Error fetching orders');
                
                const rawOrders: any[] = result.data;
                const parsed = rawOrders.map(o => ({ ...o, Products: JSON.parse(o['Products (JSON)'] || '[]') }));
                setOrders(parsed);
            } catch (err: any) {
                setOrdersError(err.message);
            } finally {
                setOrdersLoading(false);
            }
        };
        fetchAllOrders();
    }, []);


    const toLocalYYYYMMDD = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleFilterChange = (field: keyof typeof filters, value: string) => {
        const newFilters = { ...filters, [field]: value };

        if (field === 'datePreset' || (field === 'monthForWeeks' && newFilters.datePreset.startsWith('week'))) {
            const preset = field === 'datePreset' ? (value as DateRangePreset) : newFilters.datePreset;
            if (field === 'datePreset') {
                newFilters.startDate = '';
                newFilters.endDate = '';
            }

            const now = new Date();
            let start = new Date(now);
            let end = new Date(now);
            
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
    
            if (preset.startsWith('week')) {
                const [year, month] = newFilters.monthForWeeks.split('-').map(Number);
                const weekNum = parseInt(preset.replace('week', ''), 10);
                const dayOffset = (weekNum - 1) * 7;
                start = new Date(year, month - 1, 1 + dayOffset);
                end = new Date(year, month - 1, 7 + dayOffset);
            } else {
                switch (preset) {
                    case 'today': break;
                    case 'last_day':
                        start.setDate(now.getDate() - 1);
                        end.setDate(now.getDate() - 1);
                        break;
                    case 'this_week':
                        const dayOfWeek = now.getDay();
                        start.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
                        end = new Date(start);
                        end.setDate(start.getDate() + 6);
                        break;
                    case 'this_month':
                        start = new Date(now.getFullYear(), now.getMonth(), 1);
                        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                        break;
                    case 'last_month':
                        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        end = new Date(now.getFullYear(), now.getMonth(), 0);
                        break;
                    case 'this_year':
                        start = new Date(now.getFullYear(), 0, 1);
                        end = new Date(now.getFullYear(), 11, 31);
                        break;
                    case 'last_year':
                        start = new Date(now.getFullYear() - 1, 0, 1);
                        end = new Date(now.getFullYear() - 1, 11, 31);
                        break;
                }
            }

            if (preset !== 'all' && preset !== 'custom') {
                newFilters.startDate = toLocalYYYYMMDD(start);
                newFilters.endDate = toLocalYYYYMMDD(end);
                setDateRangeDisplay(`${toLocalYYYYMMDD(start)} to ${toLocalYYYYMMDD(end)}`);
            } else if (preset === 'all') {
                setDateRangeDisplay('All Time');
            } else {
                setDateRangeDisplay('');
            }
        }
        setFilters(newFilters);
    };
    
    useEffect(() => {
        handleFilterChange('datePreset', 'this_month');
    }, []);

    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            if (filters.datePreset !== 'all') {
                const startDate = filters.startDate ? new Date(`${filters.startDate}T00:00:00`) : null;
                const endDate = filters.endDate ? new Date(`${filters.endDate}T23:59:59`) : null;
                const orderDate = new Date(order.Timestamp);
                if (startDate && orderDate < startDate) return false;
                if (endDate && orderDate > endDate) return false;
            }
            if (filters.team && order.Team !== filters.team) return false;
            if (filters.user && order.User !== filters.user) return false;
            if (filters.paymentStatus && order['Payment Status'] !== filters.paymentStatus) return false;
            if (filters.shippingService && order['Internal Shipping Method'] !== filters.shippingService) return false;
            if (filters.driver && order['Internal Shipping Details'] !== filters.driver) return false;
            if (filters.bank && order['Payment Info'] !== filters.bank) return false;
            if (filters.product && !order.Products.some(p => p.name === filters.product)) return false;

            return true;
        });
    }, [orders, filters]);

    const renderContent = () => {
        if (ordersLoading) {
            return <div className="flex justify-center items-center h-full min-h-[400px]"><Spinner size="lg" /></div>;
        }
        if (ordersError) {
            return <p className="text-center text-red-400 p-8 whitespace-pre-wrap">{ordersError}</p>;
        }
        return <ReportsView orders={filteredOrders} reportType={activeReport} allOrders={orders} />;
    };

    const FiltersComponent = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="input-label">Date Range</label>
                    <select value={filters.datePreset} onChange={(e) => handleFilterChange('datePreset', e.target.value)} className="form-select">
                        {datePresets.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                </div>
                {filters.datePreset.startsWith('week') && (
                    <div>
                         <label className="input-label">Month for Weeks</label>
                         <input type="month" value={filters.monthForWeeks} onChange={(e) => handleFilterChange('monthForWeeks', e.target.value)} className="form-input"/>
                    </div>
                )}
            </div>
             {dateRangeDisplay && <p className="text-sm text-gray-400 text-center bg-gray-700/50 p-2 rounded-md">{dateRangeDisplay}</p>}

            {filters.datePreset === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                         <label className="input-label">Start Date</label>
                         <input type="date" value={filters.startDate} onChange={e => handleFilterChange('startDate', e.target.value)} className="form-input" />
                    </div>
                    <div>
                        <label className="input-label">End Date</label>
                        <input type="date" value={filters.endDate} onChange={e => handleFilterChange('endDate', e.target.value)} className="form-input" />
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="input-label">Team</label>
                    <select value={filters.team} onChange={e => handleFilterChange('team', e.target.value)} className="form-select">
                        <option value="">All Teams</option>
                        {Array.from(new Set(orders.map(o => o.Team).filter(Boolean))).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div>
                    <label className="input-label">User</label>
                    <select value={filters.user} onChange={e => handleFilterChange('user', e.target.value)} className="form-select">
                        <option value="">All Users</option>
                        {appData.users?.map((u: any) => <option key={u.UserName} value={u.UserName}>{u.FullName}</option>)}
                    </select>
                </div>
                <div>
                    <label className="input-label">Payment Status</label>
                    <select value={filters.paymentStatus} onChange={e => handleFilterChange('paymentStatus', e.target.value)} className="form-select">
                        <option value="">All Statuses</option>
                        <option value="Paid">Paid</option>
                        <option value="Unpaid">Unpaid</option>
                    </select>
                </div>
                <div>
                    <label className="input-label">Product</label>
                    <select value={filters.product} onChange={e => handleFilterChange('product', e.target.value)} className="form-select">
                        <option value="">All Products</option>
                        {appData.products?.map((p: MasterProduct) => <option key={p.ProductName} value={p.ProductName}>{p.ProductName}</option>)}
                    </select>
                </div>
                <div>
                    <label className="input-label">Shipping Service</label>
                    <select value={filters.shippingService} onChange={e => handleFilterChange('shippingService', e.target.value)} className="form-select">
                        <option value="">All Services</option>
                        {appData.shippingMethods?.map((s: ShippingMethod) => <option key={s.MethodName} value={s.MethodName}>{s.MethodName}</option>)}
                    </select>
                </div>
                <div>
                    <label className="input-label">Driver</label>
                    <select value={filters.driver} onChange={e => handleFilterChange('driver', e.target.value)} className="form-select">
                        <option value="">All Drivers</option>
                        {appData.drivers?.map((d: Driver) => <option key={d.DriverName} value={d.DriverName}>{d.DriverName}</option>)}
                    </select>
                </div>
                <div className="sm:col-span-2">
                    <label className="input-label">Bank Account</label>
                    <select value={filters.bank} onChange={e => handleFilterChange('bank', e.target.value)} className="form-select">
                        <option value="">All Bank Accounts</option>
                        {appData.bankAccounts?.map((b: BankAccount) => <option key={b.BankName} value={b.BankName}>{b.BankName}</option>)}
                    </select>
                </div>
            </div>
        </div>
    );

    return (
        <div className="w-full h-full min-h-[calc(100vh-6rem)] max-w-7xl mx-auto p-2 sm:p-4 lg:p-6 animate-fade-in">
             <style>{`.animate-fade-in { animation: fadeIn 0.5s ease-in-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            
            {/* --- MODALS & PANELS (Responsive) --- */}
            {/* Mobile: Bottom Sheet */}
            <div className="md:hidden">
                <FilterPanel isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)}>
                    <FiltersComponent />
                </FilterPanel>
            </div>
            {/* Desktop: Centered Modal */}
            <div className="hidden md:block">
                <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} maxWidth="max-w-4xl">
                    <div className="flex justify-between items-center p-4 border-b border-gray-700">
                        <h2 className="text-xl font-bold text-white">Filter Reports</h2>
                        <button onClick={() => setIsFilterModalOpen(false)} className="text-2xl text-gray-400 hover:text-white">&times;</button>
                    </div>
                    <div className="p-4 overflow-y-auto max-h-[65vh]">
                        <FiltersComponent />
                    </div>
                    <div className="p-4 border-t border-gray-700">
                        <button onClick={() => setIsFilterModalOpen(false)} className="btn btn-primary w-full">Apply Filters</button>
                    </div>
                </Modal>
            </div>


            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-white">ផ្ទាំងរបាយការណ៍</h1>
                <button onClick={onBack} className="btn btn-secondary flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="hidden sm:inline">ត្រឡប់ទៅផ្ទាំង Admin</span>
                </button>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                <aside className="w-full md:w-64 flex-shrink-0">
                    <div className="md:hidden mb-4">
                        <select
                            value={activeReport}
                            onChange={(e) => setActiveReport(e.target.value as ReportType)}
                            className="form-select w-full"
                        >
                            {reportSections.map(section => (
                                <option key={section.id} value={section.id}>{section.title}</option>
                            ))}
                        </select>
                    </div>
                    <nav className="hidden md:flex flex-col space-y-2 bg-gray-800/50 rounded-lg p-4">
                        {reportSections.map(section => (
                            <a 
                                href="#" 
                                key={section.id}
                                onClick={(e) => { e.preventDefault(); setActiveReport(section.id as any); }}
                                className={`flex items-center p-3 rounded-md transition-colors text-sm font-medium ${activeReport === section.id ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-gray-700 text-gray-300'}`}
                            >
                                {section.icon}
                                <span className="ml-3">{section.title}</span>
                            </a>
                        ))}
                    </nav>
                </aside>

                <main className="flex-grow min-w-0">
                    <div className="page-card mb-6">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <button onClick={() => setIsFilterModalOpen(true)} className="btn btn-secondary w-full md:w-auto self-start flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" /></svg>
                                Filters & Options
                            </button>
                            {dateRangeDisplay && (
                                <p className="text-sm text-gray-400 text-center md:text-left bg-gray-900/50 p-2 rounded-md">
                                    <strong>Filtered Range:</strong> {dateRangeDisplay}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="page-card !p-4 sm:!p-6">
                       {renderContent()}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default ReportDashboard;
