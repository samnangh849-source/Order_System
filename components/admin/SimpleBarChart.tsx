
import React, { useState } from 'react';

interface ChartData {
    label: string;
    value: number;
    [key: string]: any;
}

interface SimpleBarChartProps {
    data: ChartData[];
    title: string;
}

const SimpleBarChart: React.FC<SimpleBarChartProps> = ({ data, title }) => {
    const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; content: string } | null>(null);

    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 min-h-[300px]">
                No data available for chart.
            </div>
        );
    }
    
    const chartHeight = 300;
    const chartWidth = 500; // SVG width, it will scale
    const yAxisWidth = 50;
    const xAxisHeight = 40;
    const barPadding = 10;
    const barWidth = (chartWidth / data.length) - barPadding;
    const maxValue = Math.max(...data.map(d => d.value), 0);
    const yScale = maxValue === 0 ? 0 : (chartHeight - 10) / maxValue; // -10 to avoid hitting the top

    const handleMouseOver = (e: React.MouseEvent, d: ChartData) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const content = `${d.label}: $${d.value.toFixed(2)}`;
        // Position tooltip relative to the bar
        setTooltip({ visible: true, x: rect.left + window.scrollX, y: rect.top + window.scrollY, content });
    };

    const handleMouseOut = () => {
        setTooltip(null);
    };

    const formatLabel = (label: string) => {
        if (label.length > 15 && data.length > 5) {
            return label.substring(0, 12) + '...';
        }
        return label;
    }

    // Function to generate nice ticks for the Y-axis
    const getTicks = (max: number) => {
        if (max === 0) return [0];
        const numTicks = 5;
        const interval = Math.ceil(max / numTicks / 10) * 10;
        if (interval === 0) return [0, max];
        return Array.from({ length: numTicks + 1 }, (_, i) => i * interval).filter(tick => tick <= max * 1.1);
    }
    const yTicks = getTicks(maxValue);

    return (
        <div className="relative">
            <h3 className="text-lg font-bold mb-4 text-white text-center">{title}</h3>
            <div className="w-full overflow-x-auto">
                <svg viewBox={`0 -10 ${chartWidth + yAxisWidth} ${chartHeight + xAxisHeight + 10}`} className="min-w-[500px]" preserveAspectRatio="xMinYMin meet">
                    {/* Y-Axis and Grid Lines */}
                    <g className="y-axis">
                        {yTicks.map(tick => (
                            <g key={tick} transform={`translate(0, ${chartHeight - (tick * yScale)})`}>
                                <line x1={yAxisWidth - 5} y1="0" x2={chartWidth + yAxisWidth} y2="0" stroke="#374151" />
                                <text x={yAxisWidth - 10} y="3" textAnchor="end" fill="#9ca3af" fontSize="12">
                                    {tick >= 1000 ? `${(tick/1000).toFixed(0)}k` : tick}
                                </text>
                            </g>
                        ))}
                    </g>
                    
                    {/* Bars and X-Axis Labels */}
                    <g className="bars" transform={`translate(${yAxisWidth}, 0)`}>
                        {data.map((d, i) => {
                            const barHeight = d.value * yScale;
                            const xPos = i * (barWidth + barPadding);
                            return (
                                <g key={i}>
                                    <rect
                                        x={xPos}
                                        y={chartHeight - barHeight}
                                        width={barWidth}
                                        height={barHeight}
                                        fill="#3b82f6"
                                        className="transition-all duration-300 hover:opacity-80"
                                        onMouseOver={(e) => handleMouseOver(e, d)}
                                        onMouseOut={handleMouseOut}
                                    />
                                    <text
                                        x={xPos + barWidth / 2}
                                        y={chartHeight + 20}
                                        textAnchor="middle"
                                        fill="#9ca3af"
                                        fontSize="12"
                                        className="select-none"
                                    >
                                        {formatLabel(d.label)}
                                    </text>
                                </g>
                            );
                        })}
                    </g>
                </svg>
            </div>
            {tooltip && (
                <div
                    className="fixed p-2 text-xs text-white bg-gray-900 border border-gray-600 rounded-md shadow-lg z-50"
                    style={{
                        left: tooltip.x,
                        top: tooltip.y - 35, // Position above cursor
                        pointerEvents: 'none',
                        transform: 'translateX(-50%)',
                    }}
                >
                    {tooltip.content}
                </div>
            )}
        </div>
    );
};

export default SimpleBarChart;
