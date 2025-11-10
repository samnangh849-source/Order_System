import React, { useState, useRef, useEffect, useMemo } from 'react';

// --- [FIX] Mock Types and Functions to resolve import errors ---
// We define these here so the component can compile for preview.
// In your real project, you should use your imports from '../../types' and '../../utils/fileUtils'.

/**
 * Mocking 'MasterProduct' from '../../types'
 * In your real project: import { MasterProduct } from '../../types';
 */
interface MasterProduct {
    ProductName: string;
    Barcode: string | null;
    ImageURL: string;
    // You can add other properties from your MasterProduct type if needed
}

/**
 * Mocking 'convertGoogleDriveUrl' from '../../utils/fileUtils'
 * In your real project: import { convertGoogleDriveUrl } from '../../utils/fileUtils';
 */
const convertGoogleDriveUrl = (url: string): string => {
    if (!url) {
        // Return a placeholder if URL is empty
        return 'https://placehold.co/40x40/555/eee?text=?';
    }
    // Basic GDrive URL conversion
    const regex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const match = url.match(regex);
    if (match && match[1]) {
        return `https://drive.google.com/uc?id=${match[1]}`;
    }
    // Return original URL if it's not a standard share link or already direct
    return url;
};
// --- End of FIX ---


// --- Custom Hook: useDebounce ---
// (មិនមានការកែប្រែ)
const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};

// --- ជួសជុលទី៣៖ បន្ថែមអនុគមន៍ Escape RegExp ---
// (មិនមានការកែប្រែ)
const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& ធានាថាវានឹងជំនួសដោយតួអក្សរខ្លួនឯង
};


// --- Helper Component: HighlightMatch ---
// (មិនមានការកែប្រែ)
interface HighlightMatchProps {
    text: string;
    highlight: string;
}

