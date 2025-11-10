
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MasterProduct } from '../../types';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

interface SearchableProductDropdownProps {
    products: MasterProduct[];
    selectedProductName: string;
    onSelect: (productName: string) => void;
}

const SearchableProductDropdown: React.FC<SearchableProductDropdownProps> = ({ products, selectedProductName, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const selectedProduct = useMemo(() => {
        return products.find(p => p.ProductName === selectedProductName);
    }, [products, selectedProductName]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen) {
            // Focus the search input when the dropdown opens
            setTimeout(() => searchInputRef.current?.focus(), 100);
        } else {
            setSearchTerm(''); // Reset search term when dropdown closes
        }
    }, [isOpen]);
    
    const filteredProducts = useMemo(() => {
        if (!searchTerm) return products;
        const searchTerms = searchTerm.toLowerCase().split(' ').filter(Boolean);
        if (searchTerms.length === 0) return products;
    
        const scoredProducts = products.map(product => {
            const lowerProductName = product.ProductName.toLowerCase();
            const lowerBarcode = (product.Barcode || '').toLowerCase();
            let score = 0;
            let matchesAll = true;
    
            for (const term of searchTerms) {
                const productNameContains = lowerProductName.includes(term);
                const barcodeContains = lowerBarcode.includes(term);
                
                if (!productNameContains && !barcodeContains) {
                    matchesAll = false;
                    break;
                }
    
                if (lowerProductName.startsWith(term)) {
                    score += 10;
                } else if (productNameContains) {
                    score += 1;
                }
                
                if (lowerBarcode.startsWith(term)) {
                    score += 5;
                } else if (barcodeContains) {
                    score += 1;
                }
            }
            
            // Give a larger bonus for matches against the full search term
            const fullSearchTerm = searchTerm.toLowerCase();
            if (lowerProductName.startsWith(fullSearchTerm)) {
                score += 20;
            }
            if (lowerBarcode.startsWith(fullSearchTerm)) {
                score += 15;
            }

            if (!matchesAll) {
                score = 0;
            }
            
            return { product, score };
        });
    
        return scoredProducts
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(item => item.product);
    
    }, [products, searchTerm]);


    const handleSelect = (productName: string) => {
        onSelect(productName);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                className="form-select text-left w-full flex justify-between items-center"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={selectedProduct ? 'text-white' : 'text-gray-400'}>
                    {selectedProduct ? selectedProduct.ProductName : 'ជ្រើសរើសផលិតផល'}
                </span>
                <svg className={`w-5 h-5 text-gray-400 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg max-h-60 flex flex-col">
                    <div className="p-2 border-b border-gray-600">
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="ស្វែងរកតាមឈ្មោះ ឬ Barcode..."
                            className="form-input"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <ul className="overflow-y-auto">
                        {filteredProducts.length > 0 ? filteredProducts.map(product => (
                            <li
                                key={product.ProductName}
                                className="px-3 py-2 text-sm text-gray-200 cursor-pointer hover:bg-blue-600 flex items-center gap-3"
                                onClick={() => handleSelect(product.ProductName)}
                            >
                                <img src={convertGoogleDriveUrl(product.ImageURL)} alt={product.ProductName} className="w-8 h-8 object-cover rounded" />
                                <div>
                                    <p className="font-semibold">{product.ProductName}</p>
                                    <p className="text-xs text-gray-400">Barcode: {product.Barcode || 'N/A'}</p>
                                </div>
                            </li>
                        )) : (
                            <li className="px-3 py-2 text-sm text-gray-500 text-center">រកមិនឃើញផលិតផលទេ។</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SearchableProductDropdown;