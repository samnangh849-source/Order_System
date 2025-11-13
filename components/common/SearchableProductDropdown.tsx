

import React, { useState, useRef, useEffect, useMemo, useContext } from 'react';
import { MasterProduct } from '../../types';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import { AppContext } from '../../App';
import { WEB_APP_URL } from '../../constants';
import Spinner from './Spinner';

interface SearchableProductDropdownProps {
    products: MasterProduct[];
    selectedProductName: string;
    onSelect: (productName: string) => void;
}

const highlightMatch = (text: string, query: string) => {
    if (!query || !text) return <span>{text}</span>;
    const terms = query.split(' ').filter(Boolean).map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (terms.length === 0) return <span>{text}</span>;
    
    const regex = new RegExp(`(${terms.join('|')})`, 'gi');
    
    return (
        <>
            {text.split(regex).map((part, i) =>
                regex.test(part) && part.trim() !== '' ? <strong key={i} className="text-yellow-300 bg-yellow-900/50 rounded-sm">{part}</strong> : part
            )}
        </>
    );
};

const getRelevanceScore = (product: MasterProduct, query: string): number => {
    const pName = product.ProductName.toLowerCase();
    const pBarcode = (product.Barcode || '').toLowerCase();
    const pTags = (product.Tags || '').toLowerCase();
    const q = query.toLowerCase();
    let score = 0;

    if (!q) return 1; // Return a base score if query is empty

    // Score based on ProductName
    if (pName === q) score += 1000;
    else if (pName.startsWith(q)) score += 100;
    else if (pName.includes(q)) score += 10;
    
    // Score based on Barcode
    if (pBarcode && pBarcode.includes(q)) {
        if (pBarcode === q) score += 500;
        else score += 20;
    }
    
    // Score based on Tags
    if (pTags) {
        const tags = pTags.split(',').map(t => t.trim());
        if (tags.some(t => t === q)) score += 80; // Exact tag match
        else if (tags.some(t => t.includes(q))) score += 5;
    }

    return score;
}

const HoldTooltip = ({ content, position }: { content: string; position: { x: number; y: number } | null }) => {
    if (!position) return null;
    return (
        <div
            className="fixed p-2 text-sm text-white bg-gray-900/80 backdrop-blur-sm border border-gray-600 rounded-md shadow-lg z-[9999]"
            style={{
                left: `${position.x + 10}px`,
                top: `${position.y - 15}px`,
                pointerEvents: 'none',
                transform: 'translateY(-100%)',
                maxWidth: '300px',
                wordBreak: 'break-word',
            }}
        >
            {content}
        </div>
    );
};