const HighlightMatch: React.FC<HighlightMatchProps> = ({ text, highlight }) => {
    // --- ជួសជុលទី២៖ សម្អាតវង់ក្រចកចេញពីពាក្យ highlight ---
    const cleanHighlight = highlight.trim().replace(/[()\[\]{}]/g, '');
    
    if (!cleanHighlight) {
        return <span>{text}</span>;
    }
    
    // ប្រើ escapedHighlight ក្នុង RegExp
    const escapedHighlight = escapeRegExp(cleanHighlight);
    const regex = new RegExp(`(${escapedHighlight})`, 'gi');
    const parts = text.split(regex);

    return (
        <span>
            {parts.map((part, index) =>
                regex.test(part) ? (
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
    // State ថ្មីសម្រាប់តាមដាន Index ដែល Highlight ដោយ Keyboard
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    // Ref ថ្មីសម្រាប់ List ងាយស្រួលធ្វើ Scroll
    const listRef = useRef<HTMLUListElement>(null);

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
            // Reset highlighted index ពេលបើក
            setHighlightedIndex(-1);
        } else {
            setSearchTerm(''); // Reset search term ពេលបិទ
        }
    }, [isOpen]);
    
    // --- Logic ការ Search និង Sort ឆ្លាតវៃ ---
    const filteredProducts = useMemo(() => {
        // --- ជួសជុលទី២៖ សម្អាត searchTerm មុនពេលប្រើ ---
        const fullSearch = debouncedSearchTerm
            .toLowerCase()
            .trim()
            .replace(/[()\[\]{}]/g, ''); // ជម្រះតួអក្សរពិសេស
            
        if (!fullSearch) return products; // បង្ហាញទាំងអស់បើមិន Search

        const searchTerms = fullSearch.split(' ').filter(Boolean);

        const scoredProducts = products.map(product => {
            // --- [FIX] Trim ឈ្មោះផលិតផល និង Barcode មុនពេលប្រៀបធៀប ---
            const lowerName = product.ProductName.toLowerCase().trim();
            const lowerBarcode = (product.Barcode || '').toLowerCase().trim();
            let score = 0;

            // --- [FIX] រៀបចំប្រព័ន្ធពិន្ទុតាមលំដាប់ថ្នាក់ (Tiered Scoring) ---

            // 1. Tier 1: ផ្គូផ្គងពិតប្រាកដ (Exact Match) - ពិន្ទុខ្ពស់បំផុត
            if (lowerName === fullSearch) {
                score = 10000; // ឈ្មោះពិតប្រាកដ
                return { product, score }; // ចប់! នេះគឺខ្ពស់បំផុត
            }
            if (lowerBarcode === fullSearch) {
                score = 9000; // Barcode ពិតប្រាកដ
                return { product, score }; // ចប់!
            }

            // 2. Tier 2: ចាប់ផ្តើមដោយពាក្យ Search ទាំងមូល (Starts With Full Search)
            if (lowerName.startsWith(fullSearch)) {
                score = 8000; // ឈ្មោះចាប់ផ្តើមដោយពាក្យ Search
            } else if (lowerBarcode.startsWith(fullSearch)) {
                score = 7000; // Barcode ចាប់ផ្តើមដោយពាក្យ Search
            }

            // 3. Tier 3: ផ្ទុកគ្រប់ពាក្យ Search (Includes All Terms)
            let matchesAllTerms = true;
            for (const term of searchTerms) {
                const nameMatch = lowerName.includes(term);
                const barcodeMatch = lowerBarcode.includes(term);
                
                if (!nameMatch && !barcodeMatch) {
                    matchesAllTerms = false;
                    break;
                }
            }
            
            if (!matchesAllTerms) {
                // បើមិនផ្ទុកគ្រប់ពាក្យទេ មិនត្រូវបង្ហាញទេ
                // លើកលែងតែវាបានពិន្ទុពី Tier 2 (startsWith) រួចហើយ
                if (score > 0) {
                     return { product, score }; // រក្សាពិន្ទុពី Tier 2
                }
                return { product, score: 0 }; // បើមិនដូច្នេះទេ គឺ 0
            }

            // 4. ពិន្ទុបន្ថែម (Bonus)
            // បើវាผ่านมาដល់ទីនេះ មានន័យថាវាផ្ទុកគ្រប់ពាក្យ
            // បូក 1000 ពិន្ទុ ជាฐาน (Base score) សម្រាប់ការផ្ទុកគ្រប់ពាក្យ
            // (ពិន្ទុនេះនឹងបូកបន្ថែមពីលើពិន្ទុ Tier 2 បើមាន)
            score += 1000; 

            // បូកពិន្ទុបន្ថែម សម្រាប់ការចាប់ផ្តើមដោយ "ពាក្យនីមួយៗ"
            for (const term of searchTerms) {
                if (lowerName.startsWith(term)) score += 50;
                else if (lowerName.includes(term)) score += 10;
                
                if (lowerBarcode.startsWith(term)) score += 20;
                else if (lowerBarcode.includes(term)) score += 5;
            }
            
            return { product, score };
        });
    
        // 3. Filter និង Sort
        return scoredProducts
            .filter(item => item.score > 0)
             // --- [FIX] ឆ្លាស់ការ Sort បញ្ច្រាស់ពីមុន (ទាបទៅខ្ពស់) ---
            .sort((a, b) => a.score - b.score)
            .map(item => item.product);
    
    }, [products, debouncedSearchTerm]);


    const handleSelect = (productName: string) => {
        onSelect(productName);
        setIsOpen(false);
    };

    // --- [FIX] បន្ថែម Function សម្រាប់ Scroll ទៅតាម Index ---
    const scrollToIndex = (index: number) => {
        if (!listRef.current) return;
        const listElement = listRef.current;
        // ត្រូវប្រាកដថា listElement.children[index] គឺជា HTMLLIElement
        const itemElement = listElement.children[index] as HTMLLIElement;

        if (itemElement) {
            // គណនាទីតាំង
            const listTop = listElement.scrollTop;
            const listBottom = listTop + listElement.clientHeight;
            const itemTop = itemElement.offsetTop;
            const itemBottom = itemTop + itemElement.clientHeight;

            if (itemTop < listTop) {
                // Scroll ឡើងលើ
                listElement.scrollTop = itemTop;
            } else if (itemBottom > listBottom) {
                // Scroll ចុះក្រោម
                listElement.scrollTop = itemBottom - listElement.clientHeight;
            }
        }
    };


    // Function ថ្មី: សម្រាប់ដោះស្រាយ Keyboard
    const handleKeyDown = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                break;
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev => {
                    const newIndex = Math.min(prev + 1, filteredProducts.length - 1);
                    scrollToIndex(newIndex); // ហៅ Function Scroll
                    return newIndex;
                });
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => {
                    const newIndex = Math.max(prev - 1, 0);
                    scrollToIndex(newIndex); // ហៅ Function Scroll
                    return newIndex;
                });
                break;
            // --- [FIX] លុប ArrowUp ដែលជាន់គ្នា ---
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0 && highlightedIndex < filteredProducts.length) {
                    handleSelect(filteredProducts[highlightedIndex].ProductName);
                } else if (filteredProducts.length === 1) {
                    // បើមានលទ្ធផលតែមួយ ជ្រើសរើសយកមួយនោះតែម្តង
                    handleSelect(filteredProducts[0].ProductName);
                }
                break;
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                className="form-select text-left w-full flex justify-between items-center"
                onClick={() => setIsOpen(!isOpen)}
                // បន្ថែម a11y attributes
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className={selectedProduct ? 'text-white' : 'text-gray-400'}>
                    {selectedProduct ? selectedProduct.ProductName : 'ជ្រើសរើសផលិតផល'}
                </span>
                
                <svg className={`w-5 h-5 text-gray-400 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>

            {isOpen && (
                <div 
                    className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg max-h-60 flex flex-col"
                    // បន្ថែម a11y attributes
                    role="listbox"
                    id="product-listbox"
                >
                    <div className="p-2 border-b border-gray-600">
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="ស្វែងរកតាមឈ្មោះ ឬ Barcode..."
                            className="form-input"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            // បញ្ជូន Event ទៅ handleKeyDown
                            onKeyDown={handleKeyDown}
                            // បន្ថែម a11y attributes
                            aria-controls="product-listbox"
                            aria-activedescendant={highlightedIndex >= 0 ? `product-item-${highlightedIndex}` : undefined}
                        />
                    </div>
                    {/* --- [FIX] ដោះស្រាយបញ្ហា Duplicate <ul> --- */}
                    <ul className="overflow-y-auto" ref={listRef}>
                        {filteredProducts.length > 0 ? filteredProducts.map((product, index) => (
                            <li
                                key={product.ProductName}
                                // ផ្លាស់ប្តូរ Class ទៅតាម highlightedIndex
                                className={`px-3 py-2 text-sm text-gray-200 cursor-pointer flex items-center gap-3 ${
                                    index === highlightedIndex ? 'bg-blue-700' : 'hover:bg-blue-600'
                                }`}
                                // បន្ថែម onClick
                                onClick={() => handleSelect(product.ProductName)}
                                // បន្ថែម a11y attributes
                                role="option"
                                aria-selected={index === highlightedIndex}
                                id={`product-item-${index}`}
                            >
                                <img 
                                    src={convertGoogleDriveUrl(product.ImageURL)} 
                                    alt={product.ProductName} 
                                    className="w-8 h-8 object-cover rounded" 
                                    // --- [FIX] បានដក onError ចេញតាមការស្នើសុំ (ត្រឡប់ទៅដូច Code ដើម) ---
                                />
                                <div className="truncate">
                                    <p className="font-semibold truncate">
                                        {/* វានឹងប្រើ debouncedSearchTerm ដែលមិនទាន់បាន clean សម្រាប់ការ highlight */}
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