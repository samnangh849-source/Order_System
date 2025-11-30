import React from 'react';

interface RoleSelectionPageProps {
    onSelect: (role: 'admin_dashboard' | 'user_journey') => void;
}

const RoleSelectionPage: React.FC<RoleSelectionPageProps> = ({ onSelect }) => {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 animate-fade-in bg-gradient-to-br from-gray-900 to-gray-800">
             <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fade-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
                .role-card {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .role-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
                    border-color: #3b82f6;
                }
            `}</style>
            
            <div className="text-center mb-12">
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">ជ្រើសរើសតួនាទី</h1>
                <p className="text-gray-400">សូមជ្រើសរើសប្រភេទគណនីដែលអ្នកចង់ចូលប្រើប្រាស់</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
                {/* Admin Card */}
                <button 
                    onClick={() => onSelect('admin_dashboard')} 
                    className="role-card group bg-gray-800/50 backdrop-blur-sm border-2 border-gray-700 rounded-2xl p-8 text-left flex flex-col items-center sm:items-start"
                >
                    <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors duration-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-400 group-hover:text-white transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">ចូលផ្ទាំង Admin</h2>
                    <p className="text-gray-400 text-sm leading-relaxed text-center sm:text-left">
                        គ្រប់គ្រងប្រព័ន្ធទាំងមូល មើលរបាយការណ៍ គ្រប់គ្រងអ្នកប្រើប្រាស់ និងការកំណត់ផ្សេងៗ។
                    </p>
                </button>

                {/* User Card */}
                <button 
                    onClick={() => onSelect('user_journey')} 
                    className="role-card group bg-gray-800/50 backdrop-blur-sm border-2 border-gray-700 rounded-2xl p-8 text-left flex flex-col items-center sm:items-start"
                >
                    <div className="w-16 h-16 bg-green-600/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-green-600 transition-colors duration-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-400 group-hover:text-white transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">ចូលជា User</h2>
                    <p className="text-gray-400 text-sm leading-relaxed text-center sm:text-left">
                        បង្កើតការកម្មង់ថ្មី ពិនិត្យមើលប្រវត្តិការលក់ និងគ្រប់គ្រងការងារប្រចាំថ្ងៃរបស់អ្នក។
                    </p>
                </button>
            </div>
        </div>
    );
};

export default RoleSelectionPage;