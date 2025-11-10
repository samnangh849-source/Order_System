import React, { useState, useContext, useEffect, useMemo } from 'react';
import { AppContext } from '../App';
import { FullOrder, ParsedOrder } from '../types';
import OrdersList from '../components/orders/OrdersList';
import Spinner from '../components/common/Spinner';
import CreateOrderPage from './CreateOrderPage';
import { WEB_APP_URL } from '../constants';

interface UserJourneyProps {
   onBackToRoleSelect: () => void;
}

const UserOrdersView: React.FC<{ team: string }> = ({ team }) => {
    const [orders, setOrders] = useState<ParsedOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchOrders = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await fetch(`${WEB_APP_URL}/api/admin/all-orders`);
                if (!response.ok) {
                    const errorData = await response.json().catch(() => null);
                    const message = errorData?.message || `Server responded with status ${response.status}`;
                    throw new Error(message);
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

    return <OrdersList orders={orders} showActions={false} />;
};


const UserJourney: React.FC<UserJourneyProps> = ({ onBackToRoleSelect }) => {
    const { currentUser, setChatVisibility } = useContext(AppContext);
    const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
    const [view, setView] = useState<'main' | 'orders' | 'create_order'>('main');

    useEffect(() => {
        if (view === 'create_order') {
            setChatVisibility(false);
        } else {
            setChatVisibility(true);
        }
        // Cleanup function to reset visibility when component unmounts
        return () => setChatVisibility(true);
    }, [view, setChatVisibility]);

    if (!currentUser) return null;

    const teams = (currentUser.Team || '').split(',').map(t => t.trim()).filter(Boolean);

    // Auto-select team if user is only in one
    useEffect(() => {
        if (teams.length === 1 && !selectedTeam) {
            setSelectedTeam(teams[0]);
        }
    }, [teams, selectedTeam]);

    const handleOrderCreated = () => {
        // After order is "created", switch to the orders view to see it
        // In a real app, you might want to refresh the orders data here
        setView('orders');
    }

    if (teams.length > 1 && !selectedTeam) {
        return (
             <div className="w-full max-w-4xl mx-auto page-card">
                <h2 className="text-2xl font-bold text-center mb-8 text-white">សូមជ្រើសរើសក្រុមដើម្បីបន្ត</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                    {teams.map(team => (
                        <button key={team} onClick={() => setSelectedTeam(team)} className="selection-button">
                            ក្រុម {team}
                        </button>
                    ))}
                </div>
            </div>
        )
    }
    
    if (!selectedTeam) {
        // This case handles users with no assigned teams.
        return (
            <div className="w-full max-w-2xl mx-auto page-card text-center">
                 <h2 className="text-2xl font-bold mb-4 text-white">Welcome, {currentUser.FullName}</h2>
                 <p className="text-yellow-400">អ្នកមិនមានក្រុមទេ។ សូមទាក់ទង Admin។</p>
            </div>
        )
    }
    
    if (view === 'create_order') {
        return <CreateOrderPage team={selectedTeam} onSaveSuccess={handleOrderCreated} onCancel={() => setView('main')} />
    }

    if (view === 'orders') {
        return (
            <div className="w-full max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold text-white">ប្រតិបត្តិការណ៍ក្រុម {selectedTeam}</h2>
                    <button onClick={() => setView('main')} className="btn btn-secondary">ត្រឡប់</button>
                </div>
                <UserOrdersView team={selectedTeam} />
            </div>
        )
    }


    return (
        <div className="w-full max-w-2xl mx-auto page-card">
            <h2 className="text-2xl font-bold text-center mb-4 text-white">
                សូមស្វាគមន៍, {currentUser.FullName}
            </h2>
            <p className="text-center text-gray-400 mb-8">
                អ្នកកំពុងធ្វើការនៅក្នុងក្រុម <span className="font-bold text-blue-300">{selectedTeam}</span>
            </p>
            
            <div className="space-y-8">
                {/* Main Action */}
                <div>
                    <button onClick={() => setView('create_order')} className="selection-button">
                        បង្កើតការកម្មង់ថ្មី
                    </button>
                </div>
                
                {/* Menu */}
                <div className="border-t border-gray-600 pt-6">
                    <h3 className="text-lg font-semibold text-center text-gray-400 mb-4">ម៉ឺនុយ</h3>
                    <div className="space-y-3">
                        <button onClick={() => setView('orders')} className="menu-button">
                            មើលប្រតិបត្តិការណ៍ក្រុម
                        </button>
                        {/* Future menu items can be added here */}
                    </div>
                </div>
            </div>


            {teams.length > 1 && (
                 <div className="text-center mt-8">
                    <button onClick={() => { setSelectedTeam(null); setView('main'); }} className="btn btn-secondary">
                        ប្តូរក្រុម
                    </button>
                </div>
            )}
        </div>
    );
};

export default UserJourney;