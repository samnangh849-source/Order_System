import React from 'react';

interface BottomNavBarProps {
    currentView: string;
    onViewChange: (view: any) => void;
    viewConfig: any;
}

const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentView, onViewChange, viewConfig }) => {
    return (
        <nav className="bottom-nav md:hidden">
            {(Object.keys(viewConfig)).map(view => {
                const { label, icon } = viewConfig[view];
                return (
                    <a
                        href="#"
                        key={view}
                        onClick={(e) => { e.preventDefault(); onViewChange(view); }}
                        className={currentView === view ? 'active' : ''}
                    >
                        {icon}
                        <span className="label">{label}</span>
                    </a>
                );
            })}
        </nav>
    );
};

export default BottomNavBar;
