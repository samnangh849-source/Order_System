import React, { useState, useMemo } from 'react';
import { ParsedOrder, User, Target } from '../types';
import { usePerformanceData } from '../hooks/usePerformanceData';
import GaugeChart from '../components/common/GaugeChart';
import SimpleLineChart from '../components/common/SimpleLineChart';

interface PerformanceTrackingPageProps {
    orders: ParsedOrder[];
    users: User[];
    targets: Target[];
}

type PerformanceTab = 'overview' | 'leaderboard' | 'targets';
type DateRangePreset = 'this_month' | 'last_month' | 'quarter' | 'year' | 'all';
type LeaderboardMetric = 'revenue' | 'orderCount' | 'achievement';

const StatCard: React.FC<{ label: string; value: string | number; }> = ({ label, value }) => (
    <div className="performance-card">
        <p className="performance-label">{label}</p>
        <p className="performance-value">
            {typeof value === 'number' ? (label.toLowerCase().includes('revenue') || label.toLowerCase().includes('profit') ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : value.toLocaleString()) : value}
        </p>
    </div>
);

const IndividualPerformanceModal: React.FC<{ user: any; monthlyData: any[]; onClose: () => void; }> = ({ user, monthlyData, onClose }) => {
    const userMonthlyData = monthlyData.filter(d => d.user === user.userName);
    return (
        <div className="performance-modal-backdrop" onClick={onClose}>
            <div className="page-card w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold">{user.fullName}</h2>
                        <p className="text-gray-400">@{user.userName}</p>
                    </div>
                     <button onClick={onClose} className="text-2xl text-gray-500 hover:text-white">&times;</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <StatCard label="Total Revenue" value={user.revenue} />
                    <StatCard label="Total Profit" value={user.profit} />
                    <StatCard label="Total Orders" value={user.orderCount} />
                    <StatCard label="Achievement" value={`${user.achievement.toFixed(1)}%`} />
                </div>
                <div className="mt-6">
                    <SimpleLineChart
                        data={userMonthlyData.length > 0 ? userMonthlyData : []}
                        title="Monthly Sales Trend"
                    />
                </div>
            </div>
        </div>
    );
};


