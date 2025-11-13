import React, { useState, useRef, useEffect, useMemo, useContext, useCallback } from 'react';
import { MasterProduct } from '../../types';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import { AppContext } from '../../App';
import { WEB_APP_URL } from '../../constants';
import Spinner from './Spinner';

// Helper to highlight search terms in results
const highlightMatch = (text: string, query: string) => {
    if (!query || !text) return <span>{text}</span>;
    const terms = query.split(' ').filter(Boolean).map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (terms.length === 0) return <span>{text}</span>;
    
    const regex = new RegExp(`(${terms.join('|')})`, 'gi');
    
    return (
        <>
            {text.split(regex).map((part, i) =>
                regex.test(part) && part.trim() !== '' ? <strong key={i} className="text-yellow-300 bg-yellow-900/50 rounded-sm px-0.5">{part}</strong> : part
            )}
        </>
    );
};

// A more robust, word-based relevance scoring algorithm
const getRelevanceScore = (product: MasterProduct, query: string): number => {
    const pName = (product.ProductName || '').toLowerCase();
    const pBarcode = (product.Barcode || '').toLowerCase();
    const pTags = (product.Tags || '').toLowerCase();
    const searchableText = `${pName} ${pBarcode} ${pTags}`;
    
    const q = query.toLowerCase().trim();
    if (!q) return 1;

    const queryTerms = q.split(' ').filter(Boolean);

    // All terms must be present in the searchable text
    const allTermsMatch = queryTerms.every(term => searchableText.includes(term));
    if (!allTermsMatch) {
        return 0; // Not a match
    }

    let score = 0;

    // Base score for having all terms
    score += 10;

    // Higher score for matches in more important fields
    queryTerms.forEach(term => {
        if (pName.includes(term)) score += 20;
        if (pBarcode.includes(term)) score += 10;
        if (pTags.includes(term)) score += 5;
    });

    // Bonus for matching the start of a word in the name
    const nameWords = pName.split(/[\s(),|/-]+/).filter(Boolean);
    queryTerms.forEach(term => {
        if (nameWords.some(word => word.startsWith(term))) {
            score += 30;
        }
    });

    // Very high score for prefix and exact matches of the full query
    if (pName.startsWith(q)) score += 500;
    if (pName === q) score += 1000;
    if (pBarcode === q) score += 1000;
    
    return score;
};


// --- START: ProductTagEditor Component ---
const ProductTagEditor: React.FC<{
    selectedProduct: MasterProduct;
}> = ({ selectedProduct }) => {
    const { updateProductInData } = useContext(AppContext);
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (selectedProduct && selectedProduct.Tags) {
            setTags(selectedProduct.Tags.split(',').map(t => t.trim()).filter(Boolean));
        } else {
            setTags([]);
        }
        setError(''); // Clear error when product changes
    }, [selectedProduct]);

    const updateTagsOnBackend = async (productName: string, newTags: string[]) => {
        if (!productName) return;
        setIsSaving(true);
        setError('');
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

        } catch (err) {
            setError((err as Error).message);
            // Revert UI state on failure
            if (selectedProduct && selectedProduct.Tags) {
                setTags(selectedProduct.Tags.split(',').map(t => t.trim()).filter(Boolean));
            } else {
                setTags([]);
            }
            setTimeout(() => setError(''), 5000);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddTag = (tagToAdd: string) => {
        const newTag = tagToAdd.trim().replace(/,/g, '');
        if (newTag && !tags.includes(newTag)) {
            const newTags = [...tags, newTag];
            setTags(newTags);
            updateTagsOnBackend(selectedProduct.ProductName, newTags);
        }
        setTagInput('');
    };

    const handleRemoveTag = (tagToRemove: string) => {
        const newTags = tags.filter(tag => tag !== tagToRemove);
        setTags(newTags);
        updateTagsOnBackend(selectedProduct.ProductName, newTags);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleAddTag(tagInput);
    };

    return (
        <div className="mt-2">
            <div 
                className="tags-input-container"
                onClick={() => inputRef.current?.focus()}
            >
                {tags.map(tag => (
                    <span key={tag} className="tag-badge">
                        {tag}
                        <button type="button" onClick={() => handleRemoveTag(tag)} className="tag-remove-btn" aria-label={`Remove tag ${tag}`}>&times;</button>
                    </span>
                ))}
                <form onSubmit={handleSubmit} className="flex-grow min-w-[100px]">
                    <input 
                        ref={inputRef}
                        type="text"
                        value={tagInput}
                        onChange={e => { setTagInput(e.target.value); if (error) setError(''); }}
                        placeholder={tags.length > 0 ? "Add tag..." : "Add product tags..."}
                        className="tag-input"
                        disabled={isSaving}
                        aria-label="Add a new tag"
                    />
                </form>
                {isSaving && <Spinner size="sm"/>}
            </div>
            {error && <p className="text-red-400 text-xs mt-1" role="alert">{error}</p>}
        </div>
    );
};
// --- END: ProductTagEditor Component ---


