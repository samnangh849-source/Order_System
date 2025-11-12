
import React from 'react';
import Modal from './Modal';

interface DataErrorModalProps {
    error: { message: string; title: string; critical: boolean };
    onRetry: () => void;
    onContinue?: () => void;
    onLogout?: () => void;
}

const DataErrorModal: React.FC<DataErrorModalProps> = ({ error, onRetry, onContinue, onLogout }) => {
    return (
        // The base Modal is set to not close on overlay click by passing a no-op function.
        // Critical modals should not be easily dismissible.
        <Modal isOpen={true} onClose={() => {}} maxWidth="max-w-lg">
            <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-900/50">
                    <svg className="h-10 w-10 text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h3 className="mt-4 text-2xl font-bold text-white">{error.title}</h3>
                <div className="mt-4 text-gray-300 whitespace-pre-wrap text-left bg-gray-900/50 p-4 rounded-md border border-gray-700">
                    <p className="text-sm">{error.message}</p>
                </div>
                <div className="mt-6 flex justify-center space-x-4">
                    <button onClick={onRetry} className="btn btn-primary">
                        ព្យាយាមម្តងទៀត (Try Again)
                    </button>
                    {error.critical && onLogout && (
                        <button onClick={onLogout} className="btn btn-secondary">
                            ចាកចេញ (Logout)
                        </button>
                    )}
                    {!error.critical && onContinue && (
                        <button onClick={onContinue} className="btn btn-secondary">
                            បន្តជាមួយទិន្នន័យចាស់ (Continue with Old Data)
                        </button>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default DataErrorModal;
