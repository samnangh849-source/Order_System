import React, { useState, useMemo, useContext, useEffect } from 'react';
import { ParsedOrder } from '../../types';
import { AppContext } from '../../App';
import { LABEL_PRINTER_URL_BASE } from '../../constants';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

interface OrdersListProps {
    orders: ParsedOrder[];
    onEdit?: (order: ParsedOrder) => void;
    showActions: boolean;
}

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
                <div className="absolute right-0 mt-2 w-64 bg-gray-700 border border-gray-600 rounded-md shadow-lg z-20 max-h-80 overflow-y-auto">
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

const OrdersList: React.FC<OrdersListProps> = ({ orders, onEdit, showActions }) => {
    const { appData } = useContext(AppContext);
    
    const labelPrinterUrl = useMemo(() => {
        const urlFromSettings = appData.settings?.find((s: any) => s.SettingName === 'LABEL_PRINTER_URL')?.SettingValue;
        return urlFromSettings || LABEL_PRINTER_URL_BASE;
    }, [appData.settings]);

    const hasPrintFeature = !!labelPrinterUrl;

    const [visibleColumns, setVisibleColumns] = useState(new Set([
        'index', 'Order ID', 'Page', 'customer', 'locationAddress', 'User', 'Grand Total', 'Payment Status', 'Timestamp', 'actions'
    ]));

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

    const allColumns = useMemo(() => {
        const columns = [
            { 
                key: 'index', 
                label: '#', 
                // @ts-ignore - Render function accepts index as second arg
                render: (_: ParsedOrder, index: number) => <span className="text-gray-500 font-mono text-xs">{index + 1}</span> 
            },
            { key: 'Order ID', label: 'Order ID' },
            { key: 'Page', label: 'Page', render: (row: ParsedOrder) => {
                const pageInfo = appData.pages?.find((p: any) => p.PageName === row.Page);
                const logoUrl = pageInfo ? convertGoogleDriveUrl(pageInfo.PageLogoURL) : '';
                return (
                    <div className="flex items-center gap-3 w-max">
                        {logoUrl && (
                            <img 
                                src={logoUrl} 
                                alt={row.Page} 
                                className="w-8 h-8 rounded-full object-cover border border-gray-600 bg-gray-700 flex-shrink-0"
                                title={row.Page}
                            />
                        )}
                        <span className="text-sm font-medium">{row.Page}</span>
                    </div>
                );
            }},
            { key: 'customer', label: 'អតិថិជន', render: (row: ParsedOrder) => (
                <div className="min-w-max">
                    <div className="font-medium">{row['Customer Name']}</div>
                    <div className="text-xs text-gray-400">{row['Customer Phone']}</div>
                </div>
            )},
            { key: 'locationAddress', label: 'ទីតាំង & អាសយដ្ឋាន', render: (row: ParsedOrder) => (
                <div className="min-w-[200px]">
                    <p className="font-semibold">{row.Location}</p>
                    <p className="text-xs text-gray-400 truncate max-w-xs" title={row['Address Details']}>{row['Address Details']}</p>
                </div>
            )},
            { key: 'User', label: 'User' },
            // Added Shipping & Payment Columns
            { key: 'Internal Shipping Method', label: 'សេវាដឹក' },
            { key: 'Internal Shipping Details', label: 'អ្នកដឹក' },
            { key: 'Internal Cost', label: 'ថ្លៃដឹក', render: (row: ParsedOrder) => `$${(Number(row['Internal Cost']) || 0).toFixed(2)}` },
            { key: 'Payment Info', label: 'ធនាគារ' },
            
            { key: 'Grand Total', label: 'សរុប', render: (row: ParsedOrder) => <span className="font-bold text-blue-300">${row['Grand Total'].toFixed(2)}</span> },
            { key: 'Payment Status', label: 'ស្ថានភាព', render: (row: ParsedOrder) => (
                 <span className={`px-2 py-1 text-xs font-semibold rounded-full ${row['Payment Status'] === 'Paid' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                    {row['Payment Status']}
                </span>
            )},
            { key: 'Timestamp', label: 'កាលបរិច្ឆេទ', render: (row: ParsedOrder) => new Date(row.Timestamp).toLocaleString('en-GB') },
        ];

        if (showActions) {
            columns.splice(columns.findIndex(c => c.key === 'Grand Total'), 0,
                { key: 'Total Product Cost ($)', label: 'តម្លៃដើមសរុប', render: (row: ParsedOrder) => `$${(row['Total Product Cost ($)'] || 0).toFixed(2)}` },
                { key: 'profit', label: 'ចំណេញ', render: (row: ParsedOrder) => {
                    const profit = row['Grand Total'] - (row['Total Product Cost ($)'] || 0) - (row['Internal Cost'] || 0);
                    return <span className={profit >= 0 ? 'text-green-400' : 'text-red-400'}>${profit.toFixed(2)}</span>
                }}
            );
        }

        if (hasPrintFeature) {
             columns.push({ key: 'print', label: 'ព្រីន', render: (row: ParsedOrder) => (
                <a 
                    href={generatePrintUrl(row)}
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={`action-btn text-blue-400 hover:text-blue-600 p-1 text-base ${!row['Order ID'] ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={row['Order ID'] ? "Print Label" : "Order ID is missing"}
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent row click events
                        if (!row['Order ID']) e.preventDefault();
                    }}
                >
                    🖨️
                </a>
            )});
        }
        
        if (showActions) {
            columns.push({ key: 'actions', label: 'Actions', render: (row: ParsedOrder) => (
                <button onClick={(e) => { e.stopPropagation(); onEdit && onEdit(row); }} className="action-btn text-yellow-400 hover:text-yellow-600 p-1 text-base" title="Edit Order">✏️ កែសម្រួល</button>
            )});
        }

        return columns;
    }, [showActions, hasPrintFeature, onEdit, appData.pages]);

    const activeColumns = useMemo(() => allColumns.filter(c => visibleColumns.has(c.key)), [allColumns, visibleColumns]);

    const generatePrintUrl = (order: ParsedOrder): string => {
        if (!labelPrinterUrl || !order['Order ID']) {
            return '#';
        }
        const params = new URLSearchParams();
        params.append('id', order['Order ID']);
        params.append('name', order['Customer Name'] || '');
        params.append('phone', order['Customer Phone'] || '');
        params.append('location', order.Location || '');
        params.append('address', order['Address Details'] || '');
        params.append('page', order.Page || '');
        params.append('shipping', order['Internal Shipping Method'] || '');
        params.append('payment', order['Payment Status'] || '');
        params.append('total', (order['Grand Total'] || 0).toFixed(2));
        params.append('user', order.User || '');
        const baseUrl = labelPrinterUrl.split('?')[0];
        return `${baseUrl}?${params.toString()}`;
    };

    return (
        <div className="page-card">
            <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-400">{orders.length} results found.</p>
                <ColumnToggler columns={allColumns} visibleColumns={visibleColumns} onToggle={toggleColumn} />
            </div>
            <div className="overflow-x-auto">
                <table className="admin-table">
                    <thead>
                        <tr>
                            {activeColumns.map(col => <th key={col.key} className="whitespace-nowrap">{col.label}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {orders.length > 0 ? orders.map((order, index) => (
                            <tr key={order['Order ID']} className="hover:bg-gray-700/50 cursor-pointer" onClick={() => onEdit && showActions && onEdit(order)}>
                                {activeColumns.map(col => (
                                    <td key={col.key} className="whitespace-nowrap px-4 py-3">
                                        {/* FIX: Handle non-renderable array types to satisfy TypeScript */}
                                        {col.render
                                            // @ts-ignore - Index arg
                                            ? col.render(order, index)
                                            : (() => {
                                                const value = order[col.key as keyof ParsedOrder];
                                                // The `Product[]` type from `ParsedOrder` is not a valid ReactNode.
                                                // This check handles that possibility for the type-checker, even though
                                                // we don't have a column that displays the raw products array without a renderer.
                                                if (Array.isArray(value)) {
                                                    return `${value.length} items`;
                                                }
                                                return value;
                                            })()}
                                    </td>
                                ))}
                            </tr>
                        )) : (
                            <tr><td colSpan={activeColumns.length} className="text-center py-8 text-gray-400">រកមិនឃើញប្រតិបត្តិការណ៍ទេ។</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default OrdersList;