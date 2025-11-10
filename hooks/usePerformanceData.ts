import { useMemo } from 'react';
import { ParsedOrder, User, Target } from '../types';

// --- MOCK DATA ---
// In a real application, this would come from the API (appData.targets)
const mockTargets: Target[] = [
    { UserName: 'Sok', Month: '2024-07', TargetAmount: 12000 },
    { UserName: 'Sao', Month: '2024-07', TargetAmount: 15000 },
    { UserName: 'Admin', Month: '2024-07', TargetAmount: 20000 },
    { UserName: 'Sok', Month: '2024-06', TargetAmount: 11000 },
    { UserName: 'Sao', Month: '2024-06', TargetAmount: 14000 },
    { UserName: 'Admin', Month: '2024-06', TargetAmount: 18000 },
];
// --- END MOCK DATA ---

const calculateProfit = (order: ParsedOrder): number => {
    const revenue = order['Grand Total'] || 0;
    const productCost = order['Total Product Cost ($)'] || 0;
    const shippingCost = order['Internal Cost'] || 0;
    return revenue - productCost - shippingCost;
};

export const usePerformanceData = (
    orders: ParsedOrder[],
    users: User[],
    targets: Target[] // Can be from props or mock
) => {
    const performanceData = useMemo(() => {
        if (!orders || !users) {
            return null;
        }

        const actualTargets = (targets && targets.length > 0) ? targets : mockTargets;

        // Overall Summary
        const totalRevenue = orders.reduce((sum, o) => sum + o['Grand Total'], 0);
        const totalProfit = orders.reduce((sum, o) => sum + calculateProfit(o), 0);
        const totalOrders = orders.length;

        const byUser = users.map(user => {
            const userOrders = orders.filter(o => o.User === user.UserName);
            const revenue = userOrders.reduce((sum, o) => sum + o['Grand Total'], 0);
            const profit = userOrders.reduce((sum, o) => sum + calculateProfit(o), 0);
            const orderCount = userOrders.length;
            
            // Find target for the latest month available in orders
            const latestOrderMonth = orders.length > 0 ? new Date(orders[0].Timestamp).toISOString().slice(0, 7) : new Date().toISOString().slice(0,7);
            const targetData = actualTargets.find(t => t.UserName === user.UserName && t.Month === latestOrderMonth);
            const targetAmount = targetData?.TargetAmount || 0;
            const achievement = targetAmount > 0 ? (revenue / targetAmount) * 100 : 0;

            return {
                userName: user.UserName,
                fullName: user.FullName,
                profilePictureURL: user.ProfilePictureURL,
                team: user.Team,
                revenue,
                profit,
                orderCount,
                target: targetAmount,
                achievement
            };
        });

        const byTeam = Array.from(new Set(users.map(u => u.Team).filter(Boolean)))
            .map(team => {
                const teamUsers = byUser.filter(u => u.team === team);
                const revenue = teamUsers.reduce((sum, u) => sum + u.revenue, 0);
                const profit = teamUsers.reduce((sum, u) => sum + u.profit, 0);
                const orderCount = teamUsers.reduce((sum, u) => sum + u.orderCount, 0);
                const target = teamUsers.reduce((sum, u) => sum + u.target, 0);
                const achievement = target > 0 ? (revenue / target) * 100 : 0;

                return {
                    teamName: team,
                    revenue,
                    profit,
                    orderCount,
                    target,
                    achievement
                };
            });

        const overallTarget = byTeam.reduce((sum, t) => sum + t.target, 0);
        const overallAchievement = overallTarget > 0 ? (totalRevenue / overallTarget) * 100 : 0;

        // Monthly Trend Data
        const monthlyTrend = orders.reduce((acc, order) => {
            const month = new Date(order.Timestamp).toISOString().slice(0, 7); // YYYY-MM
            if (!acc[month]) {
                acc[month] = { revenue: 0, profit: 0, orders: 0 };
            }
            acc[month].revenue += order['Grand Total'];
            acc[month].profit += calculateProfit(order);
            acc[month].orders += 1;
            return acc;
        }, {} as Record<string, { revenue: number, profit: number, orders: number }>);
        
        const sortedMonthlyTrend = Object.entries(monthlyTrend)
            .sort(([monthA], [monthB]) => monthA.localeCompare(monthB))
            .map(([month, data]) => ({
                label: month,
                value: data.revenue, // For chart component
                ...data
            }));

        return {
            summary: {
                totalRevenue,
                totalProfit,
                totalOrders,
                overallTarget,
                overallAchievement
            },
            byUser,
            byTeam,
            monthlyTrend: sortedMonthlyTrend,
        };

    }, [orders, users, targets]);

    return performanceData;
};
