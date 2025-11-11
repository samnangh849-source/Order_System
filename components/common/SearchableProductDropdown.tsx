

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MasterProduct } from '../../types';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

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

const SearchableProductDropdown: React.FC<SearchableProductDropdownProps> = ({ products, selectedProductName, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [inputValue, setInputValue] = useState(selectedProductName);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setInputValue(selectedProductName);
    }, [selectedProductName]);

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
        if (!searchTerm) return products;
        const searchTerms = searchTerm.toLowerCase().split(' ').filter(Boolean);
        if (searchTerms.length === 0) return products;

        return products.filter(product => {
            const lowerProductName = product.ProductName.toLowerCase();
            const lowerBarcode = (product.Barcode || '').toLowerCase();
            return searchTerms.every(term => lowerProductName.includes(term) || lowerBarcode.includes(term));
        }).sort((a, b) => a.ProductName.localeCompare(b.ProductName));
    }, [products, searchTerm]);

    const showCustomAddOption = useMemo(() => {
        if (!searchTerm.trim()) return false;
        const exactMatch = products.some(p => p.ProductName.trim().toLowerCase() === searchTerm.trim().toLowerCase());
        return !exactMatch;
    }, [searchTerm, products]);

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
        setSearchTerm(inputValue);
        setIsOpen(true);
    };

    const handleInputBlur = () => {
        setTimeout(() => {
            if (isOpen) {
                // If the user typed a new product name and tabbed/clicked away, select it.
                if (showCustomAddOption && inputValue.trim()) {
                    handleSelect(inputValue.trim());
                } else {
                    // Otherwise, revert to the last valid selection.
                    setInputValue(selectedProductName);
                    setIsOpen(false);
                }
            }
        }, 200); // Delay to allow onMouseDown on list items to fire first
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

    return (
        <div className="relative" ref={dropdownRef}>
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

            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg max-h-60 flex flex-col">
                    <ul className="overflow-y-auto">
                         {showCustomAddOption && (
                            <li
                                className="px-3 py-2 text-sm text-green-300 cursor-pointer hover:bg-blue-600 flex items-center gap-3 border-b border-gray-700"
                                onMouseDown={() => handleSelect(searchTerm.trim())}
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
                                onMouseDown={() => handleSelect(product.ProductName)}
                            >
                                <img src={convertGoogleDriveUrl(product.ImageURL)} alt={product.ProductName} className="w-10 h-10 object-cover rounded flex-shrink-0" />
                                <div className="flex-grow overflow-hidden">
                                    <p className="font-semibold truncate">{highlightMatch(product.ProductName, searchTerm)}</p>
                                    <p className="text-xs text-gray-400 truncate">
                                        Barcode: {product.Barcode ? highlightMatch(product.Barcode, searchTerm) : 'N/A'} | តម្លៃ: ${product.Price.toFixed(2)}
                                    </p>
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
