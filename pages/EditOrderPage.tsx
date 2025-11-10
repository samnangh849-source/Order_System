import React, { useState, useContext } from 'react';
import { AppContext } from '../App';
import Spinner from '../components/common/Spinner';
import { ParsedOrder } from '../types';
import { WEB_APP_URL } from '../constants';


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
        // This is a simplified handler. A real implementation would handle nested state.
        // For example, name="Customer Name" would need special parsing.
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // TODO: Implement backend call to POST /api/admin/update-order
            console.log("Saving order data:", formData);
            // This is a placeholder for the API call. It's expected to fail.
            const response = await fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                 const res = await response.json().catch(() => ({ message: 'Failed to update order. The server responded with an error.' }));
                 throw new Error(res.message);
            }
            
            await refreshData(); // Refresh all app data to get changes
            onSave(formData); // Pass updated data back
            
        } catch (err: any) {
            console.error("Update Error:", err);
            // Provide a user-friendly message indicating the feature is not ready
            setError(`មុខងារកែសម្រួលមិនទាន់រួចរាល់នៅឡើយទេ។ Backend endpoint '/api/admin/update-order' is needed. (${err.message})`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full">
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Form fields will be here */}
                <div className="text-center p-8 border-2 border-dashed border-gray-600 rounded-lg bg-gray-800/50">
                    <p className="text-gray-300 font-semibold text-lg">ទម្រង់កែសម្រួលលម្អិត</p>
                    <p className="text-sm text-gray-400 mt-2">Detailed form fields for customer, products, shipping, and payment would be implemented here.</p>
                </div>

                {error && <p className="text-red-400 mt-2 p-3 bg-red-900/50 rounded-md">{error}</p>}

                <div className="flex justify-end pt-4 space-x-4">
                    <button type="button" onClick={onCancel} className="btn btn-secondary">បោះបង់</button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? <Spinner size="sm" /> : 'រក្សាទុកការផ្លាស់ប្តូរ'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditOrderPage;
