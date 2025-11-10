import React, { useState, useRef, useEffect, useMemo } from 'react';

// --- Types and Utils (សម្រាប់ជាឧទាហរណ៍) ---
// ជំនួសដោយ import ពិតប្រាកដរបស់អ្នក
// import { MasterProduct } from '../../types';
// import { convertGoogleDriveUrl } from '../../utils/fileUtils';

// Dummy Type សម្រាប់អោយ Code ដំណើរការ
interface MasterProduct {
    ProductName: string;
    Barcode?: string;
    ImageURL?: string;
}

// Dummy Function សម្រាប់អោយ Code ដំណើរការ
const convertGoogleDriveUrl = (url: string | undefined): string => {
    // ដាក់ Logic របស់អ្នកនៅទីនេះ
    return url || 'https://placehold.co/40x40/334155/94a3b8?text=Img';
};

// --- Custom Hook: useDebounce ---
// Hook នេះជួយពន្យារពេលការ Update នៃតម្លៃណាមួយ (ក្នុងករណីនេះគឺ searchTerm)
// រហូតដល់អ្នកប្រើប្រាស់ឈប់វាយក្នុងរយៈពេល delay (ឧ. 300ms)
const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        // បង្កើត Timer
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        // Clear Timer ប្រសិនបើ value ឬ delay ផ្លាស់ប្តូរ (ឬពេល unmount)
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};

// --- Helper Component: HighlightMatch ---
// Component នេះទទួល text និង ពាក្យដែលត្រូវ highlight
// ហើយបំបែក text នោះដោយដាក់ <mark> លើផ្នែកដែលត្រូវគ្នា
interface HighlightMatchProps {
    text: string;
    highlight: string;
}

const HighlightMatch: React.FC<HighlightMatchProps> = ({ text, highlight }) => {
    if (!highlight.trim()) {
        return <span>{text}</span>;
    }
    // បង្កើត RegExp ពីពាក្យ highlight ដោយមិនប្រកាន់អក្សរតូចធំ (i)
    // និងស្វែងរកគ្រប់កន្លែង (g)
    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = text.split(regex);

    return (
        <span>
            {parts.map((part, index) =>
                regex.test(part) ? (
                    // ប្រើ <mark> សម្រាប់ highlight
                    <mark key={index} className="bg-yellow-400 text-gray-900 rounded px-0.5 py-0">
                        {part}
                    </mark>
                ) : (
                    <span key={index}>{part}</span>
                )
            )}
        </span>
    );
};


// --- Main Component: SearchableProductDropdown ---
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

    // ប្រើ Debounce លើ searchTerm
    // ការ Search នឹងធ្វើឡើងតែ 300ms បន្ទាប់ពី User ឈប់វាយ
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    const selectedProduct = useMemo(() => {
        return products.find(p => p.ProductName === selectedProductName);
    }, [products, selectedProductName]);

    // Effect សម្រាប់ដោះស្រាយការ Click នៅខាងក្រៅ Dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Effect សម្រាប់ Focus លើ Input ពេលបើក និង Clear Search ពេលបិទ
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
        } else {
            setSearchTerm(''); // Reset search term ពេលបិទ
        }
    }, [isOpen]);
    
    // --- Logic ការ Search និង Sort ឆ្លាតវៃ ---
    const filteredProducts = useMemo(() => {
        const fullSearch = debouncedSearchTerm.toLowerCase().trim();
        if (!fullSearch) return products; // បង្ហាញទាំងអស់បើមិន Search

        const searchTerms = fullSearch.split(' ').filter(Boolean);

        const scoredProducts = products.map(product => {
            const lowerName = product.ProductName.toLowerCase();
            const lowerBarcode = (product.Barcode || '').toLowerCase();
            let score = 0;
            let matchesAllTerms = true;

            // 1. ពិនិត្យថាគ្រប់ពាក្យ Search ត្រូវតែមាន
            for (const term of searchTerms) {
                const nameMatch = lowerName.includes(term);
                const barcodeMatch = lowerBarcode.includes(term);
                
                if (!nameMatch && !barcodeMatch) {
                    matchesAllTerms = false;
                    break;
                }
            }
            
            if (!matchesAllTerms) {
                return { product, score: 0 };
            }

            // 2. គណនាពិន្ទុ (Scoring)
            // ពិន្ទុខ្ពស់សម្រាប់ Full Search Term
            if (lowerName === fullSearch) score += 1000;
            if (lowerBarcode === fullSearch) score += 500;
            
            if (lowerName.startsWith(fullSearch)) score += 100;
            if (lowerBarcode.startsWith(fullSearch)) score += 50;

            // ពិន្ទុសម្រាប់ Individual Terms
            for (const term of searchTerms) {
                if (lowerName.startsWith(term)) score += 20;
                else if (lowerName.includes(term)) score += 5;
                
                if (lowerBarcode.startsWith(term)) score += 10;
                else if (lowerBarcode.includes(term)) score += 2;
            }
            
            return { product, score };
        });
    
        // 3. Filter និង Sort
        return scoredProducts
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score) // Sort តាមពិន្ទុ (ខ្ពស់ទៅទាប)
            .map(item => item.product);
    
    }, [products, debouncedSearchTerm]);


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
                {selectedProduct ? (
                    <div className="flex items-center gap-2 truncate">
                        <img 
                            src={convertGoogleDriveUrl(selectedProduct.ImageURL)} 
                            alt={selectedProduct.ProductName} 
                            className="w-6 h-6 object-cover rounded flex-shrink-0"
                            onError={(e) => (e.currentTarget.src = 'https://placehold.co/40x40/334155/94a3b8?text=Img')}
                        />
                        <span className="text-white truncate">{selectedProduct.ProductName}</span>
                    </div>
                ) : (
                    <span className="text-gray-400">ជ្រើសរើសផលិតផល</span>
                )}
                
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
                                <img 
                                    src={convertGoogleDriveUrl(product.ImageURL)} 
                                    alt={product.ProductName} 
                                    className="w-8 h-8 object-cover rounded flex-shrink-0" 
                                    onError={(e) => (e.currentTarget.src = 'https://placehold.co/40x40/334155/94a3b8?text=Img')}
                                />
                                <div className="truncate">
                                    <p className="font-semibold truncate">
                                        <HighlightMatch text={product.ProductName} highlight={debouncedSearchTerm} />
                                    </p>
                                    <p className="text-xs text-gray-400 truncate">
                                        Barcode: <HighlightMatch text={product.Barcode || 'N/A'} highlight={debouncedSearchTerm} />
                                    </p>
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