
import React, { useState, useMemo, useContext, useEffect, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { ParsedOrder } from '../types';
import SimpleBarChart from '../components/admin/SimpleBarChart';
import { convertGoogleDriveUrl } from '../utils/fileUtils';

interface SalesByPageReportProps {
    orders: ParsedOrder[];
    onBack: () => void;
}

type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year' | 'all';
type SortKey = 'revenue' | 'profit' | 'team' | 'pageName';
type PaletteType = 'rich' | 'cool' | 'warm';

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Define 3 palettes of dark colors.
// Adjusted 'rich' palette order to maximize contrast between sequential indices.
const COLOR_PALETTES: Record<PaletteType, string[]> = {
    rich: [
        'bg-[#172554]', // Blue 950 (Start with cool)
        'bg-[#450a0a]', // Red 950 (Switch to warm)
        'bg-[#064e3b]', // Emerald 900 (Switch to nature)
        'bg-[#4c1d95]', // Violet 900 (Switch to vibrant)
        'bg-[#78350f]', // Amber 900 (Switch to earth)
        'bg-[#164e63]', // Cyan 900 (Switch to cool)
        'bg-[#831843]', // Pink 900 (Switch to warm)
        'bg-[#365314]', // Lime 950 (Switch to nature)
        'bg-[#312e81]', // Indigo 900
        'bg-[#7f1d1d]', // Red 900
    ],
    cool: [
        'bg-slate-900',
        'bg-blue-950',
        'bg-zinc-900',
        'bg-cyan-950',
        'bg-neutral-900',
        'bg-sky-950',
        'bg-stone-900',
        'bg-indigo-950',
        'bg-gray-900',
        'bg-teal-950',
    ],
    warm: [
        'bg-red-950',
        'bg-orange-950',
        'bg-rose-950',
        'bg-amber-950',
        'bg-pink-950',
        'bg-yellow-950',
        'bg-fuchsia-950',
        'bg-lime-950',
        'bg-purple-950',
        'bg-violet-950',
    ]
};

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

const SalesByPageReport: React.FC<SalesByPageReportProps> = ({ orders, onBack }) => {
    const { appData } = useContext(AppContext);
    const [dateRange, setDateRange] = useState<DateRangePreset>('this_year');
    const [showBorders, setShowBorders] = useState(true);
    const [isFrozen, setIsFrozen] = useState(true);
    
    // New States for Color Management
    const [showTeamColors, setShowTeamColors] = useState(false); // Default to FALSE
    const [colorPalette, setColorPalette] = useState<PaletteType>('rich');
    
    // Sorting State: Default to sorting by Team first
    const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: 'asc' | 'desc' }>({ key: 'team', direction: 'asc' });

    // Initial columns to show
    const [visibleRevColumns, setVisibleRevColumns] = useState(new Set([
        'index', 'logo', 'pageName', 'teamName', 'totalRevenue', ...MONTHS.map(m => `rev_${m}`)
    ]));
    
    const [visibleProfColumns, setVisibleProfColumns] = useState(new Set([
        'index', 'logo', 'pageName', 'teamName', 'totalProfit', ...MONTHS.map(m => `prof_${m}`)
    ]));

    const handleSort = (key: SortKey) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // Toggle Logic
    const toggleRevColumn = (key: string) => setVisibleRevColumns(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
    const toggleProfColumn = (key: string) => setVisibleProfColumns(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
    const toggleAllMonths = (show: boolean, prefix: string) => {
        const targetSet = prefix === 'rev' ? setVisibleRevColumns : setVisibleProfColumns;
        targetSet(prev => { const n = new Set(prev); MONTHS.forEach(m => show ? n.add(`${prefix}_${m}`) : n.delete(`${prefix}_${m}`)); return n; });
    };

    // 1. Filter Orders by Date
    const filteredOrders = useMemo(() => {
        const now = new Date();
        let startDate: Date | null = null;
        let endDate: Date | null = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        switch (dateRange) {
            case 'today': startDate = todayStart; endDate = todayEnd; break;
            case 'yesterday': startDate = new Date(todayStart); startDate.setDate(todayStart.getDate() - 1); endDate = new Date(todayEnd); endDate.setDate(todayEnd.getDate() - 1); break;
            case 'this_week': const day = now.getDay(); startDate = new Date(todayStart); startDate.setDate(todayStart.getDate() - day + (day === 0 ? -6 : 1)); break;
            case 'last_week': const lastW = new Date(todayStart); lastW.setDate(todayStart.getDate() - now.getDay() - 6); startDate = lastW; endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 6); endDate.setHours(23, 59, 59); break;
            case 'this_month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
            case 'last_month': startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1); endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); break;
            case 'this_year': startDate = new Date(now.getFullYear(), 0, 1); break;
            case 'all': startDate = null; endDate = null; break;
        }

        return orders.filter(order => {
            if (!order.Timestamp) return false;
            const orderDate = new Date(order.Timestamp);
            return (!startDate || orderDate >= startDate) && (!endDate || orderDate <= endDate);
        });
    }, [orders, dateRange]);

    // 2. Aggregate Data by PAGE
    const pageStats = useMemo(() => {
        const stats: Record<string, { 
            pageName: string, 
            teamName: string,
            logoUrl: string,
            revenue: number, 
            profit: number, 
            orders: number, 
            members: Set<string>,
            [key: string]: any 
        }> = {};

        filteredOrders.forEach(order => {
            const pageName = order.Page || 'Unknown Page';
            const teamName = order.Team || 'Unassigned';

            if (!stats[pageName]) {
                // Find logo from AppData
                const pageInfo = appData.pages?.find(p => p.PageName === pageName);
                const logoUrl = pageInfo?.PageLogoURL || '';

                stats[pageName] = { 
                    pageName, 
                    teamName,
                    logoUrl,
                    revenue: 0, 
                    profit: 0, 
                    orders: 0, 
                    members: new Set(),
                };
                MONTHS.forEach(m => { stats[pageName][`rev_${m}`] = 0; stats[pageName][`prof_${m}`] = 0; });
            }

            const revenue = Number(order['Grand Total']) || 0;
            const cost = (Number(order['Total Product Cost ($)']) || 0) + (Number(order['Internal Cost']) || 0);
            const profit = revenue - cost;
            
            stats[pageName].revenue += revenue;
            stats[pageName].profit += profit;
            stats[pageName].orders += 1;
            if (order.User) stats[pageName].members.add(order.User);

            if (order.Timestamp) {
                const d = new Date(order.Timestamp);
                if (!isNaN(d.getTime())) {
                    const mName = MONTHS[d.getMonth()];
                    stats[pageName][`rev_${mName}`] += revenue;
                    stats[pageName][`prof_${mName}`] += profit;
                }
            }
        });

        return Object.values(stats).sort((a, b) => {
            const multiplier = sortConfig.direction === 'asc' ? 1 : -1;
            if (sortConfig.key === 'team') return a.teamName.localeCompare(b.teamName) * multiplier;
            if (sortConfig.key === 'pageName') return a.pageName.localeCompare(b.pageName) * multiplier;
            if (sortConfig.key === 'profit') return (a.profit - b.profit) * multiplier;
            // Default to revenue
            return (a.revenue - b.revenue) * multiplier;
        });
    }, [filteredOrders, sortConfig, appData.pages]);

    // 3. Pre-calculate Color Map for distinct team coloring
    const teamColorMap = useMemo(() => {
        const map: Record<string, string> = {};
        // Get unique teams from the current dataset and sort them
        const uniqueTeams = Array.from(new Set(pageStats.map(p => p.teamName))).sort();
        
        uniqueTeams.forEach((team, index) => {
            const colors = COLOR_PALETTES[colorPalette];
            // Assign color based on the index in the sorted list (Sequential)
            // This ensures adjacent teams in a sorted list get different colors (Index 0, Index 1, Index 2...)
            map[team] = colors[index % colors.length];
        });
        return map;
    }, [pageStats, colorPalette]);

    // 4. Totals
    const grandTotals = useMemo(() => {
        const totals: any = { revenue: 0, profit: 0, orders: 0 };
        MONTHS.forEach(m => { totals[`rev_${m}`] = 0; totals[`prof_${m}`] = 0; });
        pageStats.forEach(stat => {
            totals.revenue += stat.revenue;
            totals.profit += stat.profit;
            totals.orders += stat.orders;
            MONTHS.forEach(m => { totals[`rev_${m}`] += (stat[`rev_${m}`] || 0); totals[`prof_${m}`] += (stat[`prof_${m}`] || 0); });
        });
        return totals;
    }, [pageStats]);

    // Columns Definition
    const revenueColumns = useMemo(() => [
        { key: 'index', label: '#' },
        { key: 'logo', label: 'Logo' },
        { key: 'pageName', label: 'ឈ្មោះ Page' },
        { key: 'teamName', label: 'Team' },
        { key: 'totalRevenue', label: 'សរុប (Revenue)' },
        { key: 'members', label: 'Members' },
        ...MONTHS.map(m => ({ key: `rev_${m}`, label: m }))
    ], []);

    const profitColumns = useMemo(() => [
        { key: 'index', label: '#' },
        { key: 'logo', label: 'Logo' },
        { key: 'pageName', label: 'ឈ្មោះ Page' },
        { key: 'teamName', label: 'Team' },
        { key: 'totalProfit', label: 'សរុប (Profit)' },
        { key: 'members', label: 'Members' },
        ...MONTHS.map(m => ({ key: `prof_${m}`, label: m }))
    ], []);

    const activeRevCols = revenueColumns.filter(c => visibleRevColumns.has(c.key));
    const activeProfCols = profitColumns.filter(c => visibleProfColumns.has(c.key));

    const renderSortIndicator = (key: SortKey) => {
        if (sortConfig.key !== key) return <span className="text-gray-600 ml-1 opacity-50">⇅</span>;
        return <span className="text-blue-400 ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    const renderTable = (type: 'Revenue' | 'Profit', columns: any[], visibleCols: Set<string>, activeCols: any[], toggleFunc: any, toggleAllFunc: any, prefix: string) => (
        <div className="page-card flex flex-col mb-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <h3 className={`text-xl font-bold ${type === 'Revenue' ? 'text-blue-300' : 'text-green-400'}`}>
                    {type === 'Revenue' ? 'តារាងចំណូលតាម Page (Revenue Breakdown)' : 'តារាងប្រាក់ចំណេញតាម Page (Profit Breakdown)'}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center bg-gray-800 rounded p-1 border border-gray-600">
                        <button 
                            onClick={() => setShowTeamColors(!showTeamColors)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${showTeamColors ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            title="Toggle Team Colors"
                        >
                            Colors: {showTeamColors ? 'ON' : 'OFF'}
                        </button>
                        {showTeamColors && (
                            <select 
                                value={colorPalette} 
                                onChange={(e) => setColorPalette(e.target.value as PaletteType)}
                                className="ml-2 bg-transparent text-xs text-white border-none focus:ring-0 cursor-pointer"
                            >
                                <option value="rich">Rich</option>
                                <option value="cool">Cool</option>
                                <option value="warm">Warm</option>
                            </select>
                        )}
                    </div>

                    <button onClick={() => setIsFrozen(!isFrozen)} className={`btn btn-secondary !py-1 !px-2 ${isFrozen ? 'bg-blue-600/50 text-white' : ''}`}>
                        {isFrozen ? "Unfreeze" : "Freeze"}
                    </button>
                     <button onClick={() => setShowBorders(!showBorders)} className={`btn btn-secondary !py-1 !px-2 ${showBorders ? 'bg-blue-600/50 text-white' : ''}`}>
                         Border
                    </button>
                    <ColumnToggler columns={columns} visibleColumns={visibleCols} onToggle={toggleFunc} onToggleAllMonths={toggleAllFunc} prefix={prefix} />
                </div>
            </div>

            <div className={`overflow-x-auto ${showBorders ? 'border border-gray-600 rounded' : ''}`}>
                <table className={`report-table w-full border-collapse ${showBorders ? 'border border-gray-600' : ''}`}>
                    <thead className="bg-gray-800">
                        <tr>
                            {activeCols.map(col => {
                                let stickyClass = "";
                                let stickyStyle: React.CSSProperties = {};
                                // Added bg-gray-800 to sticky headers to prevent transparency overlap
                                if (isFrozen) {
                                    if (col.key === 'index') { stickyClass = "sticky left-0 z-20 bg-gray-800 shadow-lg"; stickyStyle = { width: '50px' }; }
                                    else if (col.key === 'logo') { stickyClass = "sticky left-[50px] z-20 bg-gray-800 shadow-lg"; stickyStyle = { width: '60px' }; }
                                    else if (col.key === 'pageName') { 
                                        stickyClass = "sticky z-20 bg-gray-800 shadow-lg"; 
                                        // Adjust position based on if logo is visible
                                        const leftPos = visibleCols.has('logo') ? '110px' : '50px'; 
                                        stickyStyle = { left: leftPos };
                                    }
                                }
                                
                                const isSortable = col.key === 'pageName' || col.key === 'teamName' || col.key === 'totalRevenue' || col.key === 'totalProfit';
                                const sortKeyMap: Record<string, SortKey> = { 'pageName': 'pageName', 'teamName': 'team', 'totalRevenue': 'revenue', 'totalProfit': 'profit' };

                                return (
                                    <th 
                                        key={col.key} 
                                        className={`${showBorders ? 'border border-gray-600' : 'border-b border-gray-700'} px-4 py-2 whitespace-nowrap text-left ${stickyClass} ${isSortable ? 'cursor-pointer hover:bg-gray-700 select-none' : ''}`}
                                        style={stickyStyle}
                                        onClick={() => isSortable && handleSort(sortKeyMap[col.key])}
                                    >
                                        {col.label} {isSortable && renderSortIndicator(sortKeyMap[col.key])}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {pageStats.map((item, index) => {
                            // Determine row background based on sort key AND switch
                            const isTeamSort = sortConfig.key === 'team';
                            // Use the pre-calculated sequential color map
                            const rowBgClass = (isTeamSort && showTeamColors) ? (teamColorMap[item.teamName] || 'bg-gray-800') : 'hover:bg-gray-700/50 transition-colors';
                            
                            // For sticky cells, apply specific logic
                            const stickyBgClass = (isTeamSort && showTeamColors) ? rowBgClass : 'bg-gray-900';

                            return (
                                <tr key={item.pageName} className={rowBgClass}>
                                    {activeCols.map(col => {
                                        const cellClass = `${showBorders ? 'border border-gray-600' : 'border-b border-gray-800'} px-4 py-3 whitespace-nowrap`;
                                        let stickyClass = "";
                                        let stickyStyle: React.CSSProperties = {};
                                        
                                        // Sticky column logic
                                        if (isFrozen) {
                                            if (col.key === 'index') { stickyClass = `sticky left-0 z-10 ${stickyBgClass} shadow-lg`; stickyStyle = { width: '50px' }; }
                                            else if (col.key === 'logo') { stickyClass = `sticky left-[50px] z-10 ${stickyBgClass} shadow-lg`; stickyStyle = { width: '60px' }; }
                                            else if (col.key === 'pageName') { 
                                                stickyClass = `sticky z-10 ${stickyBgClass} shadow-lg`; 
                                                const leftPos = visibleCols.has('logo') ? '110px' : '50px';
                                                stickyStyle = { left: leftPos };
                                            }
                                        }

                                        if (col.key === 'index') return <td key={col.key} className={`${cellClass} text-center text-gray-400 ${stickyClass}`} style={stickyStyle}>{index + 1}</td>;
                                        
                                        if (col.key === 'logo') return (
                                            <td key={col.key} className={`${cellClass} ${stickyClass} p-1`} style={stickyStyle}>
                                                <img 
                                                    src={convertGoogleDriveUrl(item.logoUrl)} 
                                                    alt="Logo" 
                                                    className="w-10 h-10 rounded-full object-cover border border-gray-600 bg-gray-700 mx-auto" 
                                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/40x40/374151/9ca3af?text=Log'; }}
                                                />
                                            </td>
                                        );

                                        if (col.key === 'pageName') return <td key={col.key} className={`${cellClass} font-semibold text-white ${stickyClass}`} style={stickyStyle}>{item.pageName}</td>;
                                        
                                        // Highlight Team Name for better visibility since we sort by it
                                        if (col.key === 'teamName') return <td key={col.key} className={`${cellClass} text-yellow-300 font-medium`}>{item.teamName}</td>;
                                        
                                        if (col.key === 'totalRevenue') return <td key={col.key} className={`${cellClass} text-right font-medium text-blue-300`}>${item.revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>;
                                        if (col.key === 'totalProfit') return <td key={col.key} className={`${cellClass} text-right font-medium text-green-400`}>${item.profit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>;
                                        
                                        if (col.key === 'members') return (
                                            <td key={col.key} className={`${cellClass} text-center`}>
                                                <div className="flex flex-wrap justify-center gap-1">
                                                    {Array.from(item.members).slice(0, 3).map((m: any) => <span key={m} className="bg-gray-700 px-2 py-0.5 rounded text-xs text-gray-300">{m}</span>)}
                                                    {item.members.size > 3 && <span className="text-xs text-gray-500">+{item.members.size - 3}</span>}
                                                </div>
                                            </td>
                                        );
                                        
                                        if (col.key.startsWith(prefix)) {
                                            const val = item[col.key] || 0;
                                            const isPositive = val > 0;
                                            const colorClass = type === 'Profit' ? (isPositive ? 'text-green-400' : val < 0 ? 'text-red-400' : 'text-gray-600') : (isPositive ? 'text-blue-300' : 'text-gray-600');
                                            return <td key={col.key} className={`${cellClass} text-right ${colorClass}`}>{val !== 0 ? `$${val.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}</td>;
                                        }
                                        return <td key={col.key} className={cellClass}>-</td>;
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot className="bg-gray-800 font-bold">
                        <tr>
                            {activeCols.map((col, idx) => {
                                const cellClass = `${showBorders ? 'border border-gray-600' : 'border-t border-gray-600'} px-4 py-3 whitespace-nowrap`;
                                let stickyClass = "", stickyStyle: React.CSSProperties = {};
                                // Added background to footer sticky cells
                                if (isFrozen) {
                                    if (col.key === 'index') { stickyClass = "sticky left-0 z-20 bg-gray-800 shadow-lg"; stickyStyle = { width: '50px' }; }
                                    else if (col.key === 'logo') { stickyClass = "sticky left-[50px] z-20 bg-gray-800 shadow-lg"; stickyStyle = { width: '60px' }; }
                                    else if (col.key === 'pageName') { 
                                        stickyClass = "sticky z-20 bg-gray-800 shadow-lg"; 
                                        const leftPos = visibleCols.has('logo') ? '110px' : '50px';
                                        stickyStyle = { left: leftPos };
                                    }
                                }

                                if (idx === 0) return <td key={col.key} className={`${cellClass} ${stickyClass}`} style={stickyStyle} colSpan={activeCols[1]?.key === 'logo' || activeCols[1]?.key === 'pageName' ? (visibleCols.has('logo') && visibleCols.has('pageName') ? 3 : 2) : 1}>សរុបរួម</td>;
                                if (col.key === 'logo' || col.key === 'pageName') return null; // Handled by colspan
                                if (col.key === 'teamName') return <td key={col.key} className={cellClass}></td>;
                                
                                if (col.key === 'totalRevenue') return <td key={col.key} className={`${cellClass} text-right text-blue-300`}>${grandTotals.revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>;
                                if (col.key === 'totalProfit') return <td key={col.key} className={`${cellClass} text-right text-green-400`}>${grandTotals.profit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>;
                                
                                if (col.key.startsWith(prefix)) return <td key={col.key} className={`${cellClass} text-right`}>${(grandTotals[col.key] || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>;
                                return <td key={col.key} className={cellClass}></td>;
                            })}
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );

    return (
        <div className="w-full h-full min-h-[calc(100vh-6rem)] max-w-[120rem] mx-auto p-2 sm:p-4 lg:p-6 animate-fade-in">
             <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                    <span className="bg-blue-600 p-2 rounded-lg">📄</span>
                    របាយការណ៍ផ្នែកលក់តាម Page
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
                    <select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRangePreset)} className="form-select max-w-xs">
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
                    <SimpleBarChart data={pageStats.slice(0, 10).map(p => ({ label: p.pageName, value: p.revenue }))} title="Top 10 Pages by Revenue" />
                </div>
                <div className="page-card">
                    <SimpleBarChart data={pageStats.slice(0, 10).map(p => ({ label: p.pageName, value: p.profit }))} title="Top 10 Pages by Profit" />
                </div>
            </div>
        </div>
    );
};

export default SalesByPageReport;
