
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { AppContext } from '../App';
import Spinner from '../components/common/Spinner';
import { FullOrder, ParsedOrder } from '../types';
import EditOrderPage from './EditOrderPage';
import OrdersList from '../components/orders/OrdersList';
import { WEB_APP_URL } from '../constants';

interface OrdersDashboardProps {
    onBack: () => void;
}

const OrdersDashboard: React.FC<OrdersDashboardProps> = ({ onBack }) => {
    const [editingOrder, setEditingOrder] = useState<ParsedOrder | null>(null);
    const [allOrders, setAllOrders] = useState<ParsedOrder[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [ordersError, setOrdersError] = useState('');

    const fetchAllOrders = async () => {
        setOrdersLoading(true);
        setOrdersError('');
        try {
            const response = await fetch(`${WEB_APP_URL}/api/admin/all-orders`);
            if (!response.ok) {
                let errorMessage = 'Failed to fetch orders from the server.';
                try {
                    const errorData = await response.json();
                    if (errorData && errorData.message) {
                        errorMessage = `Server responded with an error: ${errorData.message}`;
                    } else {
                        errorMessage = `Server responded with status: ${response.status}`;
                    }
                } catch (e) {
                    errorMessage = `Failed to fetch orders from the server. Status: ${response.status}`;
                }
                throw new Error(errorMessage);
            }
            const result = await response.json();
            if (result.status !== 'success') {
                throw new Error(result.message || 'Error in API response for orders.');
            }
            
            const rawOrders: FullOrder[] = result.data;
            const parsed = rawOrders.map(o => {
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
            setAllOrders(parsed);
        } catch (err: any) {
            let friendlyErrorMessage = `មិនអាចទាញយកប្រតិបត្តិការណ៍បានទេ: ${err.message}`;
            if (err.message && err.message.includes('cannot unmarshal number into Go struct field')) {
                friendlyErrorMessage = `មានបញ្ហាទិន្នន័យនៅក្នុង Google Sheet!\n\n` +
                    `Server បានបរាជ័យក្នុងការអានទិន្នន័យ ព្រោះជួរឈរមួយចំនួនដូចជា "Customer Name" ឬ "Note" មានផ្ទុកទិន្នន័យជាលេខ ជំនួសឱ្យអក្សរ។\n\n` +
                    `➡️ សូមចូលទៅកាន់សន្លឹក "AllOrders" របស់អ្នក ហើយពិនិត្យមើលជួរឈរទាំងនោះ។\n` +
                    `➡️ សូមប្រាកដថា ទិន្នន័យទាំងអស់ក្នុងជួរឈរនេះជាអក្សរ។ (ឧទាហរណ៍៖ បើមានលេខ 123 សូមប្តូរទៅជា '123)។\n` +
                    `➡️ ដើម្បីជៀសវាងបញ្ហានេះនាពេលអនាគត សូម Format ជួរឈរទាំងមូលជា "Plain Text"។`;
            }
            setOrdersError(friendlyErrorMessage);
        } finally {
            setOrdersLoading(false);
        }
    };
    
    useEffect(() => {
        fetchAllOrders();
    }, []);

    const teams = useMemo(() => {
        if (!allOrders) return [];
        return Array.from(new Set(allOrders.map(o => o.Team).filter(Boolean)));
    }, [allOrders]);
    
    const handleSaveOrder = (updatedOrder: ParsedOrder) => {
        setEditingOrder(null);
        fetchAllOrders();
    };
    
    const handleEditOrder = (order: ParsedOrder) => {
        setEditingOrder(order);
    };

    const renderContent = () => {
        if (ordersLoading) {
             return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
        }
        
        if (ordersError) {
             return <p className="text-center text-red-400 p-8 whitespace-pre-wrap">{ordersError}</p>;
        }
        
        if (editingOrder) {
            return <EditOrderPage order={editingOrder} onSave={handleSaveOrder} onCancel={() => setEditingOrder(null)} />;
        }

        return <OrdersList orders={allOrders} onEdit={handleEditOrder} showActions={true} teams={teams} />;
    };

    return (
        <div className="w-full h-full min-h-[calc(100vh-6rem)] max-w-7xl mx-auto p-2 sm:p-4 lg:p-6 animate-fade-in">
             <style>{`.animate-fade-in { animation: fadeIn 0.5s ease-in-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
             <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                    {editingOrder ? `កែសម្រួល ID: ${editingOrder['Order ID']}` : 'គ្រប់គ្រងប្រតិបត្តិការណ៍'}
                </h1>
                <button onClick={onBack} className="btn btn-secondary flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="hidden sm:inline">ត្រឡប់ទៅផ្ទាំង Admin</span>
                     <span className="sm:hidden">ត្រឡប់</span>
                </button>
            </div>
            {renderContent()}
        </div>
    );
};

export default OrdersDashboard;
