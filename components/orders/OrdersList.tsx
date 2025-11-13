import React, { useState, useMemo, useContext } from 'react';
import { ParsedOrder } from '../../types';
import { AppContext } from '../../App';
import { LABEL_PRINTER_URL_BASE } from '../../constants';

interface OrdersListProps {
    orders: ParsedOrder[];
    onEdit?: (order: ParsedOrder) => void;
    showActions: boolean;
    teams?: string[];
}

const OrdersList: React.FC<OrdersListProps> = ({ orders, onEdit, showActions, teams }) => {
    const { appData } = useContext(AppContext);
    const [filters, setFilters] = useState({ searchTerm: '', date: '', team: '' });

    const labelPrinterUrl = useMemo(() => {
        const urlFromSettings = appData.settings?.find((s: any) => s.SettingName === 'LABEL_PRINTER_URL')?.SettingValue;
        return urlFromSettings || LABEL_PRINTER_URL_BASE;
    }, [appData.settings]);

    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            const searchTermMatch = filters.searchTerm.toLowerCase() === '' ||
                order['Order ID'].toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                order.User.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                order['Customer Name'].toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                order['Customer Phone'].includes(filters.searchTerm) ||
                order.Products.some(p => p.name.toLowerCase().includes(filters.searchTerm.toLowerCase()));

            const dateMatch = filters.date === '' || order.Timestamp.startsWith(filters.date);
            const teamMatch = filters.team === '' || order.Team === filters.team;
            
            return searchTermMatch && dateMatch && teamMatch;
        });
    }, [orders, filters]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const generatePrintUrl = (order: ParsedOrder): string => {
        if (!labelPrinterUrl || !order['Order ID']) {
            return '#';
        }

        const params = new URLSearchParams();
        params.append('id', order['Order ID']);
        params.append('name', order['Customer Name'] || '');
        params.append('phone', order['Customer Phone'] || '');
        params.append('location', order.Location || ''); // Province/City
        params.append('address', order['Address Details'] || '');
        params.append('page', order.Page || '');
        params.append('shipping', order['Internal Shipping Method'] || '');
        params.append('payment', order['Payment Status'] || '');
        params.append('total', (order['Grand Total'] || 0).toFixed(2));
        params.append('user', order.User || '');

        const baseUrl = labelPrinterUrl.split('?')[0];
        return `${baseUrl}?${params.toString()}`;
    };

    const hasPrintFeature = !!labelPrinterUrl;

    return (
        <div className="page-card">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                 <input type="text" name="searchTerm" placeholder="ស្វែងរកតាម ID, User, Phone, Product..." value={filters.searchTerm} onChange={handleFilterChange} className="form-input"/>
                 <input type="date" name="date" value={filters.date} onChange={handleFilterChange} className="form-input"/>
                 {teams && teams.length > 0 && (
                     <select name="team" value={filters.team} onChange={handleFilterChange} className="form-select">
                         <option value="">គ្រប់ក្រុម</option>
                         {teams.map(team => (
                             <option key={team} value={team}>ក្រុម {team}</option>
                         ))}
                     </select>
                 )}
            </div>
            <div className="overflow-x-auto">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>អតិថិជន</th>
                            <th>User</th>
                            <th>សរុប</th>
                            {showActions && <th>តម្លៃដើមសរុប</th>}
                            {showActions && <th>ចំណេញ</th>}
                            <th>ស្ថានភាព</th>
                            <th>កាលបរិច្ឆេទ</th>
                            {hasPrintFeature && <th>ព្រីន</th>}
                            {showActions && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredOrders.length > 0 ? filteredOrders.map(order => {
                            const profit = order['Grand Total'] - (order['Total Product Cost ($)'] || 0) - (order['Internal Cost'] || 0);
                            return (
                                <tr key={order['Order ID']}>
                                    <td>{order['Order ID']}</td>
                                    <td>
                                        <div>{order['Customer Name']}</div>
                                        <div className="text-xs text-gray-400">{order['Customer Phone']}</div>
                                    </td>
                                    <td>{order.User}</td>
                                    <td>${order['Grand Total'].toFixed(2)}</td>
                                    {showActions && <td>${(order['Total Product Cost ($)'] || 0).toFixed(2)}</td>}
                                    {showActions && (
                                        <td className={profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                                            ${profit.toFixed(2)}
                                        </td>
                                    )}
                                    <td>
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${order['Payment Status'] === 'Paid' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                            {order['Payment Status']}
                                        </span>
                                    </td>
                                    <td>{new Date(order.Timestamp).toLocaleString('en-GB')}</td>
                                    {hasPrintFeature && (
                                        <td>
                                            <a 
                                                href={generatePrintUrl(order)}
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className={`action-btn text-blue-400 hover:text-blue-600 p-1 text-base ${!order['Order ID'] ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                title={order['Order ID'] ? "Print Label" : "Order ID is missing"}
                                                onClick={(e) => !order['Order ID'] && e.preventDefault()}
                                            >
                                                🖨️
                                            </a>
                                        </td>
                                    )}
                                    {showActions && (
                                        <td>
                                            <button onClick={() => onEdit && onEdit(order)} className="action-btn text-yellow-400 hover:text-yellow-600 p-1 text-base" title="Edit Order">✏️ កែសម្រួល</button>
                                        </td>
                                    )}
                                </tr>
                            )
                        }) : (
                            <tr><td colSpan={6 + (showActions ? 3 : 0) + (hasPrintFeature ? 1 : 0)} className="text-center py-8 text-gray-400">រកមិនឃើញប្រតិបត្តិការណ៍ទេ។</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default OrdersList;
