import React from 'react';

interface GaugeChartProps {
    value: number; // A percentage value from 0 to 100+
    label?: string;
}

const GaugeChart: React.FC<GaugeChartProps> = ({ value, label }) => {
    const clampedValue = Math.max(0, value);
    const percentage = clampedValue / 100;
    
    const radius = 80;
    const strokeWidth = 20;
    const innerRadius = radius - strokeWidth / 2;
    const circumference = 2 * Math.PI * innerRadius;
    const arc = circumference * 0.75; // 270 degrees arc
    const strokeDashoffset = arc * (1 - Math.min(percentage, 1)); // Cap visual at 100%

    const getColor = () => {
        if (clampedValue < 50) return "#ef4444"; // Red
        if (clampedValue < 90) return "#f59e0b"; // Amber
        return "#22c55e"; // Green
    };
    const color = getColor();
    
    return (
        <svg viewBox="0 0 200 165" width="100%" height="100%">
            <defs>
                <linearGradient id={`gradient-${color.replace("#","")}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.7" />
                    <stop offset="100%" stopColor={color} />
                </linearGradient>
            </defs>
            {/* Background Arc */}
            <path
                d={`M 30 130 A ${innerRadius} ${innerRadius} 0 1 1 170 130`}
                fill="none"
                stroke="#374151"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />
            {/* Value Arc */}
             <path
                d={`M 30 130 A ${innerRadius} ${innerRadius} 0 1 1 170 130`}
                fill="none"
                stroke={`url(#gradient-${color.replace("#","")})`}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={arc}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
            />
            {/* Text */}
            <text x="100" y="100" textAnchor="middle" dy="0.3em" className="gauge-chart-value" fill={color}>
                {`${clampedValue.toFixed(1)}%`}
            </text>
            {label && (
                <text x="100" y="125" textAnchor="middle" className="gauge-chart-label">
                    {label}
                </text>
            )}
        </svg>
    );
};

export default GaugeChart;
