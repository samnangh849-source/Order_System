
import React, { useState } from 'react';
import Modal from '../common/Modal';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { ParsedOrder } from '../../types';

// Extend jsPDF type to include autoTable
interface jsPDFWithAutoTable extends jsPDF {
    autoTable: (options: any) => void;
    lastAutoTable: { finalY: number };
}

interface PdfExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    orders: ParsedOrder[];
}

type GroupingOption = 'Page' | 'Team' | 'None';
type PageSize = 'a4' | 'a3' | 'letter' | 'legal';
type Orientation = 'portrait' | 'landscape';

const PdfExportModal: React.FC<PdfExportModalProps> = ({ isOpen, onClose, orders }) => {
    const [grouping, setGrouping] = useState<GroupingOption>('Page');
    const [pageSize, setPageSize] = useState<PageSize>('a4');
    const [orientation, setOrientation] = useState<Orientation>('landscape');
    const [isGenerating, setIsGenerating] = useState(false);

    // Default visible columns
    const [columns, setColumns] = useState({
        orderId: { label: 'Order ID', visible: true, width: 25 },
        date: { label: 'Date', visible: true, width: 25 },
        customer: { label: 'Customer', visible: true, width: 35 },
        phone: { label: 'Phone', visible: true, width: 25 },
        location: { label: 'Location', visible: true, width: 30 },
        items: { label: 'Items', visible: true, width: 50 },
        total: { label: 'Total ($)', visible: true, width: 20 },
        shipping: { label: 'Shipping', visible: false, width: 20 },
        status: { label: 'Status', visible: true, width: 20 },
        note: { label: 'Note', visible: false, width: 30 },
    });

    const toggleColumn = (key: keyof typeof columns) => {
        setColumns(prev => ({
            ...prev,
            [key]: { ...prev[key], visible: !prev[key].visible }
        }));
    };

    const generatePDF = () => {
        setIsGenerating(true);
        setTimeout(() => {
            try {
                const doc = new jsPDF({
                    orientation: orientation,
                    unit: 'mm',
                    format: pageSize
                }) as jsPDFWithAutoTable;

                // --- Header ---
                const pageWidth = doc.internal.pageSize.width;
                doc.setFontSize(18);
                doc.setTextColor(40, 40, 40);
                doc.text("Orders Report", pageWidth / 2, 15, { align: 'center' });
                
                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, 22, { align: 'center' });
                doc.text(`Total Orders: ${orders.length}`, pageWidth / 2, 27, { align: 'center' });

                // --- Data Preparation ---
                // 1. Group Data
                const groupedData: Record<string, ParsedOrder[]> = {};
                
                if (grouping === 'None') {
                    groupedData['All Orders'] = orders;
                } else {
                    orders.forEach(order => {
                        const key = (order[grouping] as string) || 'Unassigned';
                        if (!groupedData[key]) groupedData[key] = [];
                        groupedData[key].push(order);
                    });
                }

                // 2. Prepare Table Config
                const tableHead = [
                    Object.entries(columns)
                        .filter(([_, conf]) => conf.visible)
                        .map(([_, conf]) => conf.label)
                ];

                let finalY = 35;

                // 3. Iterate Groups and Draw Tables
                Object.entries(groupedData).sort().forEach(([groupName, groupOrders]) => {
                    // Group Header
                    if (finalY > doc.internal.pageSize.height - 20) {
                        doc.addPage();
                        finalY = 20;
                    }
                    
                    if (grouping !== 'None') {
                        doc.setFontSize(12);
                        doc.setTextColor(0, 80, 180); // Blue header for group
                        doc.setFillColor(240, 240, 255);
                        doc.rect(14, finalY, pageWidth - 28, 8, 'F');
                        doc.text(`${grouping}: ${groupName} (${groupOrders.length} orders)`, 16, finalY + 5.5);
                        finalY += 10;
                    }

                    // Prepare Rows
                    const tableBody = groupOrders.map(order => {
                        const row: any[] = [];
                        if (columns.orderId.visible) row.push(order['Order ID']);
                        if (columns.date.visible) row.push(new Date(order.Timestamp).toLocaleDateString());
                        if (columns.customer.visible) row.push(order['Customer Name']);
                        if (columns.phone.visible) row.push(order['Customer Phone']);
                        if (columns.location.visible) row.push(`${order.Location || ''} ${order['Address Details'] || ''}`);
                        if (columns.items.visible) {
                            const itemsStr = order.Products.map(p => `${p.quantity}x ${p.name}`).join(', ');
                            row.push(itemsStr);
                        }
                        if (columns.total.visible) row.push(`$${order['Grand Total'].toFixed(2)}`);
                        if (columns.shipping.visible) row.push(`$${order['Internal Cost']?.toFixed(2) || '0.00'}`);
                        if (columns.status.visible) row.push(order['Payment Status']);
                        if (columns.note.visible) row.push(order.Note || '');
                        return row;
                    });

                    // Calculate Subtotals for the group
                    const totalAmount = groupOrders.reduce((sum, o) => sum + o['Grand Total'], 0);
                    
                    // Draw Table
                    doc.autoTable({
                        startY: finalY,
                        head: tableHead,
                        body: tableBody,
                        theme: 'striped',
                        headStyles: { fillColor: [66, 66, 66] },
                        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
                        columnStyles: {
                            // Map column index to specific styles if needed
                            // Note: Simple mapping based on visibility order is complex dynamically, 
                            // so letting autoTable handle width mostly.
                        },
                        margin: { top: 20 },
                        didDrawPage: (data: any) => {
                            // Footer per page if needed
                        }
                    });

                    // @ts-ignore
                    finalY = doc.lastAutoTable.finalY + 2;

                    // Draw Group Footer (Subtotal)
                    if (grouping !== 'None') {
                        doc.setFontSize(10);
                        doc.setTextColor(50, 50, 50);
                        doc.text(`Subtotal for ${groupName}: $${totalAmount.toFixed(2)}`, pageWidth - 15, finalY + 5, { align: 'right' });
                        finalY += 12;
                    } else {
                        finalY += 5;
                    }
                });

                // Grand Total
                if (grouping === 'None') {
                     const grandTotal = orders.reduce((sum, o) => sum + o['Grand Total'], 0);
                     doc.setFontSize(12);
                     doc.setTextColor(0, 0, 0);
                     doc.text(`GRAND TOTAL: $${grandTotal.toFixed(2)}`, pageWidth - 15, finalY + 5, { align: 'right' });
                }

                // Page Numbers
                const pageCount = doc.internal.pages.length - 1; // -1 because jspdf starts with 1 page but array length includes empty one sometimes or 1-based logic
                for(let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    doc.setFontSize(8);
                    doc.setTextColor(150);
                    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
                }

                doc.save(`Order_Report_${new Date().toISOString().slice(0,10)}.pdf`);
                onClose();
            } catch (err) {
                console.error("PDF Generation Error:", err);
                alert("Failed to generate PDF. See console for details.");
            } finally {
                setIsGenerating(false);
            }
        }, 100);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    ទាញយកជា PDF (Export PDF)
                </h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>

            <div className="space-y-6">
                {/* 1. General Configuration */}
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <h3 className="text-lg font-semibold text-blue-300 mb-3">ការកំណត់ទូទៅ (General)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">ទំហំ (Size)</label>
                            <select value={pageSize} onChange={(e) => setPageSize(e.target.value as PageSize)} className="form-select">
                                <option value="a4">A4</option>
                                <option value="a3">A3</option>
                                <option value="letter">Letter</option>
                                <option value="legal">Legal</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">ទិសដៅ (Orientation)</label>
                            <select value={orientation} onChange={(e) => setOrientation(e.target.value as Orientation)} className="form-select">
                                <option value="portrait">បញ្ឈរ (Portrait)</option>
                                <option value="landscape">ប្ដេក (Landscape)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">ដាក់ក្រុមតាម (Group By)</label>
                            <select value={grouping} onChange={(e) => setGrouping(e.target.value as GroupingOption)} className="form-select">
                                <option value="Page">Page</option>
                                <option value="Team">Team</option>
                                <option value="None">None (List All)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* 2. Column Selection */}
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <h3 className="text-lg font-semibold text-blue-300 mb-3">ជ្រើសរើសទិន្នន័យ (Columns)</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {(Object.keys(columns) as Array<keyof typeof columns>).map((key) => (
                            <label key={key} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700 p-2 rounded transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={columns[key].visible} 
                                    onChange={() => toggleColumn(key)}
                                    className="form-checkbox h-5 w-5 text-blue-600 rounded border-gray-500 bg-gray-900 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-200">{columns[key].label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* 3. Summary */}
                <div className="bg-blue-900/20 p-3 rounded text-center text-sm text-blue-200 border border-blue-500/30">
                    ឯកសារនេះនឹងមាន <strong>{orders.length}</strong> ប្រតិបត្តិការណ៍។ 
                    {grouping !== 'None' && ` នឹងត្រូវបានបែងចែកជាក្រុមតាម ${grouping}។`}
                </div>
                
                <div className="text-xs text-gray-500 text-center italic">
                    Note: Khmer characters might not render correctly in standard PDF fonts without custom font embedding.
                </div>

                <div className="flex justify-end pt-4 space-x-3 border-t border-gray-700">
                    <button onClick={onClose} className="btn btn-secondary">បោះបង់</button>
                    <button 
                        onClick={generatePDF} 
                        className="btn btn-primary flex items-center shadow-lg shadow-blue-600/20"
                        disabled={isGenerating}
                    >
                        {isGenerating ? (
                            <>Processing...</>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                ទាញយក PDF
                            </>
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default PdfExportModal;
