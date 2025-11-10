import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../App';
import Spinner from '../components/common/Spinner';
import { ParsedOrder, Product, MasterProduct } from '../types';
import { WEB_APP_URL } from '../constants';
import SearchableProductDropdown from '../components/common/SearchableProductDropdown';
import { convertGoogleDriveUrl } from '../utils/fileUtils';

interface EditOrderPageProps {
    order: ParsedOrder;
    onSave: (updatedOrder: ParsedOrder) => void;
    onCancel: () => void;
}

const EditOrderPage: React.FC<EditOrderPageProps> = ({ order, onSave, onCancel }) => {
    const { appData, refreshData } = useContext(AppContext);
    const [formData, setFormData] = useState<ParsedOrder>(order);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const recalculateTotals = (products: Product[], shippingFee: number): Partial<ParsedOrder> => {
        const subtotal = products.reduce((sum, p) => sum + (p.total || 0), 0);
        const grandTotal = subtotal + (Number(shippingFee) || 0);
        const totalProductCost = products.reduce((sum, p) => sum + ((p.cost || 0) * (p.quantity || 0)), 0);
        const profit = grandTotal - totalProductCost - (Number(formData['Internal Cost']) || 0);
        
        return {
            'Subtotal': subtotal,
            'Grand Total': grandTotal,
            'Total Product Cost ($)': totalProductCost,
            // You can add profit if it's a field in ParsedOrder
        };
    };

    const handleProductChange = (index: number, field: keyof Product, value: any) => {
        setFormData(prev => {
            const newProducts = [...prev.Products];
            const productToUpdate = { ...newProducts[index] };

            if (field === 'name') {
                const masterProduct = appData.products.find((p: MasterProduct) => p.ProductName === value);
                if (masterProduct) {
                    productToUpdate.name = masterProduct.ProductName;
                    productToUpdate.originalPrice = masterProduct.Price;
                    productToUpdate.finalPrice = masterProduct.Price;
                    productToUpdate.cost = masterProduct.Cost;
                    productToUpdate.image = masterProduct.ImageURL;
                }
            } else {
                // @ts-ignore
                productToUpdate[field] = value;
            }
            
            productToUpdate.total = (productToUpdate.quantity || 0) * (productToUpdate.finalPrice || 0);
            newProducts[index] = productToUpdate;

            const newTotals = recalculateTotals(newProducts, prev['Shipping Fee (Customer)']);
            return { ...prev, Products: newProducts, ...newTotals };
        });
    };
    
    const handleAddProduct = () => {
        setFormData(prev => ({
            ...prev,
            Products: [
                ...prev.Products,
                {
                    id: Date.now(), name: '', quantity: 1, originalPrice: 0, finalPrice: 0,
                    total: 0, discountPercent: 0, colorInfo: '', image: '', cost: 0
                }
            ]
        }));
    };

    const handleRemoveProduct = (index: number) => {
        if (formData.Products.length <= 1) {
            alert("An order must have at least one product.");
            return;
        }
        setFormData(prev => {
            const newProducts = prev.Products.filter((_, i) => i !== index);
            const newTotals = recalculateTotals(newProducts, prev['Shipping Fee (Customer)']);
            return { ...prev, Products: newProducts, ...newTotals };
        });
    };

    useEffect(() => {
        const newTotals = recalculateTotals(formData.Products, formData['Shipping Fee (Customer)']);
        if (newTotals.Subtotal !== formData.Subtotal || newTotals['Grand Total'] !== formData['Grand Total']) {
            setFormData(prev => ({...prev, ...newTotals}));
        }
    }, [formData['Shipping Fee (Customer)']]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const payload = { ...formData };
            // Ensure numbers are not strings
            payload["Shipping Fee (Customer)"] = Number(payload["Shipping Fee (Customer)"]) || 0;
            payload["Internal Cost"] = Number(payload["Internal Cost"]) || 0;
            payload.Products = payload.Products.map(p => ({
                ...p,
                quantity: Number(p.quantity) || 0,
                finalPrice: Number(p.finalPrice) || 0,
                total: (Number(p.quantity) || 0) * (Number(p.finalPrice) || 0)
            }));
            
            const response = await fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                 const res = await response.json().catch(() => ({ message: 'Failed to update order. The server responded with an error.' }));
                 throw new Error(res.message);
            }
            
            await refreshData();
            onSave(payload);
            
        } catch (err: any) {
            console.error("Update Error:", err);
            setError(`មុខងារកែសម្រួលមិនទាន់រួចរាល់នៅឡើយទេ។ Backend endpoint '/api/admin/update-order' is needed. (${err.message})`);
        } finally {
            setLoading(false);
        }
    };
    
    const profit = formData['Grand Total'] - (formData['Total Product Cost ($)'] || 0) - (formData['Internal Cost'] || 0);

    return (
        <div className="w-full page-card animate-fade-in">
             <style>{`.animate-fade-in { animation: fadeIn 0.5s ease-in-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* --- Read-only Info --- */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm p-4 bg-gray-900/50 rounded-lg">
                    <div><strong className="text-gray-400 block">Order ID</strong>{formData['Order ID']}</div>
                    <div><strong className="text-gray-400 block">User</strong>{formData.User}</div>
                    <div><strong className="text-gray-400 block">Team</strong>{formData.Team}</div>
                    <div><strong className="text-gray-400 block">Timestamp</strong>{new Date(formData.Timestamp).toLocaleString()}</div>
                </div>

                {/* --- Customer Section --- */}
                <fieldset className="border border-gray-600 p-4 rounded-lg space-y-4">
                    <legend className="px-2 text-lg font-semibold text-blue-300">Customer</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" name="Customer Name" value={formData['Customer Name']} onChange={handleInputChange} className="form-input" placeholder="Customer Name" />
                        <input type="tel" name="Customer Phone" value={formData['Customer Phone']} onChange={handleInputChange} className="form-input" placeholder="Customer Phone" />
                        <input type="text" name="Location" value={formData.Location} onChange={handleInputChange} className="form-input" placeholder="Province/City" />
                        <input type="text" name="Address Details" value={formData['Address Details']} onChange={handleInputChange} className="form-input" placeholder="Address Details" />
                         <div className="relative">
                            <input type="number" step="0.1" name="Shipping Fee (Customer)" value={formData['Shipping Fee (Customer)']} onChange={handleInputChange} className="form-input" placeholder="Shipping Fee" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                        </div>
                    </div>
                </fieldset>

                {/* --- Products Section --- */}
                <fieldset className="border border-gray-600 p-4 rounded-lg space-y-4">
                    <legend className="px-2 text-lg font-semibold text-blue-300">Products</legend>
                    {formData.Products.map((p, index) => (
                        <div key={p.id || index} className="grid grid-cols-12 gap-x-4 gap-y-2 items-center p-3 bg-gray-800/50 rounded-md">
                             <div className="col-span-12 sm:col-span-5">
                                <SearchableProductDropdown products={appData.products} selectedProductName={p.name} onSelect={(name) => handleProductChange(index, 'name', name)} />
                             </div>
                             <div className="col-span-4 sm:col-span-1"><input type="number" min="1" value={p.quantity} onChange={(e) => handleProductChange(index, 'quantity', Number(e.target.value))} className="form-input text-center" /></div>
                             <div className="col-span-8 sm:col-span-2"><input type="number" step="0.01" value={p.finalPrice} onChange={(e) => handleProductChange(index, 'finalPrice', Number(e.target.value))} className="form-input text-center" placeholder="Price" /></div>
                             <div className="col-span-8 sm:col-span-2"><input type="text" value={p.colorInfo} onChange={(e) => handleProductChange(index, 'colorInfo', e.target.value)} className="form-input" placeholder="Color/Info" /></div>
                             <div className="col-span-4 sm:col-span-1 text-center font-semibold">${p.total.toFixed(2)}</div>
                             <div className="col-span-12 sm:col-span-1 text-right"><button type="button" onClick={() => handleRemoveProduct(index)} className="btn !p-2 !bg-red-600/50 hover:!bg-red-600">🗑️</button></div>
                        </div>
                    ))}
                     <button type="button" onClick={handleAddProduct} className="btn btn-secondary">Add Product</button>
                </fieldset>

                 {/* --- Shipping & Payment --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <fieldset className="border border-gray-600 p-4 rounded-lg space-y-4">
                        <legend className="px-2 text-lg font-semibold text-blue-300">Shipping</legend>
                        <select name="Internal Shipping Method" value={formData['Internal Shipping Method']} onChange={handleInputChange} className="form-select">
                           {appData.shippingMethods?.map((s: any) => <option key={s.MethodName} value={s.MethodName}>{s.MethodName}</option>)}
                        </select>
                        <input type="text" name="Internal Shipping Details" value={formData['Internal Shipping Details']} onChange={handleInputChange} className="form-input" placeholder="Driver or Details" />
                        <div className="relative"><input type="number" step="0.01" name="Internal Cost" value={formData['Internal Cost']} onChange={handleInputChange} className="form-input" placeholder="Internal Cost" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">$</span></div>
                    </fieldset>

                    <fieldset className="border border-gray-600 p-4 rounded-lg space-y-4">
                        <legend className="px-2 text-lg font-semibold text-blue-300">Payment</legend>
                        <select name="Payment Status" value={formData['Payment Status']} onChange={handleInputChange} className="form-select">
                            <option value="Unpaid">Unpaid</option>
                            <option value="Paid">Paid</option>
                        </select>
                        <input type="text" name="Payment Info" value={formData['Payment Info']} onChange={handleInputChange} className="form-input" placeholder="Payment Info (e.g., Bank Name)" />
                    </fieldset>
                </div>
                
                <textarea name="Note" placeholder="Order Note..." value={formData.Note} rows={3} onChange={handleInputChange} className="form-textarea"></textarea>

                {/* --- Totals --- */}
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center p-4 bg-gray-900/50 rounded-lg">
                    <div><strong className="text-gray-400 block">Subtotal</strong>${formData.Subtotal.toFixed(2)}</div>
                    <div><strong className="text-gray-400 block">Total Cost</strong>${(formData['Total Product Cost ($)'] + formData['Internal Cost']).toFixed(2)}</div>
                    <div><strong className="text-lg text-blue-300 block">Grand Total</strong><span className="text-xl font-bold">${formData['Grand Total'].toFixed(2)}</span></div>
                    <div><strong className="text-lg text-green-400 block">Est. Profit</strong><span className={`text-xl font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>${profit.toFixed(2)}</span></div>
                </div>

                {error && <p className="text-red-400 mt-2 p-3 bg-red-900/50 rounded-md">{error}</p>}

                <div className="flex justify-end pt-4 space-x-4 border-t border-gray-700 mt-6">
                    <button type="button" onClick={onCancel} className="btn btn-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? <Spinner size="sm" /> : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditOrderPage;
