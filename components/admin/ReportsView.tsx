import React, { useState, useMemo, useContext, useEffect } from 'react';
import { ParsedOrder, User, AppData, MasterProduct, ShippingMethod } from '../../types';
import { AppContext } from '../../App';
import { analyzeReportData, generateSalesForecast } from '../../services/geminiService';
import GeminiButton from '../common/GeminiButton';
import Spinner from '../common/Spinner';
import SimpleBarChart from './SimpleBarChart';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

interface ReportsViewProps {
    orders: ParsedOrder[];
    allOrders: ParsedOrder[]; // For forecasting
    reportType: 'overview' | 'performance' | 'profitability' | 'forecasting' | 'shipping';
}

type ProfitView = 'product' | 'page' | 'team';
type ShippingCostView = 'service' | 'driver';

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
            <button onClick={() => setIsOpen(!isOpen)} className="btn btn-secondary !py-1 !px-3 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                Columns
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-700 border border-gray-600 rounded-md shadow-lg z-20">
                    {columns.map(col => (
                        <label key={col.key} className="flex items-center px-3 py-2 text-sm text-gray-200 hover:bg-gray-600 cursor-pointer">
                            <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-blue-500 focus:ring-blue-500"
                                checked={visibleColumns.has(col.key)}
                                onChange={() => onToggle(col.key)}
                            />
                            <span className="ml-3">{col.label}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}

const DataTable = ({ title, data, columns, visibleColumns, onColumnToggle, className = '' }: { title: string, data: any[], columns: { key: string, label: string, render?: (value: any, row: any) => React.ReactNode }[], visibleColumns: Set<string>, onColumnToggle: (key: string) => void, className?: string }) => {
    const activeColumns = useMemo(() => columns.filter(c => visibleColumns.has(c.key)), [columns, visibleColumns]);

    return (
        <div className={`page-card ${className}`}>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">{title}</h3>
                <ColumnToggler columns={columns} visibleColumns={visibleColumns} onToggle={onColumnToggle} />
            </div>
            <div className="overflow-auto max-h-[calc(100vh-25rem)]">
                <table className="report-table">
                    <thead>
                        <tr>{activeColumns.map(c => <th key={c.key}>{c.label}</th>)}</tr>
                    </thead>
                    <tbody>
                        {data.length > 0 ? data.map((row, index) => (
                            <tr key={index}>
                                {activeColumns.map(col => {
                                    const value = row[col.key];
                                    return <td key={col.key}>{col.render ? col.render(value, row) : value}</td>
                                })}
                            </tr>
                        )) : (
                            <tr><td colSpan={activeColumns.length} className="text-center text-gray-500 py-4">No data</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// New redesigned stat card
const StatCardRedesigned = ({ title, value, change, changeType, icon }: { title: string, value: string, change: string, changeType: 'increase' | 'decrease' | 'neutral', icon: React.ReactNode }) => {
    const changeColor = changeType === 'increase' ? 'text-green-400' : changeType === 'decrease' ? 'text-red-400' : 'text-gray-400';
    const ChangeIcon = changeType === 'increase' ? 
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /> : 
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />;

    return (
        <div className="stat-card-new">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-400">{title}</span>
                <div className="text-blue-400">{icon}</div>
            </div>
            <div className="mt-2">
                <p className="text-3xl font-bold text-white">{value}</p>
                <div className="flex items-center text-sm mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-1 ${changeColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">{ChangeIcon}</svg>
                    <span className={`${changeColor} font-semibold`}>{change}</span>
                    <span className="text-gray-500 ml-1">vs last period</span>
                </div>
            </div>
        </div>
    );
};


const ReportsView: React.FC<ReportsViewProps> = ({ orders: filteredOrders, allOrders, reportType }) => {
    const { geminiAi, appData } = useContext(AppContext);
    
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState('');
    const [analysisError, setAnalysisError] = useState('');

    const reportData = useMemo(() => {
        const revenue = filteredOrders.reduce((sum, o) => sum + o['Grand Total'], 0);
        const totalProductCost = filteredOrders.reduce((sum, o) => sum + (o['Total Product Cost ($)'] || 0), 0);
        const totalInternalCost = filteredOrders.reduce((sum, o) => sum + (o['Internal Cost'] || 0), 0);
        const profit = revenue - totalProductCost - totalInternalCost;
        const totalOrders = filteredOrders.length;
        const aov = totalOrders > 0 ? revenue / totalOrders : 0;
        const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

        const aggregateBy = (key: 'Team' | 'User' | 'Page') => {
            const aggregation = filteredOrders.reduce((acc, order) => {
                const group = order[key];
                if (!group) return acc;
                if (!acc[group]) {
                    acc[group] = { revenue: 0, profit: 0, orders: 0, label: group };
                }
                acc[group].revenue += order['Grand Total'];
                const orderProfit = order['Grand Total'] - (order['Total Product Cost ($)'] || 0) - (order['Internal Cost'] || 0);
                acc[group].profit += orderProfit;
                acc[group].orders += 1;
                return acc;
            }, {} as Record<string, { revenue: number, profit: number, orders: number, label: string }>);

            return Object.values(aggregation).map(item => ({
                ...item,
                revenueFormatted: `$${item.revenue.toFixed(2)}`,
                profitFormatted: `$${item.profit.toFixed(2)}`,
            })).sort((a, b) => b.revenue - a.revenue);
        };

        const byProduct = filteredOrders
            .flatMap(order => order.Products.map(p => ({ ...p, team: order.Team, user: order.User })))
            .reduce((acc, product) => {
                const masterProduct: MasterProduct | undefined = appData.products?.find((mp: MasterProduct) => mp.ProductName === product.name);
                if (!acc[product.name]) {
                    acc[product.name] = { revenue: 0, profit: 0, quantity: 0, label: product.name, image: masterProduct?.ImageURL || '' };
                }
                acc[product.name].revenue += product.total;
                const productProfit = product.total - (product.cost * product.quantity);
                acc[product.name].profit += productProfit;
                acc[product.name].quantity += product.quantity;
                return acc;
            }, {} as Record<string, { revenue: number, profit: number, quantity: number, label: string, image: string }>);
            
        const byShippingMethod = filteredOrders.reduce((acc, order) => {
            const method = order['Internal Shipping Method'];
            if (!method) return acc;
            const methodInfo: ShippingMethod | undefined = appData.shippingMethods?.find((s: any) => s.MethodName === method);
            if (!acc[method]) {
                acc[method] = { label: method, cost: 0, orders: 0, logo: methodInfo?.LogosURL || '' };
            }
            acc[method].cost += (order['Internal Cost'] || 0);
            acc[method].orders += 1;
            return acc;
        }, {} as Record<string, { label: string, cost: number, orders: number, logo: string }>);

        const byDriver = filteredOrders.reduce((acc, order) => {
            const methodInfo = appData.shippingMethods?.find((s: any) => s.MethodName === order['Internal Shipping Method']);
            if (!methodInfo || !methodInfo.RequireDriverSelection) return acc;
            const driver = order['Internal Shipping Details'];
            if (!driver) return acc;
            if (!acc[driver]) {
                acc[driver] = { label: driver, cost: 0, orders: 0, shippingService: order['Internal Shipping Method'] };
            }
            acc[driver].cost += (order['Internal Cost'] || 0);
            acc[driver].orders += 1;
            return acc;
        }, {} as Record<string, { label: string, cost: number, orders: number, shippingService: string }>);


        return {
            revenue,
            profit,
            totalOrders,
            aov,
            profitMargin,
            byPage: aggregateBy('Page'),
            byUser: aggregateBy('User'),
            byProduct: Object.values(byProduct).map(item => ({...item, revenueFormatted: `$${item.revenue.toFixed(2)}`, profitFormatted: `$${item.profit.toFixed(2)}`})).sort((a, b) => b.revenue - a.revenue),
            byTeam: aggregateBy('Team'),
            byShippingMethod: Object.values(byShippingMethod).map(item => ({...item, costFormatted: `$${item.cost.toFixed(2)}`})).sort((a,b) => b.cost - a.cost),
            byDriver: Object.values(byDriver).map(item => ({...item, costFormatted: `$${item.cost.toFixed(2)}`})).sort((a,b) => b.cost - a.cost),
        };
    }, [filteredOrders, appData]);

    const handleAnalyze = async () => {
        if (!geminiAi) {
            setAnalysisError("Gemini AI is not configured.");
            return;
        }
        setIsAnalyzing(true);
        setAnalysisResult('');
        setAnalysisError('');
        try {
            const result = await analyzeReportData(geminiAi, reportData, {});
            setAnalysisResult(result);
        } catch (error) {
            console.error(error);
            setAnalysisError("Failed to get analysis from Gemini.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const OverviewTab = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                 <StatCardRedesigned title="Total Revenue" value={`$${reportData.revenue.toFixed(2)}`} change="+5.4%" changeType="increase" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} />
                <StatCardRedesigned title="Net Profit" value={`$${reportData.profit.toFixed(2)}`} change="-2.1%" changeType="decrease" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>} />
                <StatCardRedesigned title="Total Orders" value={reportData.totalOrders.toString()} change="+12" changeType="increase" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>} />
                <StatCardRedesigned title="Avg. Order Value" value={`$${reportData.aov.toFixed(2)}`} change="+1.5%" changeType="increase" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4z" /></svg>} />
            </div>

            {geminiAi && (
                <div className="page-card !bg-gray-800/60 mt-6">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                        <h3 className="text-lg font-bold text-white">Gemini AI Analysis</h3>
                        <GeminiButton onClick={handleAnalyze} isLoading={isAnalyzing}>
                            Generate Insights
                        </GeminiButton>
                    </div>
                    {isAnalyzing && <div className="flex justify-center"><Spinner /></div>}
                    {analysisError && <p className="text-red-400">{analysisError}</p>}
                    {analysisResult && (
                        <div className="gemini-analysis whitespace-pre-wrap font-sans">
                            {analysisResult}
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    const PerformanceTab = () => {
        const top10Products = useMemo(() => {
            return reportData.byProduct.slice(0, 10).map(p => {
                const productInfo: MasterProduct | undefined = appData.products.find((master: MasterProduct) => master.ProductName === p.label);
                return {
                    label: p.label,
                    value: p.revenue,
                    imageUrl: productInfo?.ImageURL || ''
                }
            });
        }, [reportData.byProduct, appData.products]);

        const top10Users = useMemo(() => reportData.byUser.slice(0, 10).map(u => ({ label: u.label, value: u.revenue })), [reportData.byUser]);
        const top10Pages = useMemo(() => reportData.byPage.slice(0, 10).map(p => ({ label: p.label, value: p.revenue })), [reportData.byPage]);

        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="page-card !bg-gray-800/60"><SimpleBarChart data={top10Products} title="Top 10 Products by Revenue" /></div>
                <div className="page-card !bg-gray-800/60"><SimpleBarChart data={top10Users} title="Top 10 Users by Revenue" /></div>
                <div className="page-card !bg-gray-800/60 lg:col-span-2"><SimpleBarChart data={top10Pages} title="Top 10 Pages by Revenue" /></div>
            </div>
        );
    };

    const ProfitabilityTab = () => {
        const [profitView, setProfitView] = useState<ProfitView>('product');
        const [visibleColumns, setVisibleColumns] = useState(new Set(['label', 'revenueFormatted', 'profitFormatted', 'orders', 'quantity', 'image']));
        
        const toggleColumn = (key: string) => {
            setVisibleColumns(prev => {
                const newSet = new Set(prev);
                if (newSet.has(key)) {
                    newSet.delete(key);
                } else {
                    newSet.add(key);
                }
                return newSet;
            });
        };

        const profitViews = [
            { id: 'product', label: 'By Product' },
            { id: 'page', label: 'By Page' },
            { id: 'team', label: 'By Team' }
        ];
        
        const columns = {
            product: [
                { key: 'image', label: 'Image', render: (val: string) => <img src={convertGoogleDriveUrl(val)} className="h-10 w-10 object-cover rounded" /> },
                { key: 'label', label: 'Product' }, { key: 'revenueFormatted', label: 'Revenue' },
                { key: 'profitFormatted', label: 'Profit' }, { key: 'quantity', label: 'Quantity' },
            ],
            page: [
                { key: 'label', label: 'Page' }, { key: 'revenueFormatted', label: 'Revenue' },
                { key: 'profitFormatted', label: 'Profit' }, { key: 'orders', label: 'Orders' },
            ],
            team: [
                { key: 'label', label: 'Team' }, { key: 'revenueFormatted', label: 'Revenue' },
                { key: 'profitFormatted', label: 'Profit' }, { key: 'orders', label: 'Orders' },
            ]
        };

        return (
            <div className="space-y-4">
                 <div className="flex items-center space-x-2 bg-gray-800/50 p-1 rounded-lg self-start">
                    {profitViews.map(view => (
                        <button
                            key={view.id}
                            onClick={() => setProfitView(view.id as ProfitView)}
                            className={`flex-1 text-sm font-semibold py-2 px-4 rounded-md transition-colors ${profitView === view.id ? 'bg-blue-600 text-white shadow' : 'text-gray-300 hover:bg-gray-700/50'}`}
                        >
                            {view.label}
                        </button>
                    ))}
                </div>
                
                {profitView === 'product' && <DataTable title="Profit by Product" data={reportData.byProduct} columns={columns.product} visibleColumns={visibleColumns} onColumnToggle={toggleColumn} className="!bg-gray-800/60" />}
                {profitView === 'page' && <DataTable title="Profit by Page" data={reportData.byPage} columns={columns.page} visibleColumns={visibleColumns} onColumnToggle={toggleColumn} className="!bg-gray-800/60" />}
                {profitView === 'team' && <DataTable title="Profit by Team" data={reportData.byTeam} columns={columns.team} visibleColumns={visibleColumns} onColumnToggle={toggleColumn} className="!bg-gray-800/60" />}
            </div>
        );
    };

    const ForecastingTab = () => {
        const [isForecasting, setIsForecasting] = useState(false);
        const [forecastResult, setForecastResult] = useState('');
        const [forecastError, setForecastError] = useState('');

        const handleForecast = async () => {
             if (!geminiAi) {
                setForecastError("Gemini AI is not configured.");
                return;
            }
            setIsForecasting(true);
            setForecastResult('');
            setForecastError('');
            try {
                const result = await generateSalesForecast(geminiAi, allOrders);
                setForecastResult(result);
            } catch (error) {
                console.error(error);
                setForecastError("Failed to get forecast from Gemini.");
            } finally {
                setIsForecasting(false);
            }
        }
        return (
            <div className="page-card !bg-gray-800/60">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                    <h3 className="text-lg font-bold text-white">Gemini Sales Forecast</h3>
                    <GeminiButton onClick={handleForecast} isLoading={isForecasting}>
                        Generate Forecast
                    </GeminiButton>
                </div>
                 {isForecasting && <div className="flex justify-center"><Spinner /></div>}
                 {forecastError && <p className="text-red-400">{forecastError}</p>}
                 {forecastResult && (
                    <div className="gemini-analysis whitespace-pre-wrap font-sans">
                        {forecastResult}
                    </div>
                )}
                 {!forecastResult && !isForecasting && (
                     <p className="text-gray-400 text-center py-8">Click the button to generate a sales forecast based on historical order data.</p>
                 )}
            </div>
        );
    };
    
    const ShippingTab = () => {
        const [shippingView, setShippingView] = useState<ShippingCostView>('service');
        const [visibleServiceCols, setVisibleServiceCols] = useState(new Set(['logo', 'label', 'costFormatted', 'orders']));
        const [visibleDriverCols, setVisibleDriverCols] = useState(new Set(['label', 'shippingService', 'costFormatted', 'orders']));

        const toggleServiceCol = (key: string) => setVisibleServiceCols(prev => {
            const newSet = new Set(prev);
            newSet.has(key) ? newSet.delete(key) : newSet.add(key);
            return newSet;
        });
        const toggleDriverCol = (key: string) => setVisibleDriverCols(prev => {
            const newSet = new Set(prev);
            newSet.has(key) ? newSet.delete(key) : newSet.add(key);
            return newSet;
        });

        const serviceColumns = [
            { key: 'logo', label: 'Logo', render: (val: string) => <img src={convertGoogleDriveUrl(val)} className="h-8 w-12 object-contain bg-white/10 p-1 rounded" /> },
            { key: 'label', label: 'Service' },
            { key: 'costFormatted', label: 'Total Cost' },
            { key: 'orders', label: 'Orders' },
        ];
        const driverColumns = [
            { key: 'label', label: 'Driver' },
            { key: 'shippingService', label: 'Shipping Service' },
            { key: 'costFormatted', label: 'Total Cost' },
            { key: 'orders', label: 'Orders' },
        ];

        return (
            <div className="space-y-4">
                <div className="flex items-center space-x-2 bg-gray-800/50 p-1 rounded-lg self-start">
                    <button onClick={() => setShippingView('service')} className={`flex-1 text-sm font-semibold py-2 px-4 rounded-md transition-colors ${shippingView === 'service' ? 'bg-blue-600 text-white shadow' : 'text-gray-300 hover:bg-gray-700/50'}`}>
                        By Shipping Service
                    </button>
                    <button onClick={() => setShippingView('driver')} className={`flex-1 text-sm font-semibold py-2 px-4 rounded-md transition-colors ${shippingView === 'driver' ? 'bg-blue-600 text-white shadow' : 'text-gray-300 hover:bg-gray-700/50'}`}>
                        By Driver
                    </button>
                </div>
                {shippingView === 'service' && <DataTable title="Costs by Shipping Service" data={reportData.byShippingMethod} columns={serviceColumns} visibleColumns={visibleServiceCols} onColumnToggle={toggleServiceCol} className="!bg-gray-800/60" />}
                {shippingView === 'driver' && <DataTable title="Costs by Driver" data={reportData.byDriver} columns={driverColumns} visibleColumns={visibleDriverCols} onColumnToggle={toggleDriverCol} className="!bg-gray-800/60" />}
            </div>
        );
    };

    switch (reportType) {
        case 'overview': return <OverviewTab />;
        case 'performance': return <PerformanceTab />;
        case 'profitability': return <ProfitabilityTab />;
        case 'forecasting': return <ForecastingTab />;
        case 'shipping': return <ShippingTab />;
        default: return null;
    }
};

export default ReportsView;
