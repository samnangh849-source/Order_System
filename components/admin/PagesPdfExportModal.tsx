import React, { useState, useMemo, useEffect } from 'react';
import Modal from '../common/Modal';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { TeamPage } from '../../types';
import { imageUrlToBase64 } from '../../utils/fileUtils';
import Spinner from '../common/Spinner';

// Extend jsPDF type to include autoTable
interface jsPDFWithAutoTable extends jsPDF {
    autoTable: (options: any) => void;
    lastAutoTable?: { finalY: number };
}

interface PagesPdfExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    pages: TeamPage[];
}

type PageSize = 'a4' | 'a3' | 'letter' | 'legal' | '1080p';
type Orientation = 'portrait' | 'landscape';
type LayoutType = 'list' | 'grid';
type FontWeight = 'bold' | 'normal';

const PagesPdfExportModal: React.FC<PagesPdfExportModalProps> = ({ isOpen, onClose, pages }) => {
    const [pageSize, setPageSize] = useState<PageSize>('a4');
    const [orientation, setOrientation] = useState<Orientation>('landscape');
    const [layout, setLayout] = useState<LayoutType>('list');
    const [pageNameFontWeight, setPageNameFontWeight] = useState<FontWeight>('bold');
    
    // Layout Configurations
    const [itemsPerTeamRow, setItemsPerTeamRow] = useState<number>(1); 
    const [teamsPerRow, setTeamsPerRow] = useState<number>(3); 
    const [singleSheet, setSingleSheet] = useState<boolean>(true);
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);

    // Column Visibility State
    const [columns, setColumns] = useState({
        pageName: true,
        telegramValue: true,
        logoUrl: false,
        logoImage: true,
    });

    const [selectedPageNames, setSelectedPageNames] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (pages && pages.length > 0 && selectedPageNames.size === 0) {
            setSelectedPageNames(new Set(pages.map(p => p.PageName)));
        }
    }, [pages]);

    // Intelligent defaults when switching layout types
    useEffect(() => {
        if (layout === 'list') {
            setItemsPerTeamRow(1);
        } else {
            setItemsPerTeamRow(3);
        }
    }, [layout]);

    const pagesByTeam = useMemo(() => {
        const groups: Record<string, TeamPage[]> = {};
        if (!pages) return groups;
        pages.forEach(p => {
            const team = p.Team || 'Unassigned';
            if (!groups[team]) groups[team] = [];
            groups[team].push(p);
        });
        return groups;
    }, [pages]);

    const toggleColumn = (key: keyof typeof columns) => {
        setColumns(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const togglePageSelection = (pageName: string) => {
        setSelectedPageNames(prev => {
            const newSet = new Set(prev);
            if (newSet.has(pageName)) newSet.delete(pageName);
            else newSet.add(pageName);
            return newSet;
        });
    };

    const toggleTeamSelection = (teamName: string, teamPages: TeamPage[]) => {
        const allSelected = teamPages.every(p => selectedPageNames.has(p.PageName));
        setSelectedPageNames(prev => {
            const newSet = new Set(prev);
            teamPages.forEach(p => {
                if (allSelected) newSet.delete(p.PageName);
                else newSet.add(p.PageName);
            });
            return newSet;
        });
    };

    const handleSelectAll = (select: boolean) => {
        if (select) {
            setSelectedPageNames(new Set(pages.map(p => p.PageName)));
        } else {
            setSelectedPageNames(new Set());
        }
    };

    const generatePDF = async () => {
        if (selectedPageNames.size === 0) {
            alert("Please select at least one page.");
            return;
        }

        setIsGenerating(true);
        setProgress(0);

        try {
            // 1. Data Preparation
            const finalPages = pages.filter(p => selectedPageNames.has(p.PageName));
            const groupedForPdf: Record<string, TeamPage[]> = {};
            finalPages.forEach(p => {
                const team = p.Team || 'Unassigned';
                if (!groupedForPdf[team]) groupedForPdf[team] = [];
                groupedForPdf[team].push(p);
            });

            // 2. Image Pre-loading
            const imageMap: Record<string, string> = {};
            let processedCount = 0;
            const totalCount = finalPages.length;

            const imagePromises = finalPages.map(async (page) => {
                if (page.PageLogoURL && columns.logoImage) {
                    try {
                        const base64 = await imageUrlToBase64(page.PageLogoURL);
                        if (base64) imageMap[page.PageName] = base64;
                    } catch (e) {
                        console.warn(`Failed to load image for ${page.PageName}`);
                    }
                }
                processedCount++;
                setProgress(Math.round((processedCount / totalCount) * 100));
            });
            
            await Promise.all(imagePromises);

            // 3. Document Dimensions & Scaling
            let unit: 'mm' | 'px' = 'mm';
            let width = 210;
            let height = 297;
            let scale = 1;

            if (pageSize === '1080p') {
                unit = 'px';
                if (orientation === 'landscape') { width = 1920; height = 1080; } 
                else { width = 1080; height = 1920; }
                scale = 4.5; 
            } else {
                if (pageSize === 'a3') { width = 297; height = 420; }
                else if (pageSize === 'letter') { width = 215.9; height = 279.4; }
                else if (pageSize === 'legal') { width = 215.9; height = 355.6; }
                
                if (orientation === 'landscape') { [width, height] = [height, width]; }
            }

            // 4. Layout Constants & Centering Logic
            const headerHeight = 35 * scale;
            const teamGap = 10 * scale; 
            const itemGap = 5 * scale;
            
            const minMargin = 10 * scale; 
            const maxContentWidth = width - (minMargin * 2);
            
            const teamColWidth = Math.floor((maxContentWidth - ((teamsPerRow - 1) * teamGap)) / teamsPerRow);
            const actualTotalContentWidth = (teamColWidth * teamsPerRow) + (teamGap * (teamsPerRow - 1));
            
            const startX = (width - actualTotalContentWidth) / 2;

            const innerItemWidth = (teamColWidth - ((itemsPerTeamRow - 1) * itemGap)) / itemsPerTeamRow;

            // Height Constants - dynamic based on content
            const gridRowHeight = (nameLength: number) => {
                if (nameLength > 40) return 120 * scale;
                else if (nameLength > 30) return 110 * scale;
                else if (nameLength > 20) return 100 * scale;
                else if (nameLength > 15) return 90 * scale;
                else return 85 * scale;
            };
            
            const listRowHeight = 30 * scale; 
            const autoTableRowHeight = 16 * scale;
            const teamHeaderHeight = 22 * scale;

            // Helper to calculate the height of a specific team block
            const calculateTeamBlockHeight = (items: TeamPage[]) => {
                let h = teamHeaderHeight + (10 * scale); // Header + padding
                
                if (layout === 'list' && itemsPerTeamRow === 1) {
                    h += (15 * scale); // Table Header
                    h += (items.length * autoTableRowHeight); 
                } else {
                    const rows = Math.ceil(items.length / itemsPerTeamRow);
                    
                    // Calculate max name length in this team
                    const maxNameLength = items.reduce((max, page) => {
                        return Math.max(max, page.PageName?.length || 0);
                    }, 0);
                    
                    const rowH = layout === 'grid' ? gridRowHeight(maxNameLength) : listRowHeight;
                    h += (rows * (rowH + itemGap));
                }
                return h;
            };

            const sortedTeamNames = Object.keys(groupedForPdf).sort();

            // 5. Single Sheet Height Calculation
            let finalDocHeight = height;
            if (singleSheet) {
                let totalContentHeight = headerHeight + minMargin;
                
                for (let i = 0; i < sortedTeamNames.length; i += teamsPerRow) {
                    const rowTeams = sortedTeamNames.slice(i, i + teamsPerRow);
                    let maxRowHeight = 0;
                    rowTeams.forEach(team => {
                        const h = calculateTeamBlockHeight(groupedForPdf[team]);
                        if (h > maxRowHeight) maxRowHeight = h;
                    });
                    totalContentHeight += maxRowHeight + teamGap;
                }
                
                totalContentHeight += minMargin;
                finalDocHeight = Math.max(height, totalContentHeight);
            }

            // 6. Initialize FINAL PDF Instance
            const doc = new jsPDF({
                orientation: orientation,
                unit: unit,
                format: [width, finalDocHeight]
            }) as jsPDFWithAutoTable;

            // 7. IMPROVED PERFECT FIT TEXT HELPER - ALWAYS SHOW FULL TEXT
            const drawPerfectFitText = (
                text: string, 
                centerX: number, 
                y: number, 
                maxWidth: number, 
                maxFontSize: number, 
                fontStyle: string = 'bold',
                align: 'center' | 'left' = 'center',
                color: number[] = [0,0,0],
                allowWrap: boolean = false // អនុញ្ញាតអោយអត្ថបទចុះបន្ទាត់
            ) => {
                doc.setFont("helvetica", fontStyle);
                doc.setTextColor(color[0], color[1], color[2]);

                let displayText = text || '';
                let finalFontSize = maxFontSize;
                
                // រកទំហំអក្សរដែលល្អបំផុតសម្រាប់អត្ថបទពេញលេញ
                doc.setFontSize(finalFontSize);
                let textWidth = doc.getTextWidth(displayText);
                
                // បន្ថយទំហំអក្សររហូតដល់អត្ថបទសមនឹងទទឹង
                while (textWidth > maxWidth && finalFontSize > 4 * scale) {
                    finalFontSize -= 0.5 * scale;
                    doc.setFontSize(finalFontSize);
                    textWidth = doc.getTextWidth(displayText);
                }
                
                // ប្រសិនបើទំហំអក្សរតូចពេក អនុញ្ញាតអោយអត្ថបទចុះបន្ទាត់
                if (finalFontSize <= 5 * scale && allowWrap) {
                    // បែងចែកអត្ថបទទៅជាពីរបន្ទាត់
                    const words = displayText.split(' ');
                    if (words.length > 1) {
                        const midIndex = Math.floor(words.length / 2);
                        const line1 = words.slice(0, midIndex).join(' ');
                        const line2 = words.slice(midIndex).join(' ');
                        
                        // សាកល្បងទំហំអក្សរសម្រាប់ពីរបន្ទាត់
                        let lineFontSize = maxFontSize;
                        doc.setFontSize(lineFontSize);
                        const line1Width = doc.getTextWidth(line1);
                        const line2Width = doc.getTextWidth(line2);
                        
                        while ((line1Width > maxWidth || line2Width > maxWidth) && lineFontSize > 4 * scale) {
                            lineFontSize -= 0.5 * scale;
                            doc.setFontSize(lineFontSize);
                        }
                        
                        doc.setFontSize(lineFontSize);
                        
                        if (align === 'center') {
                            doc.text(line1, centerX, y - (3 * scale), { align: 'center' });
                            doc.text(line2, centerX, y + (6 * scale), { align: 'center' });
                        } else {
                            doc.text(line1, centerX, y - (3 * scale), { maxWidth });
                            doc.text(line2, centerX, y + (6 * scale), { maxWidth });
                        }
                        return;
                    }
                }
                
                doc.setFontSize(finalFontSize);
                
                if (align === 'center') {
                    doc.text(displayText, centerX, y, { align: 'center' });
                } else {
                    // For left align, ensure text doesn't overflow
                    doc.text(displayText, centerX, y, { maxWidth: allowWrap ? maxWidth : undefined });
                }
            };

            const drawHeader = () => {
                doc.setFontSize(18 * scale);
                doc.setTextColor(40, 40, 40);
                doc.text("Team Pages Report", width / 2, 15 * scale, { align: 'center' });
                doc.setFontSize(10 * scale);
                doc.setTextColor(100, 100, 100);
                doc.text(`Generated: ${new Date().toLocaleString()}`, width / 2, 24 * scale, { align: 'center' });
            };

            // 8. Main Rendering Loop
            drawHeader();
            let currentY = headerHeight + 5 * scale;
            
            for (let i = 0; i < sortedTeamNames.length; i += teamsPerRow) {
                const rowTeams = sortedTeamNames.slice(i, i + teamsPerRow);
                
                let maxRowHeight = 0;
                rowTeams.forEach(team => {
                    const h = calculateTeamBlockHeight(groupedForPdf[team]);
                    if (h > maxRowHeight) maxRowHeight = h;
                });

                if (!singleSheet && currentY + maxRowHeight > finalDocHeight - minMargin) {
                    doc.addPage();
                    drawHeader();
                    currentY = headerHeight + 5 * scale;
                }

                rowTeams.forEach((team, idx) => {
                    const teamX = startX + (idx * (teamColWidth + teamGap));
                    let localY = currentY;
                    const teamPages = groupedForPdf[team];

                    if (idx < rowTeams.length - 1) {
                        doc.setDrawColor(200, 200, 200);
                        doc.setLineWidth(0.5 * scale);
                        const lineX = teamX + teamColWidth + (teamGap / 2);
                        doc.line(lineX, currentY, lineX, currentY + maxRowHeight);
                    }

                    doc.setFillColor(240, 242, 245);
                    doc.setDrawColor(200, 200, 200);
                    doc.roundedRect(teamX, localY, teamColWidth, 12 * scale, 2 * scale, 2 * scale, 'FD');
                    
                    doc.setFontSize(11 * scale);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(30, 64, 175);
                    doc.text(`${team} (${teamPages.length})`, teamX + (4 * scale), localY + (8 * scale));
                    
                    localY += 18 * scale;

                    // --- ITEMS RENDER ---
                    
                    // CASE A: Standard Table (1 col list)
                    if (layout === 'list' && itemsPerTeamRow === 1) {
                        const headRow = [];
                        let colIndexCounter = 0;
                        let pageNameColIndex = -1;

                        if (columns.logoImage) { headRow.push('Logo'); colIndexCounter++; }
                        if (columns.pageName) { headRow.push('Name'); pageNameColIndex = colIndexCounter; colIndexCounter++; }
                        if (columns.telegramValue) { headRow.push('Telegram'); colIndexCounter++; }
                        if (columns.logoUrl) { headRow.push('Logo Link'); colIndexCounter++; }
                        
                        const body = teamPages.map(page => {
                            const row = [];
                            if (columns.logoImage) row.push(''); 
                            if (columns.pageName) row.push(page.PageName || '');
                            if (columns.telegramValue) row.push(page.TelegramValue || '');
                            if (columns.logoUrl) row.push(page.PageLogoURL || '');
                            return row;
                        });

                        doc.autoTable({
                            startY: localY,
                            head: [headRow],
                            body: body,
                            theme: 'grid',
                            styles: { 
                                fontSize: 9 * scale, 
                                cellPadding: 3 * scale,
                                valign: 'middle',
                                minCellHeight: 18 * scale, // Increased min height for wrapping
                                overflow: 'linebreak',
                                cellWidth: 'wrap'
                            },
                            headStyles: { 
                                fillColor: [55, 65, 81], 
                                fontSize: 9 * scale,
                                cellPadding: 3 * scale,
                                textColor: [255, 255, 255],
                                fontStyle: 'bold'
                            },
                            columnStyles: {
                                0: columns.logoImage ? { cellWidth: 22 * scale } : {}, // Increased logo column width
                                ...(pageNameColIndex >= 0 ? {
                                    [pageNameColIndex]: { 
                                        cellWidth: 'auto',
                                        minCellWidth: 50 * scale, // Ensure minimum width for names
                                        fontStyle: pageNameFontWeight // Apply user selected font weight
                                    }
                                } : {})
                            },
                            didDrawCell: (data: any) => {
                                if (columns.logoImage && data.section === 'body' && data.column.index === 0) {
                                    const rowIndex = data.row.index;
                                    const page = teamPages[rowIndex];
                                    if (page && imageMap[page.PageName]) {
                                        try {
                                            const imgDim = 14 * scale; // Increased image size
                                            const xPos = data.cell.x + (data.cell.width - imgDim) / 2;
                                            const yPos = data.cell.y + (data.cell.height - imgDim) / 2;
                                            doc.addImage(`data:image/jpeg;base64,${imageMap[page.PageName]}`, 'JPEG', xPos, yPos, imgDim, imgDim);
                                        } catch (e) {}
                                    }
                                }
                            },
                            margin: { left: teamX },
                            tableWidth: teamColWidth
                        });
                    } 
                    // CASE B: Custom Card Rendering (Grid or Multi-col List)
                    else {
                        const isGrid = layout === 'grid';
                        
                        // Calculate max name length in this team for row height
                        const maxNameLength = teamPages.reduce((max, page) => {
                            return Math.max(max, page.PageName?.length || 0);
                        }, 0);
                        
                        const dynamicGridRowHeight = gridRowHeight(maxNameLength);
                        
                        for (let j = 0; j < teamPages.length; j++) {
                            const page = teamPages[j];
                            const itemColIndex = j % itemsPerTeamRow;
                            const itemRowIndex = Math.floor(j / itemsPerTeamRow);
                            
                            const itemX = teamX + (itemColIndex * (innerItemWidth + itemGap));
                            const itemY = localY + (itemRowIndex * ((isGrid ? dynamicGridRowHeight : listRowHeight) + itemGap));
                            const itemHeight = isGrid ? dynamicGridRowHeight : listRowHeight;
                            const imgSize = isGrid ? (25 * scale) : (16 * scale);

                            doc.setDrawColor(220, 220, 220);
                            doc.setFillColor(255, 255, 255);
                            doc.roundedRect(itemX, itemY, innerItemWidth, itemHeight, 2 * scale, 2 * scale, 'FD');

                            let hasImageDrawn = false;
                            if (columns.logoImage) {
                                if (imageMap[page.PageName]) {
                                    try {
                                        const imgX = isGrid ? itemX + (innerItemWidth - imgSize)/2 : itemX + (4 * scale);
                                        const imgY = isGrid ? itemY + (8 * scale) : itemY + (itemHeight - imgSize)/2;
                                        
                                        // Draw Image Border
                                        doc.setDrawColor(230, 230, 230);
                                        doc.setLineWidth(0.3 * scale);
                                        doc.roundedRect(imgX - (1*scale), imgY - (1*scale), imgSize + (2*scale), imgSize + (2*scale), 1 * scale, 1 * scale, 'S');
                                        
                                        doc.addImage(`data:image/jpeg;base64,${imageMap[page.PageName]}`, 'JPEG', imgX, imgY, imgSize, imgSize);
                                        hasImageDrawn = true;
                                    } catch (e) {}
                                } else if (isGrid) {
                                    // Placeholder circle
                                    doc.setFillColor(240, 240, 240);
                                    doc.setDrawColor(220, 220, 220);
                                    doc.setLineWidth(0.3 * scale);
                                    doc.circle(itemX + innerItemWidth/2, itemY + 8*scale + imgSize/2, imgSize/2, 'FD');
                                    hasImageDrawn = true;
                                }
                            }

                            if (isGrid) {
                                let currentTextY = itemY + (hasImageDrawn ? (imgSize + 12 * scale) : (8 * scale));
                                const maxWidth = innerItemWidth - (10 * scale);
                                const textCenterX = itemX + (innerItemWidth / 2);

                                // Calculate appropriate font size based on name length
                                const nameLength = page.PageName?.length || 0;
                                let nameFontSize = 10 * scale;
                                
                                if (nameLength > 40) nameFontSize = 7 * scale;
                                else if (nameLength > 30) nameFontSize = 8 * scale;
                                else if (nameLength > 20) nameFontSize = 9 * scale;
                                
                                if (columns.pageName) {
                                    const nameY = columns.telegramValue ? currentTextY : (itemY + (itemHeight/2) + (3*scale));
                                    
                                    drawPerfectFitText(
                                        page.PageName || 'Unknown',
                                        textCenterX,
                                        nameY + (4*scale),
                                        maxWidth,
                                        nameFontSize,
                                        pageNameFontWeight, // Use user selected font weight
                                        'center',
                                        [0, 0, 0],
                                        true // Allow text wrapping for long names
                                    );
                                    currentTextY += 16 * scale;
                                }

                                if (columns.telegramValue) {
                                    const telText = page.TelegramValue || '-';
                                    const telY = currentTextY + (2 * scale);
                                    
                                    drawPerfectFitText(
                                        telText,
                                        textCenterX,
                                        telY + (2*scale),
                                        maxWidth,
                                        8 * scale,
                                        'normal',
                                        'center',
                                        [100, 100, 100]
                                    );
                                }

                            } else {
                                // List layout (non-table, multi-column)
                                const contentStartX = itemX + (columns.logoImage ? (imgSize + 8*scale) : 6*scale);
                                const contentWidth = innerItemWidth - (contentStartX - itemX) - (6 * scale);
                                const contentY = itemY + (4 * scale);
                                const contentHeight = itemHeight - (8 * scale);
                                
                                // Calculate text position
                                let textCenterY = contentY + (contentHeight/2);
                                
                                if (columns.pageName) {
                                    const nameY = columns.telegramValue ? (textCenterY - (4*scale)) : textCenterY + (3*scale);
                                    
                                    // Calculate font size based on name length for list layout
                                    const nameLength = page.PageName?.length || 0;
                                    let nameFontSize = 9 * scale;
                                    if (nameLength > 25) nameFontSize = 7 * scale;
                                    else if (nameLength > 15) nameFontSize = 8 * scale;
                                    
                                    drawPerfectFitText(
                                        page.PageName || 'Unknown',
                                        contentStartX,
                                        nameY,
                                        contentWidth,
                                        nameFontSize,
                                        pageNameFontWeight, // Use user selected font weight
                                        'left',
                                        [0, 0, 0],
                                        true // Allow text wrapping for long names
                                    );
                                }
                                
                                if (columns.telegramValue) {
                                    const telY = columns.pageName ? (textCenterY + (10*scale)) : textCenterY + (3*scale);
                                    
                                    drawPerfectFitText(
                                        page.TelegramValue || '',
                                        contentStartX,
                                        telY,
                                        contentWidth,
                                        8 * scale,
                                        'normal',
                                        'left',
                                        [100, 100, 100]
                                    );
                                }
                            }
                        }
                    }
                });

                currentY += maxRowHeight + teamGap;
            }

            const pageCount = doc.getNumberOfPages();
            for(let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8 * scale);
                doc.setTextColor(150, 150, 150);
                doc.text(`Page ${i} of ${pageCount}`, width - minMargin, finalDocHeight - (5 * scale), { align: 'right' });
                
                // Add footer note about text size and font weight
                doc.setFontSize(6 * scale);
                doc.text(`*ឈ្មោះ Page ត្រូវបានបង្ហាញពេញលេញ - អក្សរ: ${pageNameFontWeight === 'bold' ? 'Bold' : 'Normal'}`, 
                    minMargin, finalDocHeight - (5 * scale), { align: 'left' });
            }

            doc.save(`Pages_Report_${layout}_${pageNameFontWeight}_${new Date().toISOString().slice(0, 10)}.pdf`);
            onClose();

        } catch (error) {
            console.error("PDF Generation failed:", error);
            alert("Failed to generate PDF. Check console for details.");
        } finally {
            setIsGenerating(false);
            setProgress(0);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-5xl">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l6-6a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Export Pages to PDF (Full Text Display)
                </h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[70vh] overflow-hidden">
                {/* Left Side: Settings */}
                <div className="space-y-6 overflow-y-auto pr-2 pb-4">
                    
                    {/* 1. PDF Settings */}
                    <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                        <h3 className="text-lg font-semibold text-blue-300 mb-3">ការកំណត់ PDF (Config)</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">ទំហំ (Size)</label>
                                <select value={pageSize} onChange={(e) => setPageSize(e.target.value as PageSize)} className="form-select">
                                    <option value="a4">A4</option>
                                    <option value="a3">A3</option>
                                    <option value="letter">Letter</option>
                                    <option value="legal">Legal</option>
                                    <option value="1080p">1920x1080 (FHD)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">ទិសដៅ</label>
                                <select value={orientation} onChange={(e) => setOrientation(e.target.value as Orientation)} className="form-select">
                                    <option value="landscape">ប្ដេក (Landscape)</option>
                                    <option value="portrait">បញ្ឈរ (Portrait)</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="flex items-center space-x-3 cursor-pointer p-2 bg-gray-900/50 rounded hover:bg-gray-700/50 border border-gray-600/50">
                                    <input type="checkbox" checked={singleSheet} onChange={(e) => setSingleSheet(e.target.checked)} className="form-checkbox h-5 w-5 text-blue-500 rounded bg-gray-800 border-gray-500" />
                                    <span className="text-gray-200 text-sm">ដាក់ទិន្នន័យទាំងអស់ក្នុង ១ សន្លឹក (Single Sheet)</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* 2. Layout Settings */}
                    <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                        <h3 className="text-lg font-semibold text-blue-300 mb-3">រូបរាង (Layout)</h3>
                        
                        <div className="mb-4">
                            <label className="block text-sm text-gray-400 mb-2">ទម្រង់បង្ហាញ Page (Page Style):</label>
                            <div className="flex bg-gray-900 rounded p-1">
                                <button onClick={() => setLayout('list')} className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${layout === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>បញ្ជី (List)</button>
                                <button onClick={() => setLayout('grid')} className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${layout === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>ក្រឡា (Grid)</button>
                            </div>
                        </div>

                        {/* 2.1 Font Weight Setting */}
                        <div className="mb-4">
                            <label className="block text-sm text-gray-400 mb-2">ទម្ងន់អក្សរឈ្មោះ Page (Font Weight):</label>
                            <div className="flex bg-gray-900 rounded p-1">
                                <button 
                                    onClick={() => setPageNameFontWeight('bold')} 
                                    className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${pageNameFontWeight === 'bold' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Bold
                                </button>
                                <button 
                                    onClick={() => setPageNameFontWeight('normal')} 
                                    className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${pageNameFontWeight === 'normal' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Normal
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                {pageNameFontWeight === 'bold' 
                                    ? "✓ អក្សរ Bold - ងាយមើល ប៉ុន្តែអាចយកទីធំជាង" 
                                    : "✓ អក្សរ Normal - សន្សំទីត្បូង អាចមើលឃើញច្រើនជាង"}
                            </p>
                        </div>

                        {/* Tips Box */}
                        <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700/50 rounded text-sm mb-4">
                            <p className="text-blue-300 font-medium mb-1">✨ លក្ខណៈពិសេសថ្មី:</p>
                            <ul className="text-gray-300 text-xs list-disc pl-4 space-y-1">
                                <li>ឈ្មោះ Page ត្រូវបានបង្ហាញពេញលេញ (គ្មានការកាត់ឃ្លា)</li>
                                <li>អាចកំណត់ទម្ងន់អក្សរជា Bold ឬ Normal</li>
                                <li>ទំហំអក្សរប្រែប្រួលដោយស្វ័យប្រវត្តិ</li>
                                <li>ឈ្មោះវែងអាចចុះបន្ទាត់ជាពីរជួរ</li>
                            </ul>
                        </div>

                        {/* Teams Per Row Slider */}
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm text-yellow-400 font-medium">ចំនួនក្រុមក្នុង ១ ជួរ (Teams per Row):</label>
                                <span className="text-xl font-bold text-white bg-blue-900 px-2 rounded">{teamsPerRow}</span>
                            </div>
                            <input 
                                type="range" min="1" max="4" 
                                value={teamsPerRow} 
                                onChange={(e) => setTeamsPerRow(Number(e.target.value))} 
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1"><span>1</span><span>2</span><span>3</span><span>4</span></div>
                            <p className="text-xs text-gray-500 mt-1">* ក្រុមនីមួយៗនឹងមានបន្ទាត់ខណ្ឌចែក</p>
                        </div>

                        {/* Items Per Row Slider */}
                        <div className="mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm text-gray-400">ចំនួន Page ក្នុង ១ ជួរ (Inside Team):</label>
                                <span className="text-white font-bold">{itemsPerTeamRow}</span>
                            </div>
                            <input 
                                type="range" min="1" max="6" 
                                value={itemsPerTeamRow} 
                                onChange={(e) => setItemsPerTeamRow(Number(e.target.value))} 
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1"><span>1 (Table)</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span></div>
                            <p className="text-xs text-gray-400 mt-2">
                                {itemsPerTeamRow === 1 && layout === 'list' 
                                    ? "✓ ទម្រង់តារាង - ល្អសម្រាប់ឈ្មោះវែង" 
                                    : itemsPerTeamRow > 4 
                                    ? "⚠ អាចធ្វើអោយទំហំអក្សរតូចពេក" 
                                    : "✓ ទំហំល្មមសម្រាប់អត្ថបទពេញលេញ"}
                            </p>
                        </div>
                    </div>

                    {/* 3. Data Visibility Settings */}
                    <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                        <h3 className="text-lg font-semibold text-blue-300 mb-3">ជ្រើសរើសទិន្នន័យ (Data Selection)</h3>
                        <div className="space-y-2">
                            <label className="flex items-center space-x-2 cursor-pointer p-1.5 hover:bg-gray-700 rounded">
                                <input type="checkbox" checked={columns.logoImage} onChange={() => toggleColumn('logoImage')} className="form-checkbox h-4 w-4 text-blue-500 rounded bg-gray-900 border-gray-500" />
                                <span className="text-sm text-gray-200">រូបភាព Logo (Logo Image)</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer p-1.5 hover:bg-gray-700 rounded">
                                <input type="checkbox" checked={columns.pageName} onChange={() => toggleColumn('pageName')} className="form-checkbox h-4 w-4 text-blue-500 rounded bg-gray-900 border-gray-500" />
                                <span className="text-sm text-gray-200">ឈ្មោះ Page (Page Name)</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer p-1.5 hover:bg-gray-700 rounded">
                                <input type="checkbox" checked={columns.telegramValue} onChange={() => toggleColumn('telegramValue')} className="form-checkbox h-4 w-4 text-blue-500 rounded bg-gray-900 border-gray-500" />
                                <span className="text-sm text-gray-200">Telegram Value</span>
                            </label>
                            {layout === 'list' && itemsPerTeamRow === 1 && (
                                <label className="flex items-center space-x-2 cursor-pointer p-1.5 hover:bg-gray-700 rounded">
                                    <input type="checkbox" checked={columns.logoUrl} onChange={() => toggleColumn('logoUrl')} className="form-checkbox h-4 w-4 text-blue-500 rounded bg-gray-900 border-gray-500" />
                                    <span className="text-sm text-gray-200">Logo Link (URL)</span>
                                </label>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Side: Page Selection */}
                <div className="bg-gray-800/50 rounded-lg border border-gray-700 flex flex-col h-full overflow-hidden">
                    <div className="p-4 border-b border-gray-700 flex-shrink-0">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-blue-300">ជ្រើសរើស Pages ({selectedPageNames.size})</h3>
                            <div className="space-x-2 text-xs">
                                <button onClick={() => handleSelectAll(true)} className="text-blue-400 hover:underline">All</button>
                                <span className="text-gray-500">|</span>
                                <button onClick={() => handleSelectAll(false)} className="text-blue-400 hover:underline">None</button>
                            </div>
                        </div>
                    </div>
                    <div className="flex-grow overflow-y-auto p-4 space-y-4">
                        {Object.keys(pagesByTeam).length === 0 ? <p className="text-gray-500 text-center">No pages.</p> : 
                            Object.keys(pagesByTeam).sort().map(team => {
                                const teamPages = pagesByTeam[team];
                                const allSelected = teamPages.every(p => selectedPageNames.has(p.PageName));
                                const someSelected = teamPages.some(p => selectedPageNames.has(p.PageName));
                                return (
                                    <div key={team} className="border border-gray-700 rounded bg-gray-900/30 overflow-hidden">
                                        <div className="bg-gray-700/50 p-2 flex justify-between items-center">
                                            <label className="flex items-center space-x-2 cursor-pointer font-bold text-white text-sm">
                                                <input type="checkbox" checked={allSelected} ref={input => { if(input) input.indeterminate = someSelected && !allSelected; }} onChange={() => toggleTeamSelection(team, teamPages)} className="form-checkbox h-4 w-4 text-blue-500 rounded bg-gray-800 border-gray-500" />
                                                <span>{team}</span>
                                            </label>
                                            <span className="text-xs text-gray-400">{teamPages.length}</span>
                                        </div>
                                        <div className="p-2 space-y-1">
                                            {teamPages.map(page => (
                                                <label key={page.PageName} className="flex items-center space-x-3 cursor-pointer hover:bg-gray-800 p-1.5 rounded transition-colors">
                                                    <input type="checkbox" checked={selectedPageNames.has(page.PageName)} onChange={() => togglePageSelection(page.PageName)} className="form-checkbox h-4 w-4 text-blue-500 rounded bg-gray-900 border-gray-600" />
                                                    <span className="text-sm text-gray-300 truncate" title={page.PageName}>{page.PageName}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </div>
                </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-700 flex flex-col items-end">
                {isGenerating && (
                    <div className="w-full mb-3">
                        <div className="flex justify-between text-xs text-gray-400 mb-1"><span>Processing...</span><span>{progress}%</span></div>
                        <div className="w-full bg-gray-700 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div></div>
                    </div>
                )}
                <div className="flex space-x-3">
                    <button onClick={onClose} className="btn btn-secondary" disabled={isGenerating}>បោះបង់</button>
                    <button onClick={generatePDF} className="btn btn-primary flex items-center shadow-lg shadow-blue-600/20" disabled={isGenerating || selectedPageNames.size === 0}>
                        {isGenerating ? <><Spinner size="sm" /><span className="ml-2">Generating...</span></> : <><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>ទាញយក PDF</>}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default PagesPdfExportModal;