interface SearchableProductDropdownProps {
    products: MasterProduct[];
    selectedProductName: string;
    onSelect: (productName: string) => void;
}

// --- START: REFACTORED Dropdown Component ---
const SearchableProductDropdown: React.FC<SearchableProductDropdownProps> = ({ products, selectedProductName, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const selectedProduct = useMemo(() => 
        products.find(p => p.ProductName === selectedProductName), 
    [products, selectedProductName]);

    useEffect(() => {
        setSearchTerm(selectedProductName);
    }, [selectedProductName]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm(selectedProductName); // Revert on close
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedProductName]);
    
    const filteredProducts = useMemo(() => {
        const query = searchTerm || '';
        if (!query.trim()) return [];

        return products
            .map(product => ({ product, score: getRelevanceScore(product, query) }))
            .filter(p => p.score > 0)
            .sort((a, b) => b.score - a.score || a.product.ProductName.localeCompare(b.product.ProductName))
            .map(p => p.product);
    }, [products, searchTerm]);
    
    const canAddNewProduct = useMemo(() => {
        const trimmedSearch = searchTerm.trim();
        if (!trimmedSearch) return false;
        return !products.some(p => p.ProductName.trim().toLowerCase() === trimmedSearch.toLowerCase());
    }, [searchTerm, products]);

    const itemsForNavigation = useMemo(() => {
        const items = [...filteredProducts];
        if (canAddNewProduct) {
            items.unshift({ isAddNew: true, ProductName: searchTerm.trim() } as any);
        }
        return items;
    }, [filteredProducts, canAddNewProduct, searchTerm]);

    useEffect(() => {
        if (activeIndex >= 0 && listRef.current) {
            const activeItem = listRef.current.children[activeIndex] as HTMLLIElement;
            activeItem?.scrollIntoView({ block: 'nearest' });
        }
    }, [activeIndex, itemsForNavigation]);

    const handleSelect = useCallback((productName: string) => {
        onSelect(productName);
        setSearchTerm(productName);
        setIsOpen(false);
        setActiveIndex(0);
        inputRef.current?.blur();
    }, [onSelect]);
    
    const handleClear = useCallback(() => {
        onSelect('');
        setSearchTerm('');
        setIsOpen(true);
        setActiveIndex(0);
        inputRef.current?.focus();
    }, [onSelect]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const itemsCount = itemsForNavigation.length;
        if (itemsCount === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                if (!isOpen) setIsOpen(true);
                e.preventDefault();
                setActiveIndex(prev => (prev + 1) % itemsCount);
                break;
            case 'ArrowUp':
                if (!isOpen) setIsOpen(true);
                e.preventDefault();
                setActiveIndex(prev => (prev - 1 + itemsCount) % itemsCount);
                break;
            case 'Enter':
                if (!isOpen) return;
                e.preventDefault();
                if (activeIndex > -1 && itemsForNavigation[activeIndex]) {
                    handleSelect(itemsForNavigation[activeIndex].ProductName);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                setSearchTerm(selectedProductName);
                inputRef.current?.blur();
                break;
        }
    };

    return (
        <div 
            className="relative" 
            ref={dropdownRef}
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
        >
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    className="form-input !pr-16"
                    placeholder="ស្វែងរក ឬ បញ្ចូលឈ្មោះផលិតផល..."
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setIsOpen(true); setActiveIndex(0); }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    aria-autocomplete="list"
                    aria-controls="product-listbox"
                    aria-activedescendant={activeIndex > -1 ? `product-option-${activeIndex}` : undefined}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {searchTerm && (
                        <button 
                            type="button" 
                            onClick={handleClear} 
                            className="text-gray-500 hover:text-white text-2xl"
                            aria-label="Clear search"
                        >
                            &times;
                        </button>
                    )}
                     <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
            </div>
            
            {selectedProductName && selectedProduct && (
                <ProductTagEditor selectedProduct={selectedProduct} />
            )}

            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg max-h-80 flex flex-col">
                    <ul 
                        ref={listRef} 
                        className="overflow-y-auto p-1" 
                        id="product-listbox" 
                        role="listbox"
                    >
                        {!searchTerm.trim() && (
                            <li className="px-3 py-4 text-sm text-gray-500 text-center">
                                Start typing to search for a product...
                            </li>
                        )}
                        {searchTerm.trim() && itemsForNavigation.length === 0 && (
                            <li className="px-3 py-4 text-sm text-gray-500 text-center">
                                No matching products found.
                            </li>
                        )}
                        {itemsForNavigation.map((item, index) => {
                            if ('isAddNew' in item && item.isAddNew) {
                                return (
                                    <li
                                        key="add-new"
                                        id={`product-option-${index}`}
                                        role="option"
                                        aria-selected={activeIndex === index}
                                        className={`p-3 text-sm rounded-md cursor-pointer flex items-center gap-3 ${activeIndex === index ? 'bg-blue-600' : 'hover:bg-blue-600/70'}`}
                                        onMouseDown={() => handleSelect(item.ProductName)}
                                    >
                                        <div className="w-10 h-10 rounded flex-shrink-0 bg-gray-700 flex items-center justify-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                                        </div>
                                        <div className="flex-grow overflow-hidden">
                                            <p className="font-semibold">Add new: <strong className="text-yellow-300">"{item.ProductName}"</strong></p>
                                        </div>
                                    </li>
                                )
                            }
                            const product = item as MasterProduct;
                            return (
                                <li
                                    key={product.ProductName}
                                    id={`product-option-${index}`}
                                    role="option"
                                    aria-selected={activeIndex === index}
                                    title={product.ProductName}
                                    className={`p-3 text-sm rounded-md cursor-pointer flex items-center gap-3 ${activeIndex === index ? 'bg-blue-600' : 'hover:bg-blue-600/70'}`}
                                    onMouseDown={() => handleSelect(product.ProductName)}
                                >
                                    <img src={convertGoogleDriveUrl(product.ImageURL)} alt={product.ProductName} className="w-10 h-10 object-cover rounded flex-shrink-0" />
                                    <div className="flex-grow overflow-hidden">
                                        <p className="font-semibold truncate">{highlightMatch(product.ProductName, searchTerm)}</p>
                                        <p className="text-xs text-gray-400 truncate">
                                            Barcode: {product.Barcode ? highlightMatch(product.Barcode, searchTerm) : 'N/A'} | Price: ${product.Price.toFixed(2)}
                                        </p>
                                        {product.Tags && (
                                            <p className="text-xs text-blue-300 truncate mt-1">
                                                Tags: {highlightMatch(product.Tags, searchTerm)}
                                            </p>
                                        )}
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SearchableProductDropdown;
