import React, { useState, useMemo, useContext, useEffect } from 'react';
import { ParsedOrder, User, AppData } from '../../types';
import { AppContext } from '../../App';
import { analyzeReportData, generateSalesForecast } from '../../services/geminiService';
import GeminiButton from '../common/GeminiButton';
import Spinner from '../common/Spinner';
import SimpleBarChart from './SimpleBarChart';

interface ReportsViewProps {
    orders: ParsedOrder[];
}

type ReportTab = 'overview' | 'performance' | 'profitability' | 'forecasting';
type DateRangePreset = 'all' | 'today' | 'this_week' | 'this_month' | 'this_year' | 'custom';

const datePresets: { label: string, value: DateRangePreset }[] = [
    { label: 'All Time', value: 'all' },
    { label: 'Today', value: 'today' },
    { label: 'This Week', value: 'this_week' },
    { label: 'This Month', value: 'this_month' },
    { label: 'This Year', value: 'this_year' },
    { label: 'Custom', value: 'custom' },
];

const ReportsView: React.FC<ReportsViewProps> = ({ orders }) => {
    const { geminiAi, appData } = useContext(AppContext);
    const [activeTab, setActiveTab] = useState<ReportTab>('overview');
    
    const [filters, setFilters] = useState({
        datePreset: 'this_month' as DateRangePreset,
        startDate: '',
        endDate: '',
        team: '',
        user: '',
        paymentStatus: ''
    });

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState('');
    const [analysisError, setAnalysisError] = useState('');


    const handleDatePresetChange = (preset: DateRangePreset) => {
        if (preset === 'custom') {
            setFilters({ ...filters, datePreset: preset });
            return;
        }
        if (preset === 'all') {
            setFilters({ ...filters, datePreset: preset, startDate: '', endDate: '' });
            return;
        }

        const now = new Date();
        let start = new Date();
        let end = new Date();

        switch (preset) {
            case 'today':
                // start and end are already today's date
                break;
            case 'this_week':
                const dayOfWeek = now.getDay(); // 0 for Sunday
                start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
                end = new Date(start);
                end.setDate(start.getDate() + 6);
                break;
            case 'this_month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'this_year':
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31);
                break;
        }

        const toLocalYYYYMMDD = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        setFilters({
            ...filters,
            datePreset: preset,
            startDate: toLocalYYYYMMDD(start),
            endDate: toLocalYYYYMMDD(end)
        });
    };
    
    useEffect(() => {
        handleDatePresetChange('this_month');
    }, []);


    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            // Correctly parse the filter dates as local time to avoid timezone issues.
            // new Date('YYYY-MM-DD') is parsed as UTC midnight, which can cause orders on the start date to be excluded.
            // Appending 'T00:00:00' makes the parser treat it as a local date.
            const startDate = filters.startDate ? new Date(`${filters.startDate}T00:00:00`) : null;
            const endDate = filters.endDate ? new Date(`${filters.endDate}T23:59:59`) : null;

            const orderDate = new Date(order.Timestamp);
            
            const dateMatch = (!startDate || orderDate >= startDate) && (!endDate || orderDate <= endDate);
            const teamMatch = filters.team === '' || order.Team === filters.team;
            const userMatch = filters.user === '' || order.User === filters.user;
            const paymentMatch = filters.paymentStatus === '' || order['Payment Status'] === filters.paymentStatus;

            return dateMatch && teamMatch && userMatch && paymentMatch;
        });
    }, [orders, filters]);

    const reportData = useMemo(() => {
        const revenue = filteredOrders.reduce((sum, o) => sum + o['Grand Total'], 0);
        const totalProductCost = filteredOrders.reduce((sum, o) => sum + (o['Total Product Cost ($)'] || 0), 0);
        const totalInternalCost = filteredOrders.reduce((sum, o) => sum + o['Internal Cost'], 0);
        const profit = revenue - totalProductCost - totalInternalCost;
        const totalOrders = filteredOrders.length;
        const aov = totalOrders > 0 ? revenue / totalOrders : 0;
        const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

        const aggregateBy = (key: keyof ParsedOrder) => {
             const results = filteredOrders.reduce((acc, order) => {
                const groupKey = String(order[key] || 'N/A');
                if (!acc[groupKey]) {
                    acc[groupKey] = { revenue: 0, orders: 0, profit: 0, units: 0 };
                }
                acc[groupKey].revenue += order['Grand Total'];
                acc[groupKey].orders += 1;
                const orderProfit = order['Grand Total'] - (order['Total Product Cost ($)'] || 0) - (order['Internal Cost'] || 0);
                acc[groupKey].profit += orderProfit;
                acc[groupKey].units += order.Products.reduce((sum, p) => sum + p.quantity, 0);
                return acc;
            }, {} as Record<string, any>);
            return Object.entries(results).map(([label, values]) => ({ label, ...values })).sort((a,b) => b.revenue - a.revenue);
        };
        
        const productsAggregated = filteredOrders
            .flatMap(o => o.Products.map(p => ({ ...p, team: o.Team })))
            .reduce((acc, product) => {
                if (!acc[product.name]) {
                    acc[product.name] = { units: 0, revenue: 0 };
                }
                acc[product.name].units += product.quantity;
                acc[product.name].revenue += product.total;
                return acc;
            }, {} as Record<string, any>);

        return {
            revenue, profit, cost: totalInternalCost + totalProductCost, totalOrders, aov, profitMargin,
            byTeam: aggregateBy('Team'),
            byUser: aggregateBy('User'),
            byPage: aggregateBy('Page'),
            byLocation: aggregateBy('Location'),
            byProduct: Object.entries(productsAggregated).map(([label, values]) => ({ label, ...values })).sort((a,b) => b.revenue - a.revenue),
        };
    }, [filteredOrders]);

    const dailyRevenueData = useMemo(() => {
        if (filteredOrders.length === 0) return [];
        const dailyData = filteredOrders.reduce((acc, order) => {
            const date = new Date(order.Timestamp).toISOString().split('T')[0];
            if (!acc[date]) acc[date] = 0;
            acc[date] += order['Grand Total'];
            return acc;
        }, {} as Record<string, number>);
        
        return Object.entries(dailyData)
            .map(([date, revenue]) => ({ label: date.split('-').slice(1).join('/'), value: revenue }))
            .sort((a, b) => {
                const [aMonth, aDay] = a.label.split('/').map(Number);
                const [bMonth, bDay] = b.label.split('/').map(Number);
                if (aMonth !== bMonth) return aMonth - bMonth;
                return aDay - bDay;
            });
    }, [filteredOrders]);


    const handleExport = () => {
        if (filteredOrders.length === 0) {
            alert("No data to export.");
            return;
        }
        const headers = ["Order ID", "Timestamp", "User", "Team", "Page", "Customer Name", "Customer Phone", "Location", "Products", "Subtotal", "Shipping Fee", "Grand Total", "Internal Cost", "Total Product Cost", "Profit", "Payment Status"];
        const rows = filteredOrders.map(o => [
            o['Order ID'],
            o.Timestamp,
            o.User,
            o.Team,
            o.Page,
            o['Customer Name'],
            o['Customer Phone'],
            o.Location,
            o.Products.map(p => `${p.quantity}x ${p.name}`).join('; '),
            o.Subtotal,
            o['Shipping Fee (Customer)'],
            o['Grand Total'],
            o['Internal Cost'],
            o['Total Product Cost ($)'],
            o['Grand Total'] - (o['Internal Cost'] || 0) - (o['Total Product Cost ($)'] || 0),
            o['Payment Status']
        ].map(val => `"${String(val).replace(/"/g, '""')}"`)); // Quote all fields and escape quotes

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `sales_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleAnalyze = async () => {
        if (!geminiAi) {
            setAnalysisError("Gemini AI is not configured.");
            return;
        }
        setIsAnalyzing(true);
        setAnalysisResult('');
        setAnalysisError('');
        try {
            const result = await analyzeReportData(geminiAi, reportData, filters);
            setAnalysisResult(result);
        } catch (error) {
            console.error("Gemini analysis failed:", error);
            setAnalysisError("An error occurred while generating the analysis.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const renderTabs = () => (
        <div className="report-tabs">
            {(['overview', 'performance', 'profitability'] as ReportTab[]).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`report-tab ${activeTab === tab ? 'active' : ''}`}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
            ))}
        </div>
    );
    
    const renderFilters = () => (
         <div className="report-filters">
            <select className="form-select" value={filters.datePreset} onChange={e => handleDatePresetChange(e.target.value as DateRangePreset)}>
                {datePresets.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            {filters.datePreset === 'custom' && (
                <>
                    <input type="date" className="form-input" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} />
                    <input type="date" className="form-input" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} />
                </>
            )}
             <select className="form-select" value={filters.team} onChange={e => setFilters({...filters, team: e.target.value})}>
                <option value="">All Teams</option>
                {Array.from(new Set(appData.pages?.map((p: any) => p.Team))).map((t: any) => <option key={t} value={t}>{t}</option>)}
             </select>
              <select className="form-select" value={filters.user} onChange={e => setFilters({...filters, user: e.target.value})}>
                <option value="">All Users</option>
                {appData.users?.map((u: User) => <option key={u.UserName} value={u.UserName}>{u.FullName}</option>)}
             </select>
             <select className="form-select" value={filters.paymentStatus} onChange={e => setFilters({...filters, paymentStatus: e.target.value})}>
                <option value="">All Payment Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
             </select>
             <button onClick={handleExport} className="btn btn-secondary">Export to CSV</button>
         </div>
    );

    const OverviewTab = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Revenue" value={`$${reportData.revenue.toFixed(2)}`} />
                <StatCard title="Total Orders" value={reportData.totalOrders.toString()} />
                <StatCard title="Average Order Value" value={`$${reportData.aov.toFixed(2)}`} />
                <StatCard title="Net Profit" value={`$${reportData.profit.toFixed(2)}`} />
            </div>
            <div className="page-card">
                 <SimpleBarChart data={dailyRevenueData} title="Daily Revenue" />
            </div>
            <div className="page-card">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">AI-Powered Insights</h3>
                    <GeminiButton onClick={handleAnalyze} isLoading={isAnalyzing} disabled={!geminiAi || filteredOrders.length === 0}>
                        Analyze with Gemini
                    </GeminiButton>
                </div>
                <p className="text-sm text-gray-400 mb-4">Gemini will analyze the data within the selected filters to provide key insights.</p>
                {isAnalyzing && <div className="flex justify-center p-8"><Spinner /></div>}
                {analysisError && <p className="text-red-400">{analysisError}</p>}
                {analysisResult && (
                     <div
                        className="gemini-analysis prose prose-invert max-w-none prose-p:text-gray-300 prose-li:text-gray-300"
                        dangerouslySetInnerHTML={{ __html: analysisResult.replace(/\n/g, '<br />') }}
                    />
                )}
            </div>
        </div>
    );

    const PerformanceTab = () => (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="page-card">
                 <SimpleBarChart data={reportData.byProduct.slice(0, 10).map(p => ({label: p.label, value: p.revenue}))} title="Top 10 Products by Revenue" />
            </div>
             <div className="page-card">
                <SimpleBarChart data={reportData.byPage.map(p => ({label: p.label, value: p.revenue}))} title="Revenue by Page" />
            </div>
            <DataTable className="lg:col-span-2" title="By Product" data={reportData.byProduct} columns={['Product', 'Units Sold', 'Revenue']} customMapping={{'Product': 'label', 'Units Sold': 'units'}} />
            <DataTable className="lg:col-span-2" title="By User" data={reportData.byUser} columns={['User', 'Revenue', 'Orders', 'Profit']} customMapping={{'User': 'label'}} />
        </div>
    );
    
    const ProfitabilityTab = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Revenue" value={`$${reportData.revenue.toFixed(2)}`} />
                <StatCard title="Total Cost" value={`$${reportData.cost.toFixed(2)}`} />
                <StatCard title="Net Profit" value={`$${reportData.profit.toFixed(2)}`} />
                <StatCard title="Profit Margin" value={`${reportData.profitMargin.toFixed(2)}%`} />
            </div>
            <div className="page-card">
                 <SimpleBarChart data={reportData.byTeam.map(p => ({label: p.label, value: p.profit}))} title="Net Profit by Team" />
            </div>
            <DataTable title="Profit by Team" data={reportData.byTeam} columns={['Team', 'Revenue', 'Profit', 'Orders']} customMapping={{'Team': 'label'}} />
        </div>
    );
    

    return (
        <div className="w-full">
            {renderTabs()}
            {renderFilters()}
            <div className="mt-6">
                {activeTab === 'overview' && <OverviewTab />}
                {activeTab === 'performance' && <PerformanceTab />}
                {activeTab === 'profitability' && <ProfitabilityTab />}
            </div>
        </div>
    );
};

// Helper Components
const StatCard = ({ title, value }: { title: string, value: string }) => (
    <div className="stat-card">
        <p className="stat-card-title">{title}</p>
        <p className="stat-card-value">{value}</p>
    </div>
);

const DataTable = ({ title, data, columns, customMapping, className = '' }: { title: string, data: any[], columns: string[], customMapping?: any, className?: string }) => (
    <div className={`page-card ${className}`}>
        <h3 className="text-lg font-bold mb-4 text-white">{title}</h3>
        <div className="overflow-x-auto max-h-96">
            <table className="report-table">
                <thead>
                    <tr>{columns.map(c => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                    {data.length > 0 ? data.map((row, index) => (
                        <tr key={index}>
                            {columns.map(col => {
                                const key = (customMapping && col in customMapping) ? customMapping[col] : col.toLowerCase();
                                let value = row[key];
                                if (typeof value === 'number') {
                                    value = (key.includes('revenue') || key.includes('profit'))
                                        ? `$${value.toFixed(2)}` 
                                        : value;
                                }
                                return <td key={col}>{value}</td>
                            })}
                        </tr>
                    )) : (
                        <tr><td colSpan={columns.length} className="text-center text-gray-500 py-4">No data</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
);


export default ReportsView;