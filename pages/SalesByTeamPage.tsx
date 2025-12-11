
import React, { useState, useMemo, useContext, useEffect, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { ParsedOrder } from '../types';
import SimpleBarChart from '../components/admin/SimpleBarChart';

interface SalesByTeamPageProps {
    orders: ParsedOrder[];
    onBack: () => void;
}

type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year' | 'all';

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Reusable Column Toggler Component
const ColumnToggler = ({ 
    columns, 
    visibleColumns, 
    onToggle, 
    onToggleAllMonths,
    prefix 
}: { 
    columns: { key: string, label: string }[], 
    visibleColumns: Set<string>, 
    onToggle: (key: string) => void, 
    onToggleAllMonths?: (show: boolean, prefix: string) => void,
    prefix: string
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const monthKeys = MONTHS.map(m => `${prefix}_${m}`);
    // Check if ALL month columns are currently visible
    const areAllMonthsVisible = monthKeys.every(k => visibleColumns.has(k));

    return (
        <div className="relative" ref={ref}>
            <button onClick={() => setIsOpen(!isOpen)} className="btn btn-secondary !py-1 !px-3 text-sm flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                Columns
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-gray-700 border border-gray-600 rounded-md shadow-lg z-20 max-h-80 overflow-y-auto">
                    {onToggleAllMonths && (
                        <div className="border-b border-gray-600 p-2 bg-gray-800 sticky top-0 z-10">
                             <button 
                                onClick={() => onToggleAllMonths(!areAllMonthsVisible, prefix)}
                                className="w-full text-left text-xs font-bold text-blue-400 hover:text-blue-300 py-2 px-2 rounded hover:bg-gray-700 transition-colors flex justify-between items-center"
                            >
                                <span>{areAllMonthsVisible ? 'លាក់ខែទាំងអស់' : 'បង្ហាញខែទាំងអស់'}</span>
                                {areAllMonthsVisible ? 
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 .847 0 1.67 .126 2.454 .364m-3.033 2.446a3 3 0 11-4.243 4.243m4.242-4.242l4.243 4.243M3 3l18 18" /></svg>
                                    : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                }
                            </button>
                        </div>
                    )}
                    {columns.map(col => (
                        <label key={col.key} className="flex items-center px-3 py-2 text-sm text-gray-200 hover:bg-gray-600 cursor-pointer border-b border-gray-600 last:border-0">
                            <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-blue-500 focus:ring-blue-500 flex-shrink-0"
                                checked={visibleColumns.has(col.key)}
                                onChange={() => onToggle(col.key)}
                            />
                            <span className="ml-3 truncate">{col.label}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};

const SalesByTeamPage: React.FC<SalesByTeamPageProps> = ({ orders, onBack }) => {
    const { appData } = useContext(AppContext);
    const [dateRange, setDateRange] = useState<DateRangePreset>('this_year');
    const [showBorders, setShowBorders] = useState(true);

    // Initial State: Show months by default, hide members by default
    const [visibleRevColumns, setVisibleRevColumns] = useState(new Set([
        'index', 'teamName', 'totalRevenue', ...MONTHS.map(m => `rev_${m}`)
    ]));
    
    const [visibleProfColumns, setVisibleProfColumns] = useState(new Set([
        'index', 'teamName', 'totalProfit', ...MONTHS.map(m => `prof_${m}`)
    ]));
    
    // Toggle Logic for Revenue Table
    const toggleRevColumn = (key: string) => {
        setVisibleRevColumns(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) newSet.delete(key); else newSet.add(key);
            return newSet;
        });
    };

    // Toggle Logic for Profit Table
    const toggleProfColumn = (key: string) => {
        setVisibleProfColumns(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) newSet.delete(key); else newSet.add(key);
            return newSet;
        });
    };

    const toggleAllMonths = (show: boolean, prefix: string) => {
        const targetSet = prefix === 'rev' ? setVisibleRevColumns : setVisibleProfColumns;
        targetSet(prev => {
            const newSet = new Set(prev);
            MONTHS.forEach(m => {
                const key = `${prefix}_${m}`;
                if (show) newSet.add(key); else newSet.delete(key);
            });
            return newSet;
        });
    };

    // 1. Filter Orders by Date
    const filteredOrders = useMemo(() => {
        const now = new Date();
        let startDate: Date | null = null;
        let endDate: Date | null = new Date();

        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        switch (dateRange) {
            case 'today':
                startDate = todayStart;
                endDate = todayEnd;
                break;
            case 'yesterday':
                startDate = new Date(todayStart);
                startDate.setDate(todayStart.getDate() - 1);
                endDate = new Date(todayEnd);
                endDate.setDate(todayEnd.getDate() - 1);
                break;
            case 'this_week':
                const dayOfWeek = now.getDay();
                startDate = new Date(todayStart);
                startDate.setDate(todayStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
                break;
            case 'last_week':
                const lastWeekStart = new Date(todayStart);
                lastWeekStart.setDate(todayStart.getDate() - now.getDay() - 6);
                startDate = lastWeekStart;
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                endDate.setHours(23, 59, 59);
                break;
            case 'this_month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'last_month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
                break;
            case 'this_year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            case 'all':
                startDate = null;
                endDate = null;
                break;
        }

        return orders.filter(order => {
            if (!order.Timestamp) return false;
            const orderDate = new Date(order.Timestamp);
            if (startDate && orderDate < startDate) return false;
            if (endDate && orderDate > endDate) return false;
            return true;
        });
    }, [orders, dateRange]);

    // 2. Aggregate Data by Team
    const teamStats = useMemo(() => {
        const stats: Record<string, { 
            name: string, 
            revenue: number, 
            profit: number, 
            orders: number, 
            members: Set<string>,
            [key: string]: any // For monthly data
        }> = {};

        filteredOrders.forEach(order => {
            let teamName = order.Team;
            if (!teamName && order.User) {
                const user = appData.users?.find(u => u.UserName === order.User);
                if (user && user.Team) {
                    teamName = user.Team.split(',')[0].trim();
                }
            }
            teamName = teamName || 'Unassigned';

            if (!stats[teamName]) {
                stats[teamName] = { 
                    name: teamName, 
                    revenue: 0, 
                    profit: 0, 
                    orders: 0, 
                    members: new Set(),
                };
                // Init months for both Revenue and Profit
                MONTHS.forEach(m => {
                    stats[teamName][`rev_${m}`] = 0;
                    stats[teamName][`prof_${m}`] = 0;
                });
            }

            const revenue = Number(order['Grand Total']) || 0;
            const cost = (Number(order['Total Product Cost ($)']) || 0) + (Number(order['Internal Cost']) || 0);
            const profit = revenue - cost;
            
            stats[teamName].revenue += revenue;
            stats[teamName].profit += profit;
            stats[teamName].orders += 1;
            if (order.User) stats[teamName].members.add(order.User);

            // Monthly Aggregation
            if (order.Timestamp) {
                const d = new Date(order.Timestamp);
                if (!isNaN(d.getTime())) {
                    const mIndex = d.getMonth();
                    const monthName = MONTHS[mIndex];
                    stats[teamName][`rev_${monthName}`] += revenue;
                    stats[teamName][`prof_${monthName}`] += profit;
                }
            }
        });

        return Object.values(stats).sort((a, b) => b.revenue - a.revenue);
    }, [filteredOrders, appData.users]);

    // 3. Prepare Chart Data
    const revenueChartData = useMemo(() => {
        return teamStats.map(t => ({
            label: t.name,
            value: t.revenue,
        }));
    }, [teamStats]);

    const profitChartData = useMemo(() => {
        return teamStats.map(t => ({
            label: t.name,
            value: t.profit,
        }));
    }, [teamStats]);

    // Calculate Grand Totals
    const grandTotals = useMemo(() => {
        const totals: any = { revenue: 0, profit: 0, orders: 0 };
        MONTHS.forEach(m => {
            totals[`rev_${m}`] = 0;
            totals[`prof_${m}`] = 0;
        });

        teamStats.forEach(team => {
            totals.revenue += team.revenue;
            totals.profit += team.profit;
            totals.orders += team.orders;
            MONTHS.forEach(m => {
                totals[`rev_${m}`] += (team[`rev_${m}`] || 0);
                totals[`prof_${m}`] += (team[`prof_${m}`] || 0);
            });
        });
        return totals;
    }, [teamStats]);

    // Column Definitions for Revenue Table
    const revenueColumns = useMemo(() => {
        const baseCols = [
            { key: 'index', label: '#' },
            { key: 'teamName', label: 'ឈ្មោះក្រុម (Team)' },
            { key: 'totalRevenue', label: 'សរុប (Total Revenue)' },
            { key: 'members', label: 'សមាជិក (Members)' },
        ];
        const monthCols = MONTHS.map(m => ({
            key: `rev_${m}`,
            label: `${m}`
        }));
        return [...baseCols, ...monthCols];
    }, []);

    // Column Definitions for Profit Table
    const profitColumns = useMemo(() => {
        const baseCols = [
            { key: 'index', label: '#' },
            { key: 'teamName', label: 'ឈ្មោះក្រុម (Team)' },
            { key: 'totalProfit', label: 'សរុប (Total Profit)' },
            { key: 'members', label: 'សមាជិក (Members)' },
        ];
        const monthCols = MONTHS.map(m => ({
            key: `prof_${m}`,
            label: `${m}`
        }));
        return [...baseCols, ...monthCols];
    }, []);

    const activeRevCols = revenueColumns.filter(c => visibleRevColumns.has(c.key));
    const activeProfCols = profitColumns.filter(c => visibleProfColumns.has(c.key));

    const renderTable = (type: 'Revenue' | 'Profit', columns: any[], visibleCols: Set<string>, activeCols: any[], toggleFunc: any, toggleAllFunc: any, prefix: string) => (
        <div className="page-card flex flex-col mb-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <h3 className={`text-xl font-bold ${type === 'Revenue' ? 'text-blue-300' : 'text-green-400'}`}>
                    {type === 'Revenue' ? 'តារាងចំណូលតាមក្រុម (Revenue Breakdown)' : 'តារាងប្រាក់ចំណេញតាមក្រុម (Profit Breakdown)'}
                </h3>
                
                <div className="flex items-center space-x-3">
                     <button 
                        onClick={() => setShowBorders(!showBorders)} 
                        className={`btn btn-secondary !py-1 !px-2 ${showBorders ? 'bg-blue-600/50 text-white' : ''}`} 
                        title="Show/Hide Borders"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <ColumnToggler columns={columns} visibleColumns={visibleCols} onToggle={toggleFunc} onToggleAllMonths={toggleAllFunc} prefix={prefix} />
                </div>
            </div>

            <div className={`overflow-x-auto ${showBorders ? 'border border-gray-600 rounded' : ''}`}>
                <table className={`report-table w-full border-collapse ${showBorders ? 'border border-gray-600' : ''}`}>
                    <thead className="bg-gray-800">
                        <tr>
                            {activeCols.map(col => (
                                <th key={col.key} className={`${showBorders ? 'border border-gray-600' : 'border-b border-gray-700'} px-4 py-2 whitespace-nowrap text-left`}>
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="group">
                        {teamStats.map((team, index) => (
                            <tr key={team.name} className="hover:bg-gray-700/50 transition-colors group-hover:bg-transparent">
                                {activeCols.map(col => {
                                    const cellClass = `${showBorders ? 'border border-gray-600' : 'border-b border-gray-800'} px-4 py-3 whitespace-nowrap`;
                                    
                                    if (col.key === 'index') return <td key={col.key} className={`${cellClass} text-center text-gray-400`}>{index + 1}</td>;
                                    if (col.key === 'teamName') return <td key={col.key} className={`${cellClass} font-semibold text-white`}>{team.name}</td>;
                                    
                                    if (col.key === 'totalRevenue') return <td key={col.key} className={`${cellClass} text-right font-medium text-blue-300`}>${team.revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>;
                                    if (col.key === 'totalProfit') return <td key={col.key} className={`${cellClass} text-right font-medium text-green-400`}>${team.profit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>;
                                    
                                    if (col.key === 'members') return (
                                        <td key={col.key} className={`${cellClass} text-center`}>
                                            <div className="flex flex-wrap justify-center gap-1">
                                                {Array.from(team.members).slice(0, 3).map((m: any) => (
                                                    <span key={m} className="bg-gray-700 px-2 py-0.5 rounded text-xs text-gray-300">{m}</span>
                                                ))}
                                                {team.members.size > 3 && <span className="text-xs text-gray-500">+{team.members.size - 3}</span>}
                                            </div>
                                        </td>
                                    );
                                    
                                    // Monthly Columns
                                    if (col.key.startsWith(prefix)) {
                                        const val = team[col.key] || 0;
                                        const isPositive = val > 0;
                                        const colorClass = type === 'Profit' 
                                            ? (isPositive ? 'text-green-400' : val < 0 ? 'text-red-400' : 'text-gray-600')
                                            : (isPositive ? 'text-blue-300' : 'text-gray-600');
                                            
                                        return <td key={col.key} className={`${cellClass} text-right ${colorClass}`}>
                                            {val !== 0 ? `$${val.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}
                                        </td>
                                    }
                                    return <td key={col.key} className={cellClass}>-</td>;
                                })}
                            </tr>
                        ))}
                        {teamStats.length === 0 && (
                            <tr>
                                <td colSpan={activeCols.length} className="text-center py-8 text-gray-500">មិនមានទិន្នន័យសម្រាប់ចន្លោះពេលនេះទេ។</td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot className="bg-gray-800 font-bold">
                        <tr>
                            {activeCols.map((col, idx) => {
                                const cellClass = `${showBorders ? 'border border-gray-600' : 'border-t border-gray-600'} px-4 py-3 whitespace-nowrap`;
                                if (idx === 0) return <td key={col.key} className={cellClass} colSpan={activeCols[1]?.key === 'teamName' ? 2 : 1}>សរុបរួម</td>;
                                if (col.key === 'teamName') return null;
                                
                                if (col.key === 'totalRevenue') return <td key={col.key} className={`${cellClass} text-right text-blue-300`}>${grandTotals.revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>;
                                if (col.key === 'totalProfit') return <td key={col.key} className={`${cellClass} text-right text-green-400`}>${grandTotals.profit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>;
                                
                                if (col.key.startsWith(prefix)) {
                                     const val = grandTotals[col.key] || 0;
                                     return <td key={col.key} className={`${cellClass} text-right`}>${val.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>;
                                }
                                
                                return <td key={col.key} className={cellClass}></td>;
                            })}
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );

    return (
        <div className="w-full h-full min-h-[calc(100vh-6rem)] max-w-[100rem] mx-auto p-2 sm:p-4 lg:p-6 animate-fade-in">
             <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                    <span className="bg-blue-600 p-2 rounded-lg">📊</span>
                    របាយការណ៍ផ្នែកលក់តាមក្រុម
                </h1>
                <button onClick={onBack} className="btn btn-secondary flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    ត្រឡប់
                </button>
            </div>

            {/* Filters */}
            <div className="page-card mb-6">
                <div className="flex items-center gap-4">
                    <label className="text-gray-400 font-medium">ជ្រើសរើសកាលបរិច្ឆេទ:</label>
                    <select 
                        value={dateRange} 
                        onChange={(e) => setDateRange(e.target.value as DateRangePreset)}
                        className="form-select max-w-xs"
                    >
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="this_week">This Week</option>
                        <option value="last_week">Last Week</option>
                        <option value="this_month">This Month</option>
                        <option value="last_month">Last Month</option>
                        <option value="this_year">This Year</option>
                        <option value="all">All Time</option>
                    </select>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="stat-card-new bg-blue-900/20 border-blue-500/30">
                    <p className="text-gray-400 text-sm">សរុបការលក់ (Total Revenue)</p>
                    <p className="text-3xl font-bold text-blue-400">${grandTotals.revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
                <div className="stat-card-new bg-green-900/20 border-green-500/30">
                    <p className="text-gray-400 text-sm">សរុបប្រាក់ចំណេញ (Total Profit)</p>
                    <p className="text-3xl font-bold text-green-400">${grandTotals.profit.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
                <div className="stat-card-new bg-purple-900/20 border-purple-500/30">
                    <p className="text-gray-400 text-sm">ចំនួនការកម្មង់ (Total Orders)</p>
                    <p className="text-3xl font-bold text-purple-400">{grandTotals.orders}</p>
                </div>
            </div>

            {/* Tables */}
            {renderTable('Revenue', revenueColumns, visibleRevColumns, activeRevCols, toggleRevColumn, toggleAllMonths, 'rev')}
            {renderTable('Profit', profitColumns, visibleProfColumns, activeProfCols, toggleProfColumn, toggleAllMonths, 'prof')}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                <div className="page-card">
                    <SimpleBarChart data={revenueChartData} title="ការប្រៀបធៀបចំណូលតាមក្រុម (Revenue by Team)" />
                </div>
                <div className="page-card">
                    <SimpleBarChart data={profitChartData} title="ការប្រៀបធៀបប្រាក់ចំណេញតាមក្រុម (Profit by Team)" />
                </div>
            </div>
        </div>
    );
};

export default SalesByTeamPage;
