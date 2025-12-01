import React, { useState, useMemo, useEffect } from 'react';
import { ParsedOrder, User, Target } from '../types';
import { usePerformanceData } from '../hooks/usePerformanceData';
import GaugeChart from '../components/common/GaugeChart';
import SimpleLineChart from '../components/common/SimpleLineChart';
import SimpleBarChart from '../components/admin/SimpleBarChart';
import UserAvatar from '../components/common/UserAvatar';
import { WEB_APP_URL } from '../constants';
import Spinner from '../components/common/Spinner';

interface PerformanceTrackingPageProps {
    orders: ParsedOrder[];
    users: User[];
    targets: Target[];
}

type PerformanceTab = 'overview' | 'leaderboard' | 'targets';
type DateRangePreset = 'this_month' | 'last_month' | 'quarter' | 'year' | 'all';
type LeaderboardMetric = 'revenue' | 'orderCount' | 'achievement';

// --- Reusable Stat Card Component ---
const StatCard = ({ title, value, subtext, icon, colorClass }: { title: string, value: string | number, subtext?: string, icon: React.ReactNode, colorClass: string }) => (
    <div className={`relative overflow-hidden rounded-2xl p-6 bg-gray-800 border border-gray-700/50 shadow-lg group hover:border-gray-600 transition-all`}>
        <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${colorClass}`}>
            {icon}
        </div>
        <div className="relative z-10">
            <p className="text-gray-400 text-sm font-medium uppercase tracking-wide mb-1">{title}</p>
            <h3 className="text-3xl font-bold text-white mb-1">{value}</h3>
            {subtext && <p className="text-xs text-gray-500">{subtext}</p>}
        </div>
    </div>
);

const IndividualPerformanceModal: React.FC<{ user: any; monthlyData: any[]; onClose: () => void; }> = ({ user, monthlyData, onClose }) => {
    const userMonthlyData = monthlyData.filter(d => d.user === user.userName);
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl p-6 shadow-2xl transform transition-all scale-100" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                        <UserAvatar 
                            name={user.fullName} 
                            avatarUrl={user.profilePictureURL} 
                            size="lg"
                            className="border-2 border-blue-500"
                        />
                        <div>
                            <h2 className="text-2xl font-bold text-white">{user.fullName}</h2>
                            <div className="flex items-center gap-2 text-gray-400 text-sm">
                                <span>@{user.userName}</span>
                                {user.team && <span className="px-2 py-0.5 bg-gray-800 rounded-full text-xs border border-gray-700">{user.team}</span>}
                            </div>
                        </div>
                    </div>
                     <button onClick={onClose} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                     </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 text-center">
                        <p className="text-xs text-gray-400 uppercase">Revenue</p>
                        <p className="text-xl font-bold text-white">${user.revenue.toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 text-center">
                        <p className="text-xs text-gray-400 uppercase">Profit</p>
                        <p className="text-xl font-bold text-green-400">${user.profit.toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 text-center">
                        <p className="text-xs text-gray-400 uppercase">Orders</p>
                        <p className="text-xl font-bold text-blue-400">{user.orderCount}</p>
                    </div>
                    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 text-center">
                        <p className="text-xs text-gray-400 uppercase">Achievement</p>
                        <p className="text-xl font-bold text-yellow-400">{user.achievement.toFixed(1)}%</p>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <SimpleLineChart
                        data={userMonthlyData.length > 0 ? userMonthlyData : []}
                        title="Monthly Sales Trend"
                    />
                </div>
            </div>
        </div>
    );
};


const PerformanceTrackingPage: React.FC<PerformanceTrackingPageProps> = ({ orders: propOrders, users, targets }) => {
    const [activeTab, setActiveTab] = useState<PerformanceTab>('overview');
    const [orders, setOrders] = useState<ParsedOrder[]>(propOrders);
    const [loading, setLoading] = useState(true);
    
    // --- Filters State ---
    const [filters, setFilters] = useState({
        datePreset: 'this_month' as DateRangePreset,
        team: '',
        user: '',
    });
    
    const [leaderboardMetric, setLeaderboardMetric] = useState<LeaderboardMetric>('revenue');
    const [selectedUser, setSelectedUser] = useState<any | null>(null);

    // --- Fetch Orders if not provided (Standalone mode support) ---
    useEffect(() => {
        if (propOrders && propOrders.length > 0) {
            setOrders(propOrders);
            setLoading(false);
        } else {
            const fetchOrders = async () => {
                try {
                    const response = await fetch(`${WEB_APP_URL}/api/admin/all-orders`);
                    if (response.ok) {
                        const result = await response.json();
                        if (result.status === 'success') {
                             const rawOrders: any[] = Array.isArray(result.data) ? result.data.filter((o: any) => o !== null) : [];
                             // Minimal parsing for performance
                             setOrders(rawOrders as any);
                        }
                    }
                } catch (e) {
                    console.error("Failed to fetch orders for performance", e);
                } finally {
                    setLoading(false);
                }
            }
            fetchOrders();
        }
    }, [propOrders]);

    // --- Filtering Logic ---
    const filteredOrders = useMemo(() => {
        const now = new Date();
        let startDate: Date | null = null;
        let endDate: Date | null = new Date();

        switch (filters.datePreset) {
            case 'this_month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'last_month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'quarter':
                const quarter = Math.floor(now.getMonth() / 3);
                startDate = new Date(now.getFullYear(), quarter * 3, 1);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            case 'all':
                startDate = null;
                endDate = null;
                break;
        }

        if (startDate) startDate.setHours(0, 0, 0, 0);
        if (endDate) endDate.setHours(23, 59, 59, 999);
        
        return orders.filter(order => {
            if (!order.Timestamp) return false;
            const orderDate = new Date(order.Timestamp);
            const dateMatch = (!startDate || orderDate >= startDate) && (!endDate || orderDate <= endDate);
            
            // Loose matching for filters
            const userMatch = !filters.user || (order.User && order.User === filters.user);
            
            // Team Logic: if order has no team, try to infer or skip
            let orderTeam = order.Team; 
            if (!orderTeam && order.User) {
                 const u = users.find(usr => usr.UserName === order.User);
                 if (u && u.Team) orderTeam = u.Team.split(',')[0].trim();
            }
            const teamMatch = !filters.team || (orderTeam && orderTeam === filters.team);

            return dateMatch && userMatch && teamMatch;
        });
    }, [orders, filters, users]);

    const performanceData = usePerformanceData(filteredOrders, users, targets);
    
    // Process data for charts
    const individualMonthlyData = useMemo(() => {
        if (!performanceData) return [];
        return filteredOrders.reduce((acc, order) => {
             const month = new Date(order.Timestamp).toISOString().slice(0, 7);
             const key = `${order.User}-${month}`;
             if (!acc[key]) {
                 acc[key] = { label: month, value: 0, user: order.User };
             }
             acc[key].value += (Number(order['Grand Total']) || 0);
             return acc;
        }, {} as Record<string, {label: string; value: number; user: string}>);
    }, [filteredOrders, performanceData]);

    const sortedLeaderboard = useMemo(() => {
        if (!performanceData) return [];
        return [...performanceData.byUser].sort((a, b) => b[leaderboardMetric] - a[leaderboardMetric]);
    }, [performanceData, leaderboardMetric]);

    const teamComparisonData = useMemo(() => {
        if (!performanceData) return [];
        return performanceData.byTeam.map(t => ({
            label: t.teamName,
            value: t.revenue
        })).sort((a,b) => b.value - a.value);
    }, [performanceData]);


    if (loading || !performanceData) {
        return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
    }

    const { summary, monthlyTrend } = performanceData;

    // --- Render Helpers ---
    
    const renderFilters = () => (
        <div className="flex flex-wrap gap-3 mb-6 bg-gray-800/50 p-3 rounded-xl border border-gray-700/50">
            <select 
                className="form-select !py-2 !text-sm !w-auto bg-gray-700 border-gray-600 focus:ring-blue-500" 
                value={filters.datePreset} 
                onChange={e => setFilters({...filters, datePreset: e.target.value as DateRangePreset})}
            >
                <option value="this_month">ខែនេះ (This Month)</option>
                <option value="last_month">ខែមុន (Last Month)</option>
                <option value="quarter">ត្រីមាសនេះ (This Quarter)</option>
                <option value="year">ឆ្នាំនេះ (This Year)</option>
                <option value="all">ទាំងអស់ (All Time)</option>
            </select>
            
            <select 
                className="form-select !py-2 !text-sm !w-auto bg-gray-700 border-gray-600 focus:ring-blue-500" 
                value={filters.team} 
                onChange={e => setFilters({...filters, team: e.target.value})}
            >
                <option value="">ក្រុមទាំងអស់ (All Teams)</option>
                {Array.from(new Set(users.map(u => u.Team))).filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            
             <select 
                className="form-select !py-2 !text-sm !w-auto bg-gray-700 border-gray-600 focus:ring-blue-500" 
                value={filters.user} 
                onChange={e => setFilters({...filters, user: e.target.value})}
            >
                <option value="">បុគ្គលិកទាំងអស់ (All Users)</option>
                {users.map(u => <option key={u.UserName} value={u.UserName}>{u.FullName}</option>)}
            </select>
        </div>
    );

    return (
        <div className="w-full animate-fade-in">
            <style>{`
                .medal-icon { filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5)); }
            `}</style>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">សមិទ្ធផល & គោលដៅ</h1>
                    <p className="text-gray-400 text-sm">តាមដានការលក់ និងវឌ្ឍនភាពក្រុមការងារ</p>
                </div>
                
                {/* Tabs */}
                <div className="flex bg-gray-800 p-1 rounded-lg border border-gray-700 mt-4 md:mt-0">
                    {(['overview', 'leaderboard', 'targets'] as PerformanceTab[]).map(tab => (
                        <button 
                            key={tab} 
                            onClick={() => setActiveTab(tab)} 
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {renderFilters()}

            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* Top Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard 
                            title="ចំណូលសរុប (Revenue)" 
                            value={`$${summary.totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}`} 
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>}
                            colorClass="text-green-500"
                        />
                        <StatCard 
                            title="ប្រាក់ចំណេញ (Profit)" 
                            value={`$${summary.totalProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}`} 
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                            colorClass="text-blue-500"
                        />
                        <StatCard 
                            title="ការកម្មង់ (Orders)" 
                            value={summary.totalOrders} 
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>}
                            colorClass="text-purple-500"
                        />
                        <StatCard 
                            title="សម្រេចគោលដៅ (Avg)" 
                            value={`${summary.overallAchievement.toFixed(1)}%`} 
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                            colorClass="text-yellow-500"
                        />
                    </div>

                    {/* Charts Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="page-card lg:col-span-2 !p-4 !bg-gray-800/80">
                           <SimpleLineChart data={monthlyTrend} title="និន្នាការលក់ប្រចាំខែ (Monthly Trend)" />
                        </div>
                        <div className="page-card flex flex-col justify-between !bg-gray-800/80">
                            <div className="h-full">
                                <SimpleBarChart data={teamComparisonData} title="ប្រៀបធៀបតាមក្រុម (By Team)" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'leaderboard' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-gray-800 p-4 rounded-xl border border-gray-700">
                        <h3 className="text-lg font-bold text-white">តារាងចំណាត់ថ្នាក់ (Top Performers)</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400 hidden sm:inline">Rank by:</span>
                            <select 
                                value={leaderboardMetric} 
                                onChange={e => setLeaderboardMetric(e.target.value as LeaderboardMetric)} 
                                className="form-select !py-1 !text-sm !w-auto bg-gray-700 border-gray-600"
                            >
                                <option value="revenue">Revenue ($)</option>
                                <option value="orderCount">Orders (Qty)</option>
                                <option value="achievement">Achievement (%)</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-400">
                                <thead className="bg-gray-900 text-gray-200 font-medium uppercase text-xs">
                                    <tr>
                                        <th className="px-6 py-4 w-16 text-center">#</th>
                                        <th className="px-6 py-4">Agent</th>
                                        <th className="px-6 py-4">Team</th>
                                        <th className="px-6 py-4 text-right">Revenue</th>
                                        <th className="px-6 py-4 text-center">Orders</th>
                                        <th className="px-6 py-4 text-center w-32">Target</th>
                                        <th className="px-6 py-4 text-center w-48">Achievement</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {sortedLeaderboard.map((user, index) => {
                                        let rankIcon = null;
                                        if (index === 0) rankIcon = <span className="text-2xl medal-icon">🥇</span>;
                                        else if (index === 1) rankIcon = <span className="text-2xl medal-icon">🥈</span>;
                                        else if (index === 2) rankIcon = <span className="text-2xl medal-icon">🥉</span>;
                                        else rankIcon = <span className="font-bold text-gray-500">#{index + 1}</span>;

                                        return (
                                            <tr 
                                                key={user.userName} 
                                                onClick={() => setSelectedUser(user)}
                                                className="hover:bg-gray-700/50 cursor-pointer transition-colors group"
                                            >
                                                <td className="px-6 py-4 text-center">{rankIcon}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <UserAvatar name={user.fullName} avatarUrl={user.profilePictureURL} size="md" />
                                                        <div>
                                                            <p className="font-semibold text-white group-hover:text-blue-400 transition-colors">{user.fullName}</p>
                                                            <p className="text-xs">@{user.userName}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">{user.team || 'N/A'}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono text-white font-medium">
                                                    ${user.revenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                                </td>
                                                <td className="px-6 py-4 text-center font-mono">{user.orderCount}</td>
                                                <td className="px-6 py-4 text-center text-xs">
                                                    {user.target > 0 ? `$${user.target.toLocaleString()}` : '-'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {user.target > 0 ? (
                                                        <div className="w-full">
                                                            <div className="flex justify-between text-xs mb-1">
                                                                <span className={user.achievement >= 100 ? 'text-green-400 font-bold' : 'text-gray-400'}>{user.achievement.toFixed(1)}%</span>
                                                            </div>
                                                            <div className="w-full bg-gray-700 rounded-full h-2">
                                                                <div 
                                                                    className={`h-2 rounded-full transition-all duration-500 ${user.achievement >= 100 ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-blue-500'}`} 
                                                                    style={{ width: `${Math.min(user.achievement, 100)}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-600 text-xs italic">No Target</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'targets' && (
                <div className="page-card !p-8 flex flex-col items-center justify-center text-center min-h-[400px]">
                     <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4 border border-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                     </div>
                     <h3 className="text-2xl font-bold text-white mb-2">ការកំណត់គោលដៅ (Target Management)</h3>
                     <p className="text-gray-400 max-w-md mb-6">មុខងារកំណត់គោលដៅសម្រាប់បុគ្គលិកម្នាក់ៗ កំពុងស្ថិតក្នុងការអភិវឌ្ឍ។ <br/>នៅពេលខាងមុខ អ្នកនឹងអាចកំណត់ Target ប្រចាំខែនៅទីនេះបាន។</p>
                     <div className="w-full max-w-md bg-gray-800 rounded-full h-4 overflow-hidden">
                        <div className="bg-blue-600 h-full w-2/3 animate-pulse"></div>
                     </div>
                     <p className="text-xs text-blue-400 mt-2 font-mono">Coming Soon...</p>
                </div>
            )}
            
            {selectedUser && (
                <IndividualPerformanceModal 
                    user={selectedUser} 
                    monthlyData={Object.values(individualMonthlyData)}
                    onClose={() => setSelectedUser(null)} 
                />
            )}
        </div>
    );
};

export default PerformanceTrackingPage;