import React, { useState, useContext, useEffect, useMemo } from 'react';
import { AppContext } from '../App';
import { ParsedOrder, FullOrder, User } from '../types';
import { WEB_APP_URL } from '../constants';
import Spinner from '../components/common/Spinner';
import OrdersList from '../components/orders/OrdersList';
import CreateOrderPage from './CreateOrderPage';

const UserOrdersView: React.FC<{ team: string }> = ({ team }) => {
    const { appData } = useContext(AppContext);
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
                
                const allOrders: FullOrder[] = Array.isArray(result.data) 
                    ? result.data.filter((o: any) => o !== null && typeof o === 'object') 
                    : [];
                
                // --- DATA ENRICHMENT START ---
                const enrichedOrders = allOrders.map(order => {
                    // SAFEGUARD: Cast to string
                    let derivedTeam = String(order.Team || '').trim();
                    const orderUser = String(order.User || '').trim();
                    
                    if (!derivedTeam && orderUser && appData.users) {
                        const foundUser = appData.users.find((u: User) => 
                            u && u.UserName && 
                            String(u.UserName).toLowerCase().trim() === orderUser.toLowerCase()
                        );
                        
                        if (foundUser && foundUser.Team) {
                            const teams = String(foundUser.Team).split(',').map(t => t.trim()).filter(Boolean);
                            if (teams.length > 0) {
                                derivedTeam = teams[0];
                            }
                        }
                    }
                    return { ...order, Team: derivedTeam };
                });
                // --- DATA ENRICHMENT END ---

                const targetTeam = String(team).toLowerCase().trim();
                const teamOrders = enrichedOrders.filter(o => String(o.Team || '').toLowerCase().trim() === targetTeam);

                const parsed = teamOrders.map(o => {
                    let products = [];
                    try {
                        if (o['Products (JSON)'] && typeof o['Products (JSON)'] === 'string') {
                            const parsedProducts = JSON.parse(o['Products (JSON)']);
                            // SAFEGUARD: Ensure result is an array
                            products = Array.isArray(parsedProducts) ? parsedProducts : [];
                        }
                    } catch(e) { 
                        console.error("Failed to parse products JSON for order:", o['Order ID'], o['Products (JSON)']);
                        products = [];
                    }
                    return { ...o, Products: products };
                });

                parsed.sort((a, b) => {
                    const tA = a.Timestamp ? new Date(a.Timestamp).getTime() : 0;
                    const tB = b.Timestamp ? new Date(b.Timestamp).getTime() : 0;
                    return tB - tA;
                });
                
                setOrders(parsed);
            } catch (err: any) {
                setError(`Could not load team orders: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, [team, appData.users]); 
    
    const filteredOrders = useMemo(() => {
        if (!searchQuery.trim()) return orders;
        const lowerQuery = searchQuery.toLowerCase().trim();
        return orders.filter(o => 
            String(o['Order ID'] || '').toLowerCase().includes(lowerQuery) ||
            String(o['Customer Name'] || '').toLowerCase().includes(lowerQuery) ||
            String(o['Customer Phone'] || '').includes(lowerQuery) ||
            String(o.User || '').toLowerCase().includes(lowerQuery) ||
            (Array.isArray(o.Products) && o.Products.some(p => String(p.name || '').toLowerCase().includes(lowerQuery)))
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

const UserJourney: React.FC<{ onBackToRoleSelect: () => void }> = ({ onBackToRoleSelect }) => {
    const { currentUser, setChatVisibility } = useContext(AppContext);
    const [view, setView] = useState<'list' | 'create'>('list');
    const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

    const userTeams = useMemo(() => {
        if (!currentUser?.Team) return [];
        return currentUser.Team.split(',').map(t => t.trim()).filter(Boolean);
    }, [currentUser]);

    useEffect(() => {
        if (view === 'create') {
            setChatVisibility(false);
        } else {
            setChatVisibility(true);
        }
        return () => setChatVisibility(true);
    }, [view, setChatVisibility]);

    useEffect(() => {
        if (userTeams.length === 1 && !selectedTeam) {
            setSelectedTeam(userTeams[0]);
        }
    }, [userTeams, selectedTeam]);

    if (userTeams.length === 0) {
        return (
            <div className="w-full max-w-2xl mx-auto page-card text-center p-12 mt-20">
                 <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                 </div>
                 <h2 className="text-2xl font-bold mb-2 text-white">សូមស្វាគមន៍, {currentUser?.FullName}</h2>
                 <p className="text-gray-400">អ្នកមិនទាន់មានក្រុមនៅឡើយទេ។ សូមទាក់ទង Admin ដើម្បីកំណត់ក្រុម។</p>
                 <button onClick={onBackToRoleSelect} className="btn btn-secondary mt-6">ត្រឡប់ក្រោយ</button>
            </div>
        )
    }

    if (userTeams.length > 1 && !selectedTeam) {
        return (
             <div className="w-full max-w-5xl mx-auto p-4 mt-10 md:mt-20 animate-fade-in">
                <style>{`
                    .team-card:hover { transform: translateY(-5px); border-color: #3b82f6; }
                `}</style>
                
                <div className="flex justify-start mb-8 relative z-10">
                    {currentUser?.IsSystemAdmin && (
                        <button 
                            onClick={onBackToRoleSelect} 
                            className="btn btn-secondary flex items-center gap-2 shadow-lg"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                            </svg>
                            <span>ត្រឡប់ទៅជ្រើសរើសតួនាទី (Back)</span>
                        </button>
                    )}
                </div>

                <div className="text-center mb-10">
                    <h2 className="text-3xl font-bold text-white mb-2">សូមជ្រើសរើសក្រុមដើម្បីបន្ត</h2>
                    <p className="text-gray-400">ជ្រើសរើសក្រុមដែលអ្នកកំពុងបំពេញការងារនៅពេលនេះ</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {userTeams.map(team => (
                        <button 
                            key={team} 
                            onClick={() => setSelectedTeam(team)} 
                            className="team-card bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 flex flex-col items-center justify-center transition-all duration-300 group"
                        >
                            <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-300 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <span className="text-lg font-bold text-white group-hover:text-blue-300 transition-colors">{team}</span>
                            <span className="text-xs text-gray-500 mt-1">ចូលធ្វើការ</span>
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    if (!selectedTeam) return null;

    if (view === 'create') {
        return <CreateOrderPage team={selectedTeam} onSaveSuccess={() => setView('list')} onCancel={() => setView('list')} />;
    }

    return (
        <div className="w-full max-w-7xl mx-auto p-2 sm:p-4 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        {currentUser?.IsSystemAdmin && (
                            <button onClick={onBackToRoleSelect} className="btn btn-secondary !py-1 !px-2 text-xs flex items-center gap-1" title="Back to Role Selection">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                                </svg>
                                Back
                            </button>
                        )}
                        <h1 className="text-2xl font-bold text-white">ការកម្មង់របស់ខ្ញុំ</h1>
                    </div>
                    
                    <div className="flex items-center mt-1 text-sm text-gray-400">
                        <span>ក្រុមបច្ចុប្បន្ន: <strong className="text-blue-400 ml-1">{selectedTeam}</strong></span>
                        {userTeams.length > 1 && (
                            <button onClick={() => setSelectedTeam(null)} className="ml-4 text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-white transition-colors">
                                ប្តូរក្រុម
                            </button>
                        )}
                    </div>
                </div>
                
                <button onClick={() => setView('create')} className="btn btn-primary shadow-lg shadow-blue-900/20 w-full md:w-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    បង្កើតការកម្មង់ថ្មី
                </button>
            </div>
            
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 shadow-xl">
                <UserOrdersView team={selectedTeam} />
            </div>
        </div>
    );
};

export default UserJourney;