const PerformanceTrackingPage: React.FC<PerformanceTrackingPageProps> = ({ orders, users, targets }) => {
    const [activeTab, setActiveTab] = useState<PerformanceTab>('overview');
    const [filters, setFilters] = useState({
        datePreset: 'this_month' as DateRangePreset,
        team: '',
        user: '',
    });
    const [leaderboardMetric, setLeaderboardMetric] = useState<LeaderboardMetric>('revenue');
    const [selectedUser, setSelectedUser] = useState<any | null>(null);

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
            const orderDate = new Date(order.Timestamp);
            const dateMatch = (!startDate || orderDate >= startDate) && (!endDate || orderDate <= endDate);
            const userMatch = !filters.user || order.User === filters.user;
            const teamMatch = !filters.team || order.Team === filters.team;
            return dateMatch && userMatch && teamMatch;
        });
    }, [orders, filters]);

    const performanceData = usePerformanceData(filteredOrders, users, targets);
    
    const individualMonthlyData = useMemo(() => {
        if (!performanceData) return [];
        return filteredOrders.reduce((acc, order) => {
             const month = new Date(order.Timestamp).toISOString().slice(0, 7);
             const key = `${order.User}-${month}`;
             if (!acc[key]) {
                 acc[key] = { label: month, value: 0, user: order.User };
             }
             acc[key].value += order['Grand Total'];
             return acc;
        }, {} as Record<string, {label: string; value: number; user: string}>);
    }, [filteredOrders, performanceData]);

    const sortedLeaderboard = useMemo(() => {
        if (!performanceData) return [];
        return [...performanceData.byUser].sort((a, b) => b[leaderboardMetric] - a[leaderboardMetric]);
    }, [performanceData, leaderboardMetric]);

    const renderTabs = () => (
        <div className="report-tabs">
            {(['overview', 'leaderboard', 'targets'] as PerformanceTab[]).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`report-tab ${activeTab === tab ? 'active' : ''}`}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
            ))}
        </div>
    );

    const renderFilters = () => (
        <div className="report-filters">
            <select className="form-select" value={filters.datePreset} onChange={e => setFilters({...filters, datePreset: e.target.value as DateRangePreset})}>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
                <option value="all">All Time</option>
            </select>
            <select className="form-select" value={filters.team} onChange={e => setFilters({...filters, team: e.target.value})}>
                <option value="">All Teams</option>
                {Array.from(new Set(users.map(u => u.Team))).filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
             <select className="form-select" value={filters.user} onChange={e => setFilters({...filters, user: e.target.value})}>
                <option value="">All Users</option>
                {users.map(u => <option key={u.UserName} value={u.UserName}>{u.FullName}</option>)}
            </select>
        </div>
    );
    
    if (!performanceData) {
        return <div className="text-center p-8">Loading performance data...</div>;
    }

    const { summary, byUser, byTeam, monthlyTrend } = performanceData;

    return (
        <div className="w-full">
            {renderTabs()}
            {renderFilters()}

            {activeTab === 'overview' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard label="Total Revenue" value={summary.totalRevenue} />
                        <StatCard label="Total Profit" value={summary.totalProfit} />
                        <StatCard label="Total Orders" value={summary.totalOrders} />
                        <StatCard label="Target" value={summary.overallTarget > 0 ? `$${summary.overallTarget.toLocaleString()}` : 'N/A'} />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="page-card lg:col-span-2">
                           <SimpleLineChart data={monthlyTrend} title="Monthly Revenue Trend" />
                        </div>
                        <div className="page-card flex flex-col justify-center items-center">
                            <h3 className="text-lg font-bold mb-4 text-white text-center">Target Achievement</h3>
                            <div className="gauge-chart-container">
                                <GaugeChart value={summary.overallAchievement} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'leaderboard' && (
                <div className="page-card">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold">Leaderboard</h3>
                        <div className="flex items-center space-x-2">
                            <label className="text-sm">Rank by:</label>
                            <select value={leaderboardMetric} onChange={e => setLeaderboardMetric(e.target.value as LeaderboardMetric)} className="form-select !w-auto !py-1">
                                <option value="revenue">Revenue</option>
                                <option value="orderCount">Orders</option>
                                <option value="achievement">Achievement %</option>
                            </select>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="admin-table w-full leaderboard-table">
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Salesperson</th>
                                    <th>Revenue</th>
                                    <th>Orders</th>
                                    <th>Target</th>
                                    <th>Achievement</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedLeaderboard.map((user, index) => (
                                    <tr key={user.userName} onClick={() => setSelectedUser(user)}>
                                        <td>{index + 1}</td>
                                        <td>{user.fullName}</td>
                                        <td>${user.revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                        <td>{user.orderCount}</td>
                                        <td>{user.target > 0 ? `$${user.target.toLocaleString()}` : 'N/A'}</td>
                                        <td>
                                            <div className="flex items-center">
                                                <div className="w-20 mr-2">
                                                    <div className="progress-bar-bg">
                                                        <div className="progress-bar-fill-perf" style={{ width: `${Math.min(user.achievement, 100)}%` }}></div>
                                                    </div>
                                                </div>
                                                {user.achievement.toFixed(1)}%
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'targets' && (
                <div className="page-card">
                     <h3 className="text-xl font-bold mb-4">Target Management</h3>
                     <p className="text-sm text-gray-400 mb-4">Note: Setting and editing targets is a future feature and requires backend implementation. This view shows current performance against pre-set targets.</p>
                     <div className="overflow-x-auto">
                         <table className="admin-table w-full">
                            <thead>
                                <tr>
                                    <th>Salesperson</th>
                                    <th>Target</th>
                                    <th>Actual Revenue</th>
                                    <th>Progress</th>
                                </tr>
                            </thead>
                             <tbody>
                                 {byUser.map(user => (
                                     <tr key={user.userName}>
                                         <td>{user.fullName}</td>
                                         <td>{user.target > 0 ? `$${user.target.toLocaleString()}` : 'N/A'}</td>
                                         <td>${user.revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                         <td>
                                            {user.target > 0 ? (
                                                <div className="flex items-center">
                                                    <div className="w-full mr-2">
                                                        <div className="progress-bar-bg">
                                                            <div className="progress-bar-fill-perf" style={{ width: `${Math.min(user.achievement, 100)}%` }}></div>
                                                        </div>
                                                    </div>
                                                    <span>{user.achievement.toFixed(1)}%</span>
                                                </div>
                                            ) : 'N/A'}
                                         </td>
                                     </tr>
                                 ))}
                             </tbody>
                         </table>
                     </div>
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
