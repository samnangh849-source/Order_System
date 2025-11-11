
import React from 'react';

interface RoleSelectionPageProps {
    onSelect: (role: 'admin_dashboard' | 'user_journey') => void;
}

const RoleSelectionPage: React.FC<RoleSelectionPageProps> = ({ onSelect }) => {
    return (
        <div className="w-full max-w-md mx-auto animate-fade-in">
             <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
            `}</style>
            <div className="page-card text-center">
                <h1 className="text-2xl sm:text-3xl font-bold mb-8 text-white">ជ្រើសរើសតួនាទី</h1>
                <div className="space-y-4">
                    <button onClick={() => onSelect('admin_dashboard')} className="selection-button">
                        ចូលផ្ទាំង Admin
                    </button>
                    <button onClick={() => onSelect('user_journey')} className="selection-button">
                        ចូលជា User
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RoleSelectionPage;