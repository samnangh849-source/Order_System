
import React, { useState, useMemo, useContext, useEffect } from 'react';
import { ParsedOrder } from '../../types';
import { AppContext } from '../../context/AppContext';
import { analyzeReportData, generateSalesForecast } from '../../services/geminiService';
import GeminiButton from '../common/GeminiButton';
import Spinner from '../common/Spinner';
import SimpleBarChart from './SimpleBarChart';
import SimpleLineChart from '../common/SimpleLineChart';

interface ReportsViewProps {
    orders: ParsedOrder[];
    allOrders: ParsedOrder[]; // For forecasting
    reportType: 'overview' | 'performance' | 'profitability' | 'forecasting' | 'shipping';
}

const ColumnToggler = ({ columns, visibleColumns, onToggle }: { columns: { key: string, label: string }[], visibleColumns: Set<string>, onToggle: (key: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <button onClick={() => setIsOpen(!isOpen)} className="btn btn-secondary !py-1 !px-3 text-sm flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                Columns
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-gray-700 border border-gray-600 rounded-md shadow-lg z-20 max-h-80 overflow-y-auto">
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
}

const DataTable = ({ title, data, columns, visibleColumns, onColumnToggle }: { title: string, data: any[], columns: { key: string, label: string, render?: (value: any, row: any, index: number) => React.ReactNode }[], visibleColumns: Set<string>, onColumnToggle: (key: string) => void }) => {
    const activeColumns = useMemo(() => columns.filter(c => visibleColumns.has(c.key)), [columns, visibleColumns]);
    const [showBorders, setShowBorders] = useState(true);

    return (
        <div className="flex flex-col h-full bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">{title}</h3>
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={() => setShowBorders(!showBorders)} 
                        className={`btn btn-secondary !py-1 !px-2 ${showBorders ? 'bg-blue-600/50 text-white' : ''}`} 
                        title={showBorders ? "Hide Borders" : "Show Borders"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <ColumnToggler columns={columns} visibleColumns={visibleColumns} onToggle={onColumnToggle} />
                </div>
            </div>
            <div className="overflow-auto flex-grow">
                 <table className={`report-table w-full border-collapse ${showBorders ? 'border border-gray-600' : ''}`}>
                    <thead className="bg-gray-800 sticky top-0 z-10">
                        <tr>
                            {activeColumns.map(c => (
                                <th key={c.key} className={`${showBorders ? 'border border-gray-600' : 'border-b border-gray-700'} px-4 py-3 text-left whitespace-nowrap`}>
                                    {c.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.length > 0 ? data.map((row, index) => (
                            <tr key={index} className="hover:bg-gray-700/50 transition-colors">
                                {activeColumns.map(col => {
                                    const value = row[col.key];
                                    return (
                                        <td key={col.key} className={`${showBorders ? 'border border-gray-600' : 'border-b border-gray-800'} px-4 py-2 text-sm whitespace-nowrap`}>
                                            {col.render ? col.render(value, row, index) : value}
                                        </td>
                                    );
                                })}
                            </tr>
                        )) : (
                            <tr><td colSpan={activeColumns.length} className={`text-center text-gray-500 py-8 ${showBorders ? 'border border-gray-600' : ''}`}>No data available</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ReportsView: React.FC<ReportsViewProps> = ({ orders, reportType, allOrders }) => {
    const { geminiAi } = useContext(AppContext);
    const [analysis, setAnalysis] = useState<string>('');
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);
    
    // Column State Management for different tables
    const [profitColumns, setProfitColumns] = useState(new Set(['name', 'quantity', 'revenue', 'cost', 'profit', 'margin']));
    const [shippingColumns, setShippingColumns] = useState(new Set(['method', 'count', 'cost']));

    // Clear analysis when data changes
    useEffect(() => {
        setAnalysis('');
    }, [orders, reportType]);

    // --- AGGREGATION LOGIC ---
    const summaryData = useMemo(() => {
        const revenue = orders.reduce((sum, o) => sum + (Number(o['Grand Total']) || 0), 0);
        const productCost = orders.reduce((sum, o) => sum + (Number(o['Total Product Cost ($)']) || 0), 0);
        const internalCost = orders.reduce((sum, o) => sum + (Number(o['Internal Cost']) || 0), 0);
        const profit = revenue - productCost - internalCost;
        const totalOrders = orders.length;
        const aov = totalOrders > 0 ? revenue / totalOrders : 0;

        return { revenue, profit, totalOrders, aov };
    }, [orders]);

    const profitabilityData = useMemo(() => {
        const products: Record<string, { name: string, quantity: number, revenue: number, cost: number }> = {};
        orders.forEach(order => {
            order.Products?.forEach(p => {
                if (!p.name) return;
                if (!products[p.name]) products[p.name] = { name: p.name, quantity: 0, revenue: 0, cost: 0 };
                products[p.name].quantity += (Number(p.quantity) || 0);
                products[p.name].revenue += (Number(p.total) || 0); // Using calculated total from product
                // Product cost calculation: cost * quantity
                products[p.name].cost += ((Number(p.cost) || 0) * (Number(p.quantity) || 0));
            });
        });

        return Object.values(products).map(p => ({
            ...p,
            profit: p.revenue - p.cost,
            margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0
        })).sort((a, b) => b.profit - a.profit);
    }, [orders]);

    const shippingData = useMemo(() => {
        const methods: Record<string, { method: string, count: number, cost: number }> = {};
        const drivers: Record<string, { driver: string, count: number, cost: number }> = {};

        orders.forEach(order => {
            const method = order['Internal Shipping Method'] || 'Unspecified';
            const driver = order['Internal Shipping Details'] || 'Unassigned';
            const cost = Number(order['Internal Cost']) || 0;

            if (!methods[method]) methods[method] = { method, count: 0, cost: 0 };
            methods[method].count += 1;
            methods[method].cost += cost;

            if (order['Internal Shipping Method'] && order['Internal Shipping Details']) {
               if (!drivers[driver]) drivers[driver] = { driver, count: 0, cost: 0 };
               drivers[driver].count += 1;
               drivers[driver].cost += cost;
            }
        });

        return {
            byMethod: Object.values(methods).sort((a, b) => b.count - a.count),
            byDriver: Object.values(drivers).sort((a, b) => b.count - a.count)
        };
    }, [orders]);

    const forecastingData = useMemo(() => {
        // Use allOrders to get better historical trend, filter last 30 days
        const sorted = [...allOrders].sort((a, b) => new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime());
        const daily: Record<string, number> = {};
        
        sorted.forEach(o => {
            if (!o.Timestamp) return;
            const date = new Date(o.Timestamp).toISOString().slice(0, 10);
            daily[date] = (daily[date] || 0) + (Number(o['Grand Total']) || 0);
        });

        // Get last 14 days for visual chart
        const labels = Object.keys(daily).slice(-14);
        return labels.map(date => ({ label: date.slice(5), value: daily[date] }));
    }, [allOrders]);


    // --- HANDLERS ---
    const handleAnalyze = async () => {
        if (!geminiAi) return;
        setLoadingAnalysis(true);
        
        if (reportType === 'forecasting') {
            const result = await generateSalesForecast(geminiAi, allOrders);
            setAnalysis(result);
            setLoadingAnalysis(false);
            return;
        }

        const reportPayload = {
            revenue: summaryData.revenue,
            profit: summaryData.profit,
            totalOrders: summaryData.totalOrders,
            aov: summaryData.aov,
            byProduct: profitabilityData.slice(0, 5).map(p => ({ label: p.name, revenue: p.revenue })),
            byPage: [], 
            byUser: []
        };

        const result = await analyzeReportData(geminiAi, reportPayload, { reportType }); 
        setAnalysis(result);
        setLoadingAnalysis(false);
    };

    // --- RENDER CONTENT ---
    const renderOverview = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="stat-card-new bg-blue-900/20 border-blue-500/30">
                    <p className="text-gray-400 text-sm">Total Revenue</p>
                    <p className="text-2xl font-bold text-blue-400">${summaryData.revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
                <div className="stat-card-new bg-green-900/20 border-green-500/30">
                    <p className="text-gray-400 text-sm">Net Profit</p>
                    <p className="text-2xl font-bold text-green-400">${summaryData.profit.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
                <div className="stat-card-new bg-purple-900/20 border-purple-500/30">
                    <p className="text-gray-400 text-sm">Total Orders</p>
                    <p className="text-2xl font-bold text-purple-400">{summaryData.totalOrders}</p>
                </div>
                <div className="stat-card-new bg-yellow-900/20 border-yellow-500/30">
                    <p className="text-gray-400 text-sm">Avg Order Value</p>
                    <p className="text-2xl font-bold text-yellow-400">${summaryData.aov.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-96">
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 flex flex-col items-center justify-center">
                     <SimpleBarChart 
                        title="Top 5 Products by Revenue" 
                        data={profitabilityData.slice(0, 5).map(p => ({ label: p.name.substring(0, 15) + '...', value: p.revenue }))} 
                    />
                </div>
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                     <h3 className="text-lg font-bold text-white mb-4">AI Analysis</h3>
                     {!analysis ? (
                         <div className="h-full flex flex-col items-center justify-center text-center">
                             <p className="text-gray-400 mb-4">Click below to generate insights about this data.</p>
                             <GeminiButton onClick={handleAnalyze} isLoading={loadingAnalysis}>Analyze Overview</GeminiButton>
                         </div>
                     ) : (
                         <div className="prose prose-invert prose-sm max-h-72 overflow-y-auto whitespace-pre-wrap">
                             {analysis}
                         </div>
                     )}
                </div>
            </div>
        </div>
    );

    const renderProfitability = () => {
        const columns = [
            { key: 'name', label: 'Product Name' },
            { key: 'quantity', label: 'Qty Sold', render: (val: number) => val.toLocaleString() },
            { key: 'revenue', label: 'Total Revenue', render: (val: number) => `$${val.toLocaleString(undefined, {minimumFractionDigits: 2})}` },
            { key: 'cost', label: 'Total Cost', render: (val: number) => `$${val.toLocaleString(undefined, {minimumFractionDigits: 2})}` },
            { key: 'profit', label: 'Net Profit', render: (val: number) => <span className={val >= 0 ? 'text-green-400' : 'text-red-400'}>${val.toLocaleString(undefined, {minimumFractionDigits: 2})}</span> },
            { key: 'margin', label: 'Margin %', render: (val: number) => <span className={val >= 0 ? 'text-green-400' : 'text-red-400'}>{val.toFixed(1)}%</span> },
        ];

        return (
            <div className="h-[600px]">
                <DataTable 
                    title="Product Profitability" 
                    data={profitabilityData} 
                    columns={columns} 
                    visibleColumns={profitColumns}
                    onColumnToggle={(key) => {
                        const newSet = new Set(profitColumns);
                        if (newSet.has(key)) newSet.delete(key); else newSet.add(key);
                        setProfitColumns(newSet);
                    }}
                />
            </div>
        );
    };

    const renderShipping = () => {
        const methodCols = [
            { key: 'method', label: 'Method' },
            { key: 'count', label: 'Orders' },
            { key: 'cost', label: 'Total Cost ($)', render: (val: number) => `$${val.toFixed(2)}` }
        ];
        
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px]">
                <DataTable 
                    title="Cost by Shipping Service" 
                    data={shippingData.byMethod} 
                    columns={methodCols}
                    visibleColumns={new Set(['method', 'count', 'cost'])}
                    onColumnToggle={() => {}}
                />
                <DataTable 
                    title="Cost by Driver" 
                    data={shippingData.byDriver.map(d => ({...d, method: d.driver}))} // Map driver to method key for reuse
                    columns={[{ key: 'method', label: 'Driver' }, { key: 'count', label: 'Deliveries' }, { key: 'cost', label: 'Total Paid ($)', render: (val: number) => `$${val.toFixed(2)}` }]}
                    visibleColumns={new Set(['method', 'count', 'cost'])}
                    onColumnToggle={() => {}}
                />
            </div>
        );
    };

    const renderForecasting = () => (
        <div className="space-y-6">
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 h-80 flex flex-col justify-center">
                <SimpleLineChart data={forecastingData} title="Recent Daily Revenue Trend (14 Days)" />
            </div>
            
            <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700 text-center">
                <h3 className="text-xl font-bold text-white mb-4">✨ AI Sales Forecast</h3>
                {!analysis ? (
                    <div className="flex flex-col items-center">
                        <p className="text-gray-400 mb-6 max-w-lg">
                            Use Gemini AI to analyze your historical sales data and predict future trends, identify potential risks, and get actionable recommendations.
                        </p>
                        <GeminiButton onClick={handleAnalyze} isLoading={loadingAnalysis} className="px-8 py-3 text-lg">
                            Generate Forecast
                        </GeminiButton>
                    </div>
                ) : (
                    <div className="text-left bg-gray-900/50 p-6 rounded-lg border border-gray-600">
                        <div className="prose prose-invert max-w-none whitespace-pre-wrap leading-relaxed">
                            {analysis}
                        </div>
                        <button onClick={() => setAnalysis('')} className="mt-6 text-sm text-blue-400 hover:text-blue-300 underline">
                            Clear Analysis
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="h-full">
            {reportType === 'overview' && renderOverview()}
            {reportType === 'profitability' && renderProfitability()}
            {reportType === 'shipping' && renderShipping()}
            {reportType === 'forecasting' && renderForecasting()}
            {reportType === 'performance' && <div className="text-center text-gray-500 mt-10">Performance metrics are available in the main dashboard view.</div>}
        </div>
    );
};

export default ReportsView;
