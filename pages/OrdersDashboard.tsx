import React, { useState, useContext, useEffect, useMemo } from 'react';
import { AppContext } from '../App';
import Spinner from '../components/common/Spinner';
import { FullOrder, ParsedOrder, MasterProduct, ShippingMethod, Driver, BankAccount } from '../types';
import EditOrderPage from './EditOrderPage';
import OrdersList from '../components/orders/OrdersList';
import { WEB_APP_URL } from '../constants';
import Modal from '../components/common/Modal';

interface OrdersDashboardProps {
    onBack: () => void;
}

type DateRangePreset = 'all' | 'today' | 'last_day' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'week1' | 'week2' | 'week3' | 'week4' | 'custom';

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
                    <h2 className="text-xl font-bold text-white">Filter Orders</h2>
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

const OrdersDashboard: React.FC<OrdersDashboardProps> = ({ onBack }) => {
    const { appData, refreshData } = useContext(AppContext);
    const [editingOrder, setEditingOrder] = useState<ParsedOrder | null>(null);
    const [allOrders, setAllOrders] = useState<ParsedOrder[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [ordersError, setOrdersError] = useState('');
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
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

    const fetchAllOrders = async () => {
        setOrdersLoading(true);
        setOrdersError('');
        try {
            const response = await fetch(`${WEB_APP_URL}/api/admin/all-orders`);
            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `Server responded with status ${response.status}.`;
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.message || errorText;
                } catch (e) {
                    errorMessage = errorText;
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
            parsed.sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime());
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
    };
    
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
        fetchAllOrders();
        handleFilterChange('datePreset', 'this_month');
    }, []);

    const filteredOrders = useMemo(() => {
        return allOrders.filter(order => {
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
    }, [allOrders, filters]);

    const handleSaveSuccess = () => {
        setEditingOrder(null);
        fetchAllOrders();
        refreshData();
    };
    
    const handleEditOrder = (order: ParsedOrder) => {
        setEditingOrder(order);
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
                        {Array.from(new Set(allOrders.map(o => o.Team).filter(Boolean))).map(t => <option key={t} value={t}>{t}</option>)}
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

    const renderContent = () => {
        if (ordersLoading) {
             return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
        }
        
        if (ordersError) {
             return <p className="text-center text-red-400 p-8 whitespace-pre-wrap">{ordersError}</p>;
        }
        
        if (editingOrder) {
            return <EditOrderPage order={editingOrder} onSaveSuccess={handleSaveSuccess} onCancel={() => setEditingOrder(null)} />;
        }

        return <OrdersList orders={filteredOrders} onEdit={handleEditOrder} showActions={true} />;
    };

    return (
        <div className="w-full h-full min-h-[calc(100vh-6rem)] max-w-7xl mx-auto p-2 sm:p-4 lg:p-6 animate-fade-in">
             <style>{`.animate-fade-in { animation: fadeIn 0.5s ease-in-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
             
            {/* --- MODALS & PANELS (Responsive) --- */}
            <div className="md:hidden">
                <FilterPanel isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)}>
                    <FiltersComponent />
                </FilterPanel>
            </div>
            <div className="hidden md:block">
                <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} maxWidth="max-w-4xl">
                    <div className="flex justify-between items-center p-4 border-b border-gray-700">
                        <h2 className="text-xl font-bold text-white">Filter Orders</h2>
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
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                    {editingOrder ? `កែសម្រួល ID: ${editingOrder['Order ID']}` : 'គ្រប់គ្រងប្រតិបត្តិការណ៍'}
                </h1>
                <button onClick={onBack} className="btn btn-secondary flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="hidden sm:inline">ត្រឡប់ទៅផ្ទាំង Admin</span>
                     <span className="sm:hidden">ត្រឡប់</span>
                </button>
            </div>

            {!editingOrder && (
                 <div className="page-card !p-3 mb-6">
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
            )}
            
            {renderContent()}
        </div>
    );
};

export default OrdersDashboard;