const SearchableProductDropdown: React.FC<SearchableProductDropdownProps> = ({ products, selectedProductName, onSelect }) => {
    const { updateProductInData } = useContext(AppContext);
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [inputValue, setInputValue] = useState(selectedProductName);
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [isSavingTags, setIsSavingTags] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const tagInputRef = useRef<HTMLInputElement>(null);
    const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
    const [tooltipContent, setTooltipContent] = useState('');
    const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wasHeldRef = useRef(false);

    const selectedProduct = useMemo(() => 
        products.find(p => p.ProductName === selectedProductName), 
    [products, selectedProductName]);

    useEffect(() => {
        setInputValue(selectedProductName);
        if (selectedProduct && selectedProduct.Tags) {
            setTags(selectedProduct.Tags.split(',').map(t => t.trim()).filter(Boolean));
        } else {
            setTags([]);
        }
    }, [selectedProductName, selectedProduct]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                if (isOpen) {
                    setIsOpen(false);
                    setInputValue(selectedProductName); // Revert on click outside
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, selectedProductName]);

    const filteredProducts = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) {
            return products.sort((a, b) => b.ProductName.localeCompare(a.ProductName));
        }

        const searchTerms = query.split(/\s+/).filter(Boolean);

        const scoredProducts = products.map(product => {
            const searchableText = [
                product.ProductName,
                product.Barcode,
                product.Tags,
            ].filter(Boolean).join(' ').toLowerCase();

            const allTermsMatch = searchTerms.every(term => searchableText.includes(term));

            return {
                ...product,
                score: allTermsMatch ? getRelevanceScore(product, query) : 0,
            };
        });

        return scoredProducts
            .filter(p => p.score > 0)
            .sort((a, b) => a.score - b.score);
    }, [products, searchTerm]);

    const showCustomAddOption = useMemo(() => {
        if (!searchTerm.trim()) return false;
        const exactMatch = products.some(p => p.ProductName.trim().toLowerCase() === searchTerm.trim().toLowerCase());
        return !exactMatch;
    }, [searchTerm, products]);
    
    const updateTagsOnBackend = async (productName: string, newTags: string[]) => {
        if (!productName) return;
        setIsSavingTags(true);
        try {
            const response = await fetch(`${WEB_APP_URL}/api/admin/update-sheet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sheetName: "Products",
                    primaryKey: { "ProductName": productName },
                    newData: { "Tags": newTags.join(',') }
                }),
            });

            if (!response.ok) {
                let errorMessage = 'Failed to update tags.';
                try {
                    const errorResult = await response.json();
                    errorMessage = errorResult.message || JSON.stringify(errorResult);
                } catch (e) {
                    errorMessage = `Server Error: ${await response.text()}`;
                }
                throw new Error(errorMessage);
            }
            
            updateProductInData(productName, { Tags: newTags.join(',') });

        } catch (error) {
            console.error("Error updating tags:", error);
            alert(`Could not save tags: ${(error as Error).message}`);
            if (selectedProduct && selectedProduct.Tags) {
                setTags(selectedProduct.Tags.split(',').map(t => t.trim()).filter(Boolean));
            } else {
                setTags([]);
            }
        } finally {
            setIsSavingTags(false);
        }
    };

    const handleAddTag = (tagToAdd: string) => {
        const newTag = tagToAdd.trim().replace(/,/g, '');
        if (newTag && !tags.includes(newTag)) {
            const newTags = [...tags, newTag];
            setTags(newTags);
            updateTagsOnBackend(selectedProductName, newTags);
        }
        setTagInput('');
    };

    const handleRemoveTag = (tagToRemove: string) => {
        const newTags = tags.filter(tag => tag !== tagToRemove);
        setTags(newTags);
        updateTagsOnBackend(selectedProductName, newTags);
    };

    const handleTagSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleAddTag(tagInput);
    };

    const handleSelect = (productName: string) => {
        onSelect(productName);
        setInputValue(productName);
        setSearchTerm('');
        setIsOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputValue(value);
        setSearchTerm(value);
        if (!isOpen) setIsOpen(true);
    };

    const handleInputFocus = () => {
        setSearchTerm('');
        setIsOpen(true);
    };

    const handleInputBlur = () => {
        setTimeout(() => {
            if (!isOpen) return;

            const trimmedInput = inputValue.trim().toLowerCase();
            const exactMatch = products.find(p => p.ProductName.toLowerCase() === trimmedInput);

            if (exactMatch) {
                handleSelect(exactMatch.ProductName);
            } else if (showCustomAddOption && inputValue.trim()) {
                handleSelect(inputValue.trim());
            } else {
                setInputValue(selectedProductName);
                setIsOpen(false);
            }
        }, 200);
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (showCustomAddOption) {
                handleSelect(searchTerm.trim());
            } else if (filteredProducts.length > 0) {
                handleSelect(filteredProducts[0].ProductName);
            }
        }
    };

    const handleHoldStart = (e: React.MouseEvent | React.TouchEvent, content: string) => {
        if ('button' in e && e.button !== 0) return;
        wasHeldRef.current = false;
        
        const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const y = 'touches' in e ? e.touches[0].clientY : e.clientY;

        holdTimeoutRef.current = setTimeout(() => {
            wasHeldRef.current = true;
            setTooltipContent(content);
            setTooltipPosition({ x, y });
        }, 500);
    };

    const handleHoldEnd = () => {
        if (holdTimeoutRef.current) {
            clearTimeout(holdTimeoutRef.current);
        }
        if (tooltipPosition) {
            setTooltipPosition(null);
        }
    };

    useEffect(() => {
        return () => {
            if (holdTimeoutRef.current) {
                clearTimeout(holdTimeoutRef.current);
            }
        };
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <HoldTooltip content={tooltipContent} position={tooltipPosition} />
             <input
                type="text"
                className="form-input"
                placeholder="ស្វែងរក ឬ បញ្ចូលឈ្មោះផលិតផល..."
                value={inputValue}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                onKeyDown={handleKeyDown}
            />
            
            {selectedProductName && (
                <div 
                    className="tags-input-container mt-2"
                    onClick={() => tagInputRef.current?.focus()}
                >
                    {tags.map(tag => (
                        <span key={tag} className="tag-badge">
                            {tag}
                            <button type="button" onClick={() => handleRemoveTag(tag)} className="tag-remove-btn">&times;</button>
                        </span>
                    ))}
                    <form onSubmit={handleTagSubmit} className="flex-grow min-w-[100px]">
                        <input 
                            ref={tagInputRef}
                            type="text"
                            value={tagInput}
                            onChange={e => setTagInput(e.target.value)}
                            placeholder={tags.length > 0 ? "Add tag..." : "Add product tags..."}
                            className="tag-input"
                            disabled={isSavingTags}
                        />
                    </form>
                    {isSavingTags && <Spinner size="sm"/>}
                </div>
            )}

            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg max-h-60 flex flex-col">
                    <ul className="overflow-y-auto">
                         {showCustomAddOption && (
                            <li
                                className="px-3 py-2 text-sm text-green-300 cursor-pointer hover:bg-blue-600 flex items-center gap-3 border-b border-gray-700"
                                onClick={() => handleSelect(searchTerm.trim())}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                                </svg>
                                <span className="truncate">បន្ថែមថ្មី: <strong>"{searchTerm.trim()}"</strong></span>
                            </li>
                        )}
                        {filteredProducts.map(product => (
                            <li
                                key={product.ProductName}
                                className="px-3 py-2 text-sm text-gray-200 cursor-pointer hover:bg-blue-600 flex items-center gap-3"
                                onMouseDown={(e) => handleHoldStart(e, product.ProductName)}
                                onMouseUp={handleHoldEnd}
                                onMouseLeave={handleHoldEnd}
                                onTouchStart={(e) => handleHoldStart(e, product.ProductName)}
                                onTouchEnd={handleHoldEnd}
                                onClick={() => {
                                    if (!wasHeldRef.current) {
                                        handleSelect(product.ProductName);
                                    }
                                }}
                                onContextMenu={(e) => e.preventDefault()}
                            >
                                <img src={convertGoogleDriveUrl(product.ImageURL)} alt={product.ProductName} className="w-10 h-10 object-cover rounded flex-shrink-0" />
                                <div className="flex-grow overflow-hidden">
                                    <p className="font-semibold truncate">{highlightMatch(product.ProductName, searchTerm)}</p>
                                    <p className="text-xs text-gray-400 truncate">
                                        Barcode: {product.Barcode ? highlightMatch(product.Barcode, searchTerm) : 'N/A'} | តម្លៃ: ${product.Price.toFixed(2)}
                                    </p>
                                    {product.Tags && (
                                        <p className="text-xs text-blue-300 truncate mt-1">
                                            Tags: {highlightMatch(product.Tags, searchTerm)}
                                        </p>
                                    )}
                                </div>
                            </li>
                        ))}
                        {filteredProducts.length === 0 && !showCustomAddOption && (
                           <li className="px-3 py-2 text-sm text-gray-500 text-center">រកមិនឃើញផលិតផលទេ។</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SearchableProductDropdown;