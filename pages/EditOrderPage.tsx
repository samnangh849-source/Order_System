import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../App';
import Spinner from '../components/common/Spinner';
import { ParsedOrder, Product, MasterProduct } from '../types';
import { WEB_APP_URL } from '../constants';
import SearchableProductDropdown from '../components/common/SearchableProductDropdown';

interface EditOrderPageProps {
    order: ParsedOrder;
    onSave: (updatedOrder: ParsedOrder) => void;
    onCancel: () => void;
}

const EditOrderPage: React.FC<EditOrderPageProps> = ({ order, onSave, onCancel }) => {
    const { appData, refreshData, currentUser } = useContext(AppContext);
    const [formData, setFormData] = useState<ParsedOrder>(order);
    const [loading, setLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState('');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updatedState = { ...prev, [name]: value };
    
            // If shipping fee changes, we must recalculate totals in the same update.
            if (name === 'Shipping Fee (Customer)') {
                const newTotals = recalculateTotals(updatedState.Products, Number(value) || 0);
                return { ...updatedState, ...newTotals };
            }
            
            // For other inputs, just update the value.
            return updatedState;
        });
    };

    const recalculateTotals = (products: Product[], shippingFee: number): Partial<ParsedOrder> => {
        const subtotal = products.reduce((sum, p) => sum + (p.total || 0), 0);
        const grandTotal = subtotal + (Number(shippingFee) || 0);
        const totalProductCost = products.reduce((sum, p) => sum + ((p.cost || 0) * (p.quantity || 0)), 0);
        
        return {
            'Subtotal': subtotal,
            'Grand Total': grandTotal,
            'Total Product Cost ($)': totalProductCost,
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

            const newTotals = recalculateTotals(newProducts, Number(prev['Shipping Fee (Customer)']) || 0);
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
            const newTotals = recalculateTotals(newProducts, Number(prev['Shipping Fee (Customer)']) || 0);
            return { ...prev, Products: newProducts, ...newTotals };
        });
    };
    
    const handleDelete = async () => {
        if (!window.confirm(`តើអ្នកពិតជាចង់លុបប្រតិបត្តិការណ៍ ID: ${formData['Order ID']} មែនទេ? \n\nសកម្មភាពនេះមិនអាចមិនធ្វើវិញបានទេ។`)) {
            return;
        }

        if (!currentUser) {
            setError('Could not identify current user. Please log in again.');
            return;
        }

        setIsDeleting(true);
        setError('');

        const payload = {
            orderId: formData['Order ID'],
            team: formData.Team,
            userName: currentUser.UserName,
        };

        try {
            const response = await fetch(`${WEB_APP_URL}/api/admin/delete-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                let errorMessage = `Failed to delete. Server responded with status ${response.status}.`;
                try {
                    const errorResult = await response.json();
                    errorMessage = errorResult.message || JSON.stringify(errorResult);
                } catch (e) {
                    const textError = await response.text();
                    if (textError) {
                        errorMessage = textError;
                    }
                }
                throw new Error(errorMessage);
            }
            
            await refreshData();
            onSave(formData);
            
        } catch (err: any) {
            console.error("Delete Error:", err);
            setError(`Delete failed: ${err.message}`);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (!currentUser) {
            setError('Could not identify current user. Please log in again.');
            setLoading(false);
            return;
        }

        const changes: Record<string, any> = {};

        // Compare simple fields and add to changes if they are different
        const fieldsToCompare: (keyof ParsedOrder)[] = [
            'Customer Name', 'Customer Phone', 'Location', 'Address Details', 'Note',
            'Shipping Fee (Customer)', 'Internal Shipping Method',
            'Internal Shipping Details', 'Internal Cost', 'Payment Status', 'Payment Info'
        ];
        
        fieldsToCompare.forEach(key => {
            const originalValue = order[key];
            let formValue = formData[key];
            // Coerce to number if original is a number for accurate comparison
            if (typeof originalValue === 'number') {
                formValue = Number(formValue);
            }
            if (originalValue !== formValue) {
                changes[key] = formValue;
            }
        });
        
        // Clean and compare products array
        const cleanProduct = (p: Product) => ({
            name: p.name,
            quantity: Number(p.quantity),
            originalPrice: Number(p.originalPrice),
            finalPrice: Number(p.finalPrice),
            total: Number(p.total),
            discountPercent: Number(p.discountPercent),
            colorInfo: p.colorInfo,
            image: p.image,
            cost: Number(p.cost)
        });

        const originalProductsJSON = JSON.stringify(order.Products.map(cleanProduct));
        const newProductsJSON = JSON.stringify(formData.Products.map(cleanProduct));

        if (originalProductsJSON !== newProductsJSON) {
            changes['Products (JSON)'] = newProductsJSON;
            // When products change, totals must also be considered changed.
            const newTotals = recalculateTotals(formData.Products, Number(formData['Shipping Fee (Customer)']) || 0);
            changes['Subtotal'] = newTotals.Subtotal;
            changes['Grand Total'] = newTotals['Grand Total'];
            changes['Total Product Cost ($)'] = newTotals['Total Product Cost ($)'];
        }

        if (Object.keys(changes).length === 0) {
            setError("No changes were made.");
            setLoading(false);
            setTimeout(() => setError(''), 3000);
            return;
        }
        
        const payload = {
            orderId: formData['Order ID'],
            team: formData.Team,
            userName: currentUser.UserName,
            newData: changes
        };

        try {
            const response = await fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!response.ok || result.status !== 'success') {
                 throw new Error(result.message || 'Failed to update order. The server responded with an error.');
            }
            
            await refreshData();
            onSave(formData); // Pass the full updated form data back to the parent
            
        } catch (err: any) {
            console.error("Update Error:", err);
            setError(`Update failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };
    
    const profit = (Number(formData['Grand Total']) || 0) - (Number(formData['Total Product Cost ($)']) || 0) - (Number(formData['Internal Cost']) || 0);

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
                    <div><strong className="text-gray-400 block">Subtotal</strong>${(Number(formData.Subtotal) || 0).toFixed(2)}</div>
                    <div><strong className="text-gray-400 block">Total Cost</strong>${((Number(formData['Total Product Cost ($)']) || 0) + (Number(formData['Internal Cost']) || 0)).toFixed(2)}</div>
                    <div><strong className="text-lg text-blue-300 block">Grand Total</strong><span className="text-xl font-bold">${(Number(formData['Grand Total']) || 0).toFixed(2)}</span></div>
                    <div><strong className="text-lg text-green-400 block">Est. Profit</strong><span className={`text-xl font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>${profit.toFixed(2)}</span></div>
                </div>

                {error && <p className="text-red-400 mt-2 p-3 bg-red-900/50 rounded-md">{error}</p>}

                <div className="flex justify-between items-center pt-4 space-x-4 border-t border-gray-700 mt-6">
                    <button 
                        type="button" 
                        onClick={handleDelete} 
                        className="btn !bg-red-600/80 hover:!bg-red-700 text-white"
                        disabled={loading || isDeleting}
                    >
                        {isDeleting ? <Spinner size="sm" /> : 'លុបប្រតិបត្តិការណ៍'}
                    </button>
                    <div className="flex space-x-4">
                        <button type="button" onClick={onCancel} className="btn btn-secondary" disabled={loading || isDeleting}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading || isDeleting}>
                            {loading ? <Spinner size="sm" /> : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default EditOrderPage;