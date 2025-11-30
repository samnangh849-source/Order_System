
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { AppContext } from '../App';
import { ParsedOrder, FullOrder } from '../types';
import { WEB_APP_URL } from '../constants';
import Spinner from '../components/common/Spinner';
import OrdersList from '../components/orders/OrdersList';
import CreateOrderPage from './CreateOrderPage';
import { useUrlState } from '../hooks/useUrlState';

const UserOrdersView: React.FC<{ team: string }> = ({ team }) => {
    const [orders, setOrders] = useState<ParsedOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchOrders = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await fetch(`${WEB_APP_URL}/api/admin/all-orders`);
                if (!response.ok) {
                    const errorText = await response.text();
                    let errorMessage;
                    try {
                        const errorJson = JSON.parse(errorText);
                        errorMessage = errorJson.message || errorText;
                    } catch (e) {
                        errorMessage = errorText || `Server responded with status ${response.status}`;
                    }
                    throw new Error(errorMessage);
                }

                const result = await response.json();
                if (result.status !== 'success') {
                    throw new Error(result.message || 'Error in API response for orders.');
                }
                
                const allOrders: FullOrder[] = result.data;
                const teamOrders = allOrders.filter(o => o.Team === team);

                const parsed = teamOrders.map(o => {
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
                setOrders(parsed);
            } catch (err: any) {
                setError(`Could not load team orders: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, [team]);
    
    const filteredOrders = useMemo(() => {
        if (!searchQuery.trim()) return orders;
        const lowerQuery = searchQuery.toLowerCase().trim();
        return orders.filter(o => 
            o['Order ID'].toLowerCase().includes(lowerQuery) ||
            o['Customer Name'].toLowerCase().includes(lowerQuery) ||
            o['Customer Phone'].includes(lowerQuery) ||
            (o.User && o.User.toLowerCase().includes(lowerQuery)) ||
            (o.Products && o.Products.some(p => p.name.toLowerCase().includes(lowerQuery)))
        );
    }, [orders, searchQuery]);

    if (loading) return <div className="flex justify-center items-center h-64"><Spinner size="lg"/></div>;
    if (error) return <p className="text-center text-red-400 p-8">{error}</p>;

    if (orders.length === 0 && !loading) {
        return (
            <div className="text-center p-8 page-card">
                <h3 className="text-xl font-semibold text-white">មិនមានប្រតិបត្តិការណ៍</h3>
                <p className="text-gray-400 mt-2">រកមិនឃើញការកម្មង់សម្រាប់ក្រុម {team} ទេ។</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="relative max-w-md">
                <input
                    type="text"
                    placeholder="ស្វែងរក (Order ID, ឈ្មោះ, លេខទូរស័ព្ទ)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="form-input !pl-10"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
            <OrdersList orders={filteredOrders} showActions={false} />
        </div>
    );
};

const UserJourney: React.FC = () => {
    const { currentUser, appData } = useContext(AppContext);
    // Use useUrlState for view ('list' | 'create') to enable browser back button
    const [view, setView] = useUrlState<'list' | 'create'>('action', 'list');
    const [selectedTeam, setSelectedTeam] = useState<string>('');

    const userTeams = useMemo(() => {
        if (!currentUser?.Team) return [];
        return currentUser.Team.split(',').map(t => t.trim()).filter(Boolean);
    }, [currentUser]);

    useEffect(() => {
        if (userTeams.length > 0 && !selectedTeam) {
            setSelectedTeam(userTeams[0]);
        }
    }, [userTeams]);

    if (!selectedTeam) return <div className="p-4 text-center">No team assigned.</div>;

    if (view === 'create') {
        return <CreateOrderPage team={selectedTeam} onSaveSuccess={() => setView('list')} onCancel={() => setView('list')} />;
    }

    return (
        <div className="w-full max-w-4xl mx-auto p-2 sm:p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white">ការកម្មង់របស់ខ្ញុំ ({selectedTeam})</h1>
                {userTeams.length > 1 && (
                    <select 
                        value={selectedTeam} 
                        onChange={(e) => setSelectedTeam(e.target.value)}
                        className="form-select !w-auto ml-2"
                    >
                        {userTeams.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                )}
                <button onClick={() => setView('create')} className="btn btn-primary">
                    បង្កើតការកម្មង់
                </button>
            </div>
            <UserOrdersView team={selectedTeam} />
        </div>
    );
};

export default UserJourney;
