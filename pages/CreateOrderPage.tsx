import React, { useState, useContext, useEffect, useMemo, useRef } from 'react';
import { AppContext } from '../App';
import { Product as ProductType, MasterProduct } from '../types';
import Spinner from '../components/common/Spinner';
import { WEB_APP_URL } from '../constants';
import Modal from '../components/common/Modal';
import { convertGoogleDriveUrl } from '../utils/fileUtils';

interface CreateOrderPageProps {
    team: string;
    onSaveSuccess: () => void;
    onCancel: () => void;
}

// Extended product state for UI logic
interface ProductUIState extends ProductType {
    discountType: 'percent' | 'amount' | 'custom';
    discountAmountInput: string; // Value from the amount input field, stored as string for better UX
    discountPercentInput: string; // Value from the percent input field, stored as string for better UX
    applyDiscountToTotal: boolean;
}


const initialProductState: ProductUIState = {
    id: Date.now(),
    name: '',
    quantity: 1,
    originalPrice: 0,
    finalPrice: 0,
    total: 0,
    discountPercent: 0,
    colorInfo: '',
    image: '',
    cost: 0,
    // New UI state fields
    discountType: 'percent',
    discountAmountInput: '',
    discountPercentInput: '',
    applyDiscountToTotal: false,
};

const STEPS = [
    { number: 1, title: 'អតិថិជន' },
    { number: 2, title: 'ផលិតផល' },
    { number: 3, title: 'ដឹកជញ្ជូន' },
    { number: 4, title: 'ផ្ទៀងផ្ទាត់' },
];

const MapModal: React.FC<{ isOpen: boolean; onClose: () => void; url: string; }> = ({ isOpen, onClose, url }) => {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Reset loading state when URL changes (modal is reopened)
        if (isOpen) {
            setIsLoading(true);
        }
    }, [isOpen, url]);

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-4xl">
            <h2 className="text-xl font-bold mb-2 text-white">ស្វែងរកទីតាំង</h2>
            <p className="text-sm text-gray-400 mb-4">
                បន្ទាប់ពីរកឃើញទីតាំងត្រឹមត្រូវ សូមចម្លង (Copy) អាសយដ្ឋាន ឬ Link រួចបិទផ្ទាំងនេះ ហើយបិទភ្ជាប់ (Paste) ចូលទៅក្នុងប្រអប់ "ទីតាំងលម្អិត" វិញ។
            </p>
            <div className="relative w-full h-[70vh] bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Spinner size="lg"/>
                        <span className="ml-3 text-gray-300">កំពុងដំណើរការផែនទី...</span>
                    </div>
                )}
                <iframe
                    src={url}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen={false}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    onLoad={() => setIsLoading(false)}
                    className={isLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'}
                ></iframe>
            </div>
        </Modal>
    );
};


const CreateOrderPage: React.FC<CreateOrderPageProps> = ({ team, onSaveSuccess, onCancel }) => {
    const { appData, currentUser, previewImage } = useContext(AppContext);
    const [currentStep, setCurrentStep] = useState(1);
    const [order, setOrder] = useState<any>({
        page: '',
        telegramValue: '',
        customer: { name: '', phone: '', province: '', district: '', sangkat: '', additionalLocation: '', shippingFee: '' },
        products: [{...initialProductState, id: Date.now()}],
        shipping: { method: '', details: '', cost: '' },
        payment: { status: 'Unpaid', info: '' },
        telegram: { schedule: false, time: null },
        subtotal: 0,
        grandTotal: 0,
        note: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [submissionStatus, setSubmissionStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [selectedShippingMethod, setSelectedShippingMethod] = useState<any>(null);
    const [carrierLogo, setCarrierLogo] = useState<string>('');
    const [shippingLogo, setShippingLogo] = useState<string>('');
    const [driverPhoto, setDriverPhoto] = useState<string>('');
    const [bankLogo, setBankLogo] = useState<string>('');
    const [isScannerVisible, setIsScannerVisible] = useState(false);
    const [scannedCode, setScannedCode] = useState<{ code: string; timestamp: number } | null>(null);
    const scannerRef = useRef<any>(null);
    const [shippingFeeOption, setShippingFeeOption] = useState<'charge' | 'free'>('charge');
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
    const [mapSearchUrl, setMapSearchUrl] = useState('');
    
     const teamPages = useMemo(() => {
        if (!appData.pages) return [];
        return appData.pages.filter((p: any) => p.Team === team);
    }, [appData.pages, team]);

    useEffect(() => {
        // Auto-select page if there's only one for the team
        if (teamPages.length === 1 && !order.page) {
            setOrder((prev: any) => ({
                ...prev,
                page: teamPages[0].PageName,
                telegramValue: teamPages[0].TelegramValue,
            }));
        }
    }, [teamPages, order.page]);


     const provinces = useMemo(() => {
        if (!appData.locations) return [];
        return [...new Set(appData.locations.map((loc: any) => loc.Province))].sort();
    }, [appData.locations]);

    const districts = useMemo(() => {
        if (!appData.locations || !order.customer.province) return [];
        return [...new Set(appData.locations
            .filter((loc: any) => loc.Province === order.customer.province)
            .map((loc: any) => loc.District))]
            .sort();
    }, [appData.locations, order.customer.province]);

    const sangkats = useMemo(() => {
        if (!appData.locations || !order.customer.province || !order.customer.district) return [];
        return [...new Set(appData.locations
            .filter((loc: any) => loc.Province === order.customer.province && loc.District === order.customer.district)
            .map((loc: any) => loc.Sangkat)
            .filter(Boolean))]
            .sort();
    }, [appData.locations, order.customer.province, order.customer.district]);

    useEffect(() => {
        const newSubtotal = order.products.reduce((acc: number, p: ProductType) => acc + p.total, 0);
        const newGrandTotal = newSubtotal + (Number(order.customer.shippingFee) || 0);
        
        if (newSubtotal !== order.subtotal || newGrandTotal !== order.grandTotal) {
            setOrder((prev: any) => ({
                ...prev,
                subtotal: newSubtotal,
                grandTotal: newGrandTotal
            }));
        }
    }, [order.products, order.customer.shippingFee]);

    // --- Barcode Scanner Logic ---

    useEffect(() => {
        if (!scannedCode) return;

        const foundProduct: MasterProduct | undefined = appData.products.find(
            (p: MasterProduct) => p.Barcode && p.Barcode.trim() === scannedCode.code.trim()
        );
        
        const addOrUpdateProduct = (productData: MasterProduct) => {
             setOrder((prevOrder: any) => {
                const existingProductIndex = prevOrder.products.findIndex(
                    (p: ProductType) => p.name === productData.ProductName
                );

                let updatedProducts;

                if (existingProductIndex > -1) {
                    const productToUpdate = { ...prevOrder.products[existingProductIndex] };
                    productToUpdate.quantity += 1;
                    const recalculated = calculateProductFields(productToUpdate, appData.products);
                    updatedProducts = [...prevOrder.products];
                    updatedProducts[existingProductIndex] = recalculated;

                } else {
                    const emptyProductIndex = prevOrder.products.findIndex((p: ProductType) => !p.name);
                    
                    const newProduct: ProductUIState = {
                        ...initialProductState,
                        id: Date.now(),
                        name: productData.ProductName,
                        quantity: 1,
                        originalPrice: productData.Price,
                        cost: productData.Cost,
                        image: productData.ImageURL,
                    };
                    const recalculated = calculateProductFields(newProduct, appData.products);

                    if (emptyProductIndex > -1) {
                        updatedProducts = [...prevOrder.products];
                        updatedProducts[emptyProductIndex] = recalculated;
                    } else {
                        updatedProducts = [...prevOrder.products, recalculated];
                    }
                }
                return { ...prevOrder, products: updatedProducts };
            });
        };

        if (foundProduct) {
            addOrUpdateProduct(foundProduct);
        } else {
            alert(`រកមិនឃើញផលិតផលដែលមាន Barcode: ${scannedCode.code}`);
        }
    }, [scannedCode, appData.products]);

    useEffect(() => {
        if (isScannerVisible) {
            const scanner = new window.Html5Qrcode("barcode-reader");
            scannerRef.current = scanner;
            
            const onScanSuccess = (decodedText: string) => {
                setScannedCode({ code: decodedText, timestamp: Date.now() });
            };
            const onScanFailure = (error: any) => { /* Ignore */ };
            const config = { fps: 10, qrbox: { width: 250, height: 250 } };

            scanner.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
              .catch((err: any) => {
                  console.error("Scanner start failed", err);
                  alert("Could not start barcode scanner. Please ensure camera permissions are granted.");
                  setIsScannerVisible(false);
              });
        }

        return () => {
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop()
                    .catch((err: any) => console.error("Scanner stop failed", err));
            }
        };
    }, [isScannerVisible]);

    // --- End Barcode Scanner Logic ---

    const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        if (name === 'phone') {
            let phoneNumber = value.replace(/[^0-9]/g, '');

            if (phoneNumber.length > 1 && phoneNumber.startsWith('00')) {
                 phoneNumber = '0' + phoneNumber.substring(2);
            } else if (phoneNumber.length > 0 && !phoneNumber.startsWith('0')) {
                 phoneNumber = '0' + phoneNumber;
            }
            
            // Refactored carrier lookup for improved readability
            let foundCarrier = null;
            if (phoneNumber.length >= 2 && appData.phoneCarriers) {
                foundCarrier = appData.phoneCarriers.find((carrier: any) => 
                    (carrier.Prefixes || '').split(',').some((prefix: string) => {
                        const trimmedPrefix = prefix.trim();
                        return trimmedPrefix && phoneNumber.startsWith(trimmedPrefix);
                    })
                );
            }
            
            setCarrierLogo(foundCarrier ? convertGoogleDriveUrl(foundCarrier.CarrierLogoURL) : '');

            setOrder((prev: any) => ({
                ...prev,
                customer: { ...prev.customer, phone: phoneNumber }
            }));
            return;
        }

        if (name === 'shippingFee') {
            const numValue = value === '' ? '' : parseFloat(value);
            if (numValue !== '' && isNaN(numValue)) return; 
    
            setOrder((prev: any) => ({
                ...prev,
                customer: { ...prev.customer, shippingFee: numValue }
            }));
            return;
        }

        setOrder((prev: any) => {
            let newCustomerState = { ...prev.customer, [name]: value };
    
            if (name === 'province') {
                newCustomerState.district = '';
                newCustomerState.sangkat = '';
            } else if (name === 'district') {
                newCustomerState.sangkat = '';
            }
            
            return {
                ...prev,
                customer: newCustomerState
            };
        });
    };
    
    const calculateProductFields = (product: ProductUIState, allMasterProducts: MasterProduct[]): ProductUIState => {
        const updated = { ...product };
        const masterProduct = allMasterProducts.find(p => p.ProductName === updated.name);
    
        if (!masterProduct) {
            updated.total = (Number(updated.quantity) || 0) * (Number(updated.finalPrice) || 0);
            return updated;
        }
    
        // Ensure types are correct
        updated.quantity = Number(updated.quantity) || 1;
        updated.originalPrice = Number(masterProduct.Price) || 0;
        updated.cost = Number(masterProduct.Cost) || 0;
    
        const originalTotal = updated.quantity * updated.originalPrice;
        let finalTotal = originalTotal;
        let totalDiscountAmount = 0;
    
        switch (updated.discountType) {
            case 'percent':
                const discountPercent = Number(updated.discountPercentInput) || 0;
                totalDiscountAmount = originalTotal * (discountPercent / 100);
                finalTotal = originalTotal - totalDiscountAmount;
                break;
    
            case 'amount':
                const discountAmount = Number(updated.discountAmountInput) || 0;
                if (updated.quantity > 1 && updated.applyDiscountToTotal) {
                    totalDiscountAmount = discountAmount;
                } else {
                    totalDiscountAmount = discountAmount * updated.quantity;
                }
                finalTotal = originalTotal - totalDiscountAmount;
                break;
    
            case 'custom':
                const customFinalPrice = Number(updated.finalPrice) || 0;
                finalTotal = updated.quantity * customFinalPrice;
                totalDiscountAmount = originalTotal - finalTotal;
                updated.finalPrice = customFinalPrice; // ensure it's a number
                break;
        }
    
        updated.total = finalTotal;
        updated.finalPrice = updated.quantity > 0 ? finalTotal / updated.quantity : 0;
        updated.discountPercent = originalTotal > 0 ? (totalDiscountAmount / originalTotal) * 100 : 0;
    
        return updated;
    };
    
    const handleProductUpdate = (index: number, field: keyof ProductUIState, value: any) => {
         setOrder((prev: any) => {
            const updatedProducts = [...prev.products];
            let productToUpdate = { ...updatedProducts[index] };
            
            const numericFieldsToSanitize: (keyof ProductUIState)[] = ['discountPercentInput', 'discountAmountInput', 'finalPrice'];
            if (numericFieldsToSanitize.includes(field)) {
                let stringValue = String(value);
                 if (stringValue.startsWith('0') && stringValue.length > 1 && !stringValue.startsWith('0.')) {
                    stringValue = String(parseFloat(stringValue));
                }
                // @ts-ignore
                productToUpdate[field] = stringValue;
            } else {
                // @ts-ignore
                productToUpdate[field] = value;
            }
    
            // When product name changes, reset everything based on master product data
            if (field === 'name') {
                const masterProduct = appData.products.find((p: MasterProduct) => p.ProductName === value);
                if (masterProduct) {
                    productToUpdate.originalPrice = masterProduct.Price;
                    productToUpdate.image = masterProduct.ImageURL;
                    productToUpdate.cost = masterProduct.Cost;
                    // Reset discounts
                    productToUpdate.discountType = 'percent';
                    productToUpdate.discountPercentInput = '';
                    productToUpdate.discountAmountInput = '';
                }
            }
             
            // Reset inputs when switching discount type
            if (field === 'discountType') {
                productToUpdate.discountPercentInput = '';
                productToUpdate.discountAmountInput = '';
                productToUpdate.finalPrice = productToUpdate.originalPrice;
            }
    
            const recalculatedProduct = calculateProductFields(productToUpdate, appData.products);
            updatedProducts[index] = recalculatedProduct;
            
            return { ...prev, products: updatedProducts };
        });
    };
    
    
    const handlePageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const pageName = e.target.value;
        const pageData = teamPages.find((p: any) => p.PageName === pageName);
        setOrder((prev: any) => ({
            ...prev,
            page: pageName,
            telegramValue: pageData ? pageData.TelegramValue : '',
        }));
    };

    const addProduct = () => {
        setOrder((prev: any) => ({
            ...prev,
            products: [...prev.products, {...initialProductState, id: Date.now()}]
        }));
    };
    
    const removeProduct = (index: number) => {
        if (order.products.length <= 1) return;
        const updatedProducts = order.products.filter((_: any, i: number) => i !== index);
        setOrder((prev: any) => ({ ...prev, products: updatedProducts }));
    };

    const handleShippingMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const methodName = e.target.value;
        const methodInfo = appData.shippingMethods?.find((s: any) => s.MethodName === methodName) || null;
        
        setSelectedShippingMethod(methodInfo);
        setShippingLogo(methodInfo ? convertGoogleDriveUrl(methodInfo.MethodLogoURL) : '');
        setDriverPhoto(''); // Reset driver photo when shipping method changes

        setOrder((prev: any) => ({
            ...prev,
            shipping: { 
                ...prev.shipping, 
                method: methodName,
                details: methodInfo?.RequireDriverSelection ? '' : methodName 
            }
        }));
    };
    
    const handleShippingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        let sanitizedValue = value;
         if (name === 'cost') {
            if (sanitizedValue.startsWith('0') && sanitizedValue.length > 1 && !sanitizedValue.startsWith('0.')) {
                sanitizedValue = String(parseFloat(sanitizedValue));
            }
        }
        setOrder((prev: any) => ({
            ...prev,
            shipping: {
                ...prev.shipping,
                [name]: sanitizedValue,
            },
        }));
    };

    const handleDriverChange = (driverName: string) => {
        const driverInfo = appData.drivers?.find((d: any) => d.DriverName === driverName) || null;
        setDriverPhoto(driverInfo ? convertGoogleDriveUrl(driverInfo.DriverPhotoURL) : '');
        setOrder((prev: any) => ({
            ...prev,
            shipping: { ...prev.shipping, details: driverName }
        }));
    };

    const handleBankChange = (bankName: string) => {
        const bankInfo = appData.bankAccounts?.find((b: any) => b.BankName === bankName) || null;
        setBankLogo(bankInfo ? convertGoogleDriveUrl(bankInfo.BankLogoURL) : '');
        setOrder((prev: any) => ({
            ...prev,
            payment: { ...prev.payment, info: bankName }
        }));
    };

    const handleShippingOptionChange = (option: 'charge' | 'free') => {
        setShippingFeeOption(option);
        if (option === 'free') {
            setOrder((prev: any) => ({
                ...prev,
                customer: { ...prev.customer, shippingFee: 0 }
            }));
        } else {
            setOrder((prev: any) => ({
                ...prev,
                customer: { ...prev.customer, shippingFee: '' }
            }));
        }
    };
    
    const handleSearchOnMaps = () => {
        if (!process.env.API_KEY || process.env.API_KEY === "YOUR_GEMINI_API_KEY") {
            alert("មុខងារផែនទីត្រូវការ API Key។ សូមកំណត់រចនាសម្ព័ន្ធ API Key ជាមុនសិន។\n(Map feature requires an API Key. Please configure it first.)");
            return;
        }
        const { province, district, sangkat, additionalLocation } = order.customer;
        const queryParts = [additionalLocation, sangkat, district, province, 'Cambodia'].filter(Boolean);
        const query = queryParts.join(', ');
        const mapsUrl = `https://www.google.com/maps/embed/v1/search?key=${process.env.API_KEY}&q=${encodeURIComponent(query)}`;
        setMapSearchUrl(mapsUrl);
        setIsMapModalOpen(true);
    };


    const validateStep = (step: number): boolean => {
        setError(''); 
        switch (step) {
            case 1:
                if (!order.customer.name || !order.customer.phone || !order.customer.province) {
                    setError('សូមបំពេញឈ្មោះ, លេខទូរស័ព្ទ, និងខេត្ត/ក្រុង។');
                    return false;
                }
                if (!order.page) {
                     setError('សូមជ្រើសរើស Page។');
                    return false;
                }
                if (shippingFeeOption === 'charge' && (order.customer.shippingFee === '' || order.customer.shippingFee === null || order.customer.shippingFee <= 0)) {
                    setError('នៅពេលជ្រើសរើស "គិតថ្លៃសេវា", សូមបញ្ចូលតម្លៃដឹកជញ្ជូនដែលធំជាងសូន្យ។');
                    return false;
                }
                return true;
            
            case 2:
                if (order.products.length === 0 || order.products.some((p: ProductType) => !p.name || p.quantity <= 0)) {
                    setError('សូមបន្ថែមផលិតផលយ៉ាងហោចណាស់មួយ ហើយត្រូវប្រាកដថាបានបំពេញឈ្មោះ និងចំនួន។');
                    return false;
                }
                return true;

            case 3:
                if (!order.shipping.method) {
                    setError('សូមជ្រើសរើសវិធីសាស្រ្តដឹកជញ្ជូន។');
                    return false;
                }
                if (selectedShippingMethod?.RequireDriverSelection && !order.shipping.details) {
                    setError('វិធីសាស្រ្តនេះតម្រូវឱ្យជ្រើសរើសអ្នកដឹក។');
                    return false;
                }
                return true;
            case 4:
                 if (order.payment.status === 'Paid' && !order.payment.info) {
                    setError('នៅពេលទូទាត់រួច, សូមជ្រើសរើសព័ត៌មានគណនីធនាគារ។');
                    return false;
                }
                 if (order.telegram.schedule && !order.telegram.time) {
                    setError('សូមជ្រើសរើសពេលវេលាសម្រាប់ផ្ញើសារ');
                    return false;
                }
                return true;
            
            default:
                return true;
        }
    };
    
    const nextStep = () => {
        if (!validateStep(currentStep)) return;
        setError('');
        if (currentStep < STEPS.length) {
            setCurrentStep(currentStep + 1);
        }
    };

    const prevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const submitOrder = async () => {
        // Final validation check before submitting
        for (const step of STEPS) {
            if (!validateStep(step.number)) {
                setCurrentStep(step.number); // Jump to the invalid step
                return;
            }
        }
        
        setLoading(true);
        setError('');
        setSubmissionStatus(null);

        const payload = {
            currentUser,
            selectedTeam: team,
            page: order.page,
            telegramValue: order.telegramValue,
            customer: {
                ...order.customer,
                shippingFee: Number(order.customer.shippingFee) || 0,
            },
            products: order.products.map((p: ProductType) => ({
                name: p.name,
                quantity: p.quantity,
                originalPrice: p.originalPrice,
                finalPrice: p.finalPrice,
                total: p.total,
                colorInfo: p.colorInfo,
                cost: p.cost,
            })),
            shipping: {
                ...order.shipping,
                cost: Number(order.shipping.cost) || 0,
            },
            payment: order.payment,
            telegram: order.telegram,
            subtotal: order.subtotal,
            grandTotal: order.grandTotal,
            note: order.note,
        };

        try {
            const response = await fetch(`${WEB_APP_URL}/api/submit-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok || result.status !== 'success') {
                throw new Error(result.message || 'Failed to create order.');
            }
            
            setSubmissionStatus({ type: 'success', message: `ការកម្មង់បានបង្កើតដោយជោគជ័យ! Order ID: ${result.orderId}` });
            setTimeout(() => {
                onSaveSuccess();
            }, 3000);

        } catch(err: any) {
            setSubmissionStatus({ type: 'error', message: `ការបញ្ជូនបរាជ័យ: ${err.message}` });
            setTimeout(() => {
                setSubmissionStatus(null);
            }, 3000);
        } finally {
            setLoading(false);
        }
    };


    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <fieldset className="border border-gray-600 p-4 rounded-lg animate-fade-in">
                        <legend className="px-2 text-lg font-semibold text-blue-300">ព័ត៌មានអតិថិជន & Page</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <select name="page" value={order.page} className="form-select" onChange={handlePageChange} required>
                                <option value="">-- ជ្រើសរើស Page* --</option>
                                {teamPages.map((p: any) => <option key={p.PageName} value={p.PageName}>{p.PageName}</option>)}
                            </select>
                            <div></div>
                            <input type="text" name="name" value={order.customer.name} placeholder="ឈ្មោះអតិថិជន*" className="form-input" onChange={handleCustomerChange} required />
                            <div className="relative">
                                <input 
                                    type="tel" 
                                    name="phone" 
                                    value={order.customer.phone} 
                                    placeholder="លេខទូរស័ព្ទ*" 
                                    className="form-input pr-12"
                                    onChange={handleCustomerChange} 
                                    required 
                                />
                                {carrierLogo && (
                                    <img 
                                        src={carrierLogo} 
                                        alt="Carrier" 
                                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-auto object-contain cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => previewImage(carrierLogo)}
                                    />
                                )}
                            </div>
                            
                             <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <select name="province" value={order.customer.province} className="form-select" onChange={handleCustomerChange} required>
                                    <option value="">-- ជ្រើសរើស ខេត្ត/រាជធានី* --</option>
                                    {provinces.map((p: string) => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <select name="district" value={order.customer.district} className="form-select" onChange={handleCustomerChange} disabled={!order.customer.province || districts.length === 0}>
                                    <option value="">-- ជ្រើសរើស ស្រុក/ខណ្ឌ --</option>
                                    {districts.map((d: string) => <option key={d} value={d}>{d}</option>)}
                                </select>
                                <select name="sangkat" value={order.customer.sangkat} className="form-select" onChange={handleCustomerChange} disabled={!order.customer.district || sangkats.length === 0}>
                                    <option value="">-- ជ្រើសរើស ឃុំ/សង្កាត់ --</option>
                                    {sangkats.map((s: string) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                             <div className="md:col-span-2">
                                <label htmlFor="additionalLocation" className="block text-sm font-medium text-gray-400 mb-2">
                                    ទីតាំងលម្អិត (ផ្ទះលេខ, ផ្លូវ) ឬ Link Google Map
                                </label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        id="additionalLocation"
                                        name="additionalLocation"
                                        value={order.customer.additionalLocation}
                                        placeholder="បិទភ្ជាប់ Link Map ឬបញ្ចូលទីតាំងលម្អិតនៅទីនេះ"
                                        className="form-input w-full"
                                        onChange={handleCustomerChange}
                                    />
                                    <button 
                                        type="button" 
                                        onClick={handleSearchOnMaps} 
                                        className="btn btn-secondary flex-shrink-0 !p-2.5"
                                        title="ស្វែងរកនៅលើ Google Maps"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-400 mb-2">ថ្លៃសេវាដឹកជញ្ជូន</label>
                                <div className="flex items-center space-x-2">
                                    <button
                                        type="button"
                                        onClick={() => handleShippingOptionChange('charge')}
                                        className={`flex-1 btn ${shippingFeeOption === 'charge' ? 'btn-primary' : 'btn-secondary'}`}
                                    >
                                        គិតថ្លៃសេវា
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleShippingOptionChange('free')}
                                        className={`flex-1 btn ${shippingFeeOption === 'free' ? '!bg-red-600 hover:!bg-red-700' : 'btn-secondary'}`}
                                    >
                                        មិនគិតថ្លៃសេវា
                                    </button>
                                </div>
                                {shippingFeeOption === 'charge' && (
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        name="shippingFee"
                                        value={order.customer.shippingFee}
                                        placeholder="តម្លៃដឹកជញ្ជូន (ឧ. 1.5)*"
                                        className="form-input mt-2"
                                        onChange={handleCustomerChange}
                                        required
                                    />
                                )}
                            </div>
                        </div>
                    </fieldset>
                );
            case 2:
                return (
                     <fieldset className="border border-gray-600 p-4 rounded-lg animate-fade-in">
                        <legend className="px-2 text-lg font-semibold text-blue-300">ផលិតផល</legend>
                        <div className="space-y-6">
                             {order.products.map((p: ProductUIState, index: number) => {
                                const calculatedDiscountAmount = p.originalPrice * p.quantity - p.total;
                                return(
                                <div key={p.id} className="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-600 relative">
                                    <button type="button" onClick={() => removeProduct(index)} className="absolute -top-3 -right-3 text-red-400 bg-gray-800 rounded-full h-7 w-7 flex items-center justify-center border border-gray-600 hover:bg-red-500 hover:text-white" disabled={order.products.length <= 1}>
                                         &times;
                                    </button>

                                    {/* Row 1: Main Info */}
                                    <div className="grid grid-cols-12 gap-x-4 gap-y-2 items-center">
                                        <div className="col-span-3 sm:col-span-2">
                                            <img 
                                                src={convertGoogleDriveUrl(p.image) || 'https://placehold.co/100x100/374151/4b5563?text=N/A'} 
                                                alt={p.name || 'Product'} 
                                                className="w-16 h-16 object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                                                onClick={() => previewImage(convertGoogleDriveUrl(p.image) || '')}
                                            />
                                        </div>
                                        <div className="col-span-9 sm:col-span-5">
                                            <label className="input-label">ផលិតផល*</label>
                                            <select value={p.name} onChange={(e) => handleProductUpdate(index, 'name', e.target.value)} className="form-select" required>
                                                <option value="">ជ្រើសរើស</option>
                                                {appData.products?.map((prod: MasterProduct) => <option key={prod.ProductName} value={prod.ProductName}>{prod.ProductName}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-4 sm:col-span-2">
                                            <label className="input-label">ចំនួន*</label>
                                            <input type="number" min="1" value={p.quantity} onChange={(e) => handleProductUpdate(index, 'quantity', Number(e.target.value))} className="form-input text-center" />
                                        </div>
                                        <div className="col-span-8 sm:col-span-3">
                                            <label className="input-label">ពណ៌/សម្គាល់</label>
                                            <input type="text" placeholder="e.g. Red, Size 42" value={p.colorInfo} onChange={(e) => handleProductUpdate(index, 'colorInfo', e.target.value)} className="form-input" />
                                        </div>
                                    </div>
                                    
                                    {/* Row 2: Pricing */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="info-display">
                                            <span className="info-label">តម្លៃដើម (ឯកតា)</span>
                                            <span className="info-value">${p.originalPrice.toFixed(2)}</span>
                                        </div>
                                         <div className="info-display">
                                            <span className="info-label">តម្លៃដើម (សរុប)</span>
                                            <span className="info-value">${(p.originalPrice * p.quantity).toFixed(2)}</span>
                                        </div>
                                    </div>

                                    {/* Row 3: Discount */}
                                    <div className="border-t border-gray-600 pt-4 space-y-3">
                                        <div className="flex flex-wrap gap-4 items-center">
                                            <label className="input-label">ប្រភេទបញ្ចុះតម្លៃ:</label>
                                            <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
                                                {(['percent', 'amount', 'custom'] as const).map(type => (
                                                    <label key={type} className="flex items-center cursor-pointer">
                                                        <input type="radio" name={`discountType-${p.id}`} value={type} checked={p.discountType === type} onChange={() => handleProductUpdate(index, 'discountType', type)} className="form-radio h-4 w-4 bg-gray-700 border-gray-500 text-blue-500 focus:ring-blue-500"/>
                                                        <span className="ml-2 text-sm">
                                                            {type === 'percent' ? 'ជា %' : type === 'amount' ? 'ជាប្រាក់' : 'Custom'}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                            {p.discountType === 'percent' && (
                                                <div className="relative">
                                                    <input type="number" placeholder="Discount %" value={p.discountPercentInput} onChange={e => handleProductUpdate(index, 'discountPercentInput', e.target.value)} className="form-input"/>
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                                                </div>
                                            )}
                                            {p.discountType === 'amount' && (
                                                <div>
                                                    <div className="relative">
                                                      <input type="number" placeholder="Discount Amount" value={p.discountAmountInput} onChange={e => handleProductUpdate(index, 'discountAmountInput', e.target.value)} className="form-input"/>
                                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                                    </div>
                                                    {p.quantity > 1 && (
                                                         <label className="flex items-center mt-2 text-sm">
                                                            <input type="checkbox" checked={p.applyDiscountToTotal} onChange={e => handleProductUpdate(index, 'applyDiscountToTotal', e.target.checked)} className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-blue-600 focus:ring-blue-500" />
                                                            <span className="ml-2">បញ្ចុះតម្លៃលើតម្លៃសរុប</span>
                                                         </label>
                                                    )}
                                                </div>
                                            )}
                                            {p.discountType === 'custom' && (
                                                 <div className="relative">
                                                     <input type="number" placeholder="Final Price (per item)" value={p.finalPrice} onChange={e => handleProductUpdate(index, 'finalPrice', e.target.value)} className="form-input"/>
                                                     <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                                 </div>
                                            )}
                                            </div>
                                            <div className="info-display !bg-gray-700/60">
                                                <span className="info-label">បញ្ចុះតម្លៃសរុប</span>
                                                <span className="info-value text-yellow-300">
                                                    -${calculatedDiscountAmount.toFixed(2)} ({p.discountPercent.toFixed(1)}%)
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Row 4: Summary */}
                                    <div className="flex justify-between items-center bg-gray-900/50 p-3 rounded-lg mt-2">
                                        <div className="text-sm">
                                            <span className="text-gray-400">តម្លៃចុងក្រោយ (ឯកតា): </span>
                                            <span className="font-semibold">${p.finalPrice.toFixed(2)}</span>
                                        </div>
                                        <div className="text-right">
                                             <span className="text-gray-400 text-sm">សរុប</span>
                                             <p className="font-bold text-xl text-blue-300">${p.total.toFixed(2)}</p>
                                        </div>
                                    </div>
                                </div>
                               )})}
                        </div>
                        <div className="flex items-center space-x-4 mt-6">
                            <button type="button" onClick={addProduct} className="btn btn-secondary">បន្ថែមផលិតផល</button>
                            <button type="button" onClick={() => setIsScannerVisible(true)} className="btn btn-secondary flex items-center" disabled={isScannerVisible}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4m12 4V4h-4M4 16v4h4m12-4v4h-4M7 12h10" />
                                </svg>
                                Scan Barcode
                            </button>
                        </div>
                         {isScannerVisible && (
                            <div className="my-4 p-4 border border-dashed border-gray-500 rounded-lg">
                                <h4 className="text-center font-semibold mb-2">ដាក់កាមេរ៉ាទៅលើបាកូដ</h4>
                                <div id="barcode-reader" style={{ width: '100%', maxWidth: '500px', margin: 'auto' }}></div>
                                <button type="button" onClick={() => setIsScannerVisible(false)} className="btn btn-secondary mt-4 w-full">បិទ Scanner</button>
                            </div>
                        )}
                    </fieldset>
                );
            case 3:
                return (
                    <fieldset className="border border-gray-600 p-4 rounded-lg animate-fade-in">
                        <legend className="px-2 text-lg font-semibold text-blue-300">ដឹកជញ្ជូន</legend>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                                <div className="relative flex-grow">
                                    <select name="method" value={order.shipping.method} onChange={handleShippingMethodChange} className="form-select">
                                        <option value="">ជ្រើសរើសសេវាដឹក</option>
                                        {appData.shippingMethods?.map((s: any) => <option key={s.MethodName} value={s.MethodName}>{s.MethodName}</option>)}
                                    </select>
                                </div>
                                {shippingLogo && (
                                    <img src={shippingLogo} alt="Shipping Logo" className="h-10 w-16 object-contain bg-white/10 p-1 rounded-md flex-shrink-0" />
                                )}
                            </div>
                            <div className="relative">
                                <input
                                    type="number"
                                    name="cost"
                                    placeholder="តម្លៃដឹក (ថ្លៃសេវា អោយអ្នកដឹក)"
                                    value={order.shipping.cost}
                                    className="form-input pr-8"
                                    onChange={handleShippingChange}
                                />
                                 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                            </div>
                            {selectedShippingMethod?.RequireDriverSelection && (
                                <div className="relative md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-400 mb-2">ជ្រើសរើសអ្នកដឹក *</label>
                                    <select
                                        name="details"
                                        value={order.shipping.details}
                                        onChange={(e) => handleDriverChange(e.target.value)}
                                        className="form-select pr-12"
                                    >
                                        <option value="">-- ជ្រើសរើស --</option>
                                        {appData.drivers?.map((d: any) => <option key={d.DriverName} value={d.DriverName}>{d.DriverName}</option>)}
                                    </select>
                                     {driverPhoto && (
                                        <img src={driverPhoto} alt="Driver" className="absolute right-2 top-1/2 -translate-y-1/2 mt-3 h-8 w-8 object-cover rounded-full pointer-events-none" />
                                    )}
                                </div>
                            )}
                         </div>
                    </fieldset>
                );
            case 4:
                return (
                    <div className="animate-fade-in space-y-6">
                         <div>
                            <h3 className="text-lg font-semibold text-blue-300 mb-2">สรุปรายการ</h3>
                             <div className="p-4 bg-gray-800/50 rounded-lg text-sm space-y-2 border border-gray-700">
                                <p><strong>Page:</strong> {order.page}</p>
                                <p><strong>ឈ្មោះ:</strong> {order.customer.name} ({order.customer.phone})</p>
                                <p><strong>អាសយដ្ឋាន:</strong> {`${order.customer.additionalLocation}, ${order.customer.sangkat}, ${order.customer.district}, ${order.customer.province}`.replace(/^,|,$/g, '').trim()}</p>
                                <p><strong>ការទូទាត់:</strong> <span className={order.payment.status === 'Paid' ? 'text-green-400' : 'text-yellow-400'}>{order.payment.status === 'Paid' ? `Paid (${order.payment.info})` : 'Unpaid (COD)'}</span></p>
                            </div>
                        </div>
                         <div>
                            <ul className="space-y-2">
                                {order.products.map((p: ProductType) => (
                                    <li key={p.id} className="p-2 bg-gray-800/50 rounded-lg flex justify-between items-center text-sm border border-gray-700">
                                        <span>{p.quantity} x {p.name} ({p.colorInfo || 'N/A'}) @ ${p.finalPrice.toFixed(2)}</span>
                                        <span className="font-bold">${p.total.toFixed(2)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="text-right space-y-2 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                             <p>សរុប (Subtotal): <span className="font-bold">${order.subtotal.toFixed(2)}</span></p>
                             <p>ដឹកជញ្ជូន: <span className="font-bold">${(Number(order.customer.shippingFee) || 0).toFixed(2)}</span></p>
                             <hr className="border-gray-600 my-1" />
                             <p className="text-xl text-blue-300">សរុបរួម (Grand Total): <span className="font-bold text-2xl">${order.grandTotal.toFixed(2)}</span></p>
                        </div>

                        <fieldset className="border border-gray-600 p-4 rounded-lg">
                            <legend className="px-2 text-lg font-semibold text-blue-300">ទូទាត់</legend>
                            <div className="space-y-4">
                                <select name="status" value={order.payment.status} onChange={(e) => setOrder({...order, payment: {...order.payment, status: e.target.value, info: ''}})} className="form-select">
                                    <option value="Unpaid">មិនទាន់ទូទាត់ (COD)</option>
                                    <option value="Paid">ទូទាត់រួច</option>
                                </select>
                                {order.payment.status === 'Paid' && (
                                     <div className="flex items-center gap-2">
                                        <div className="relative flex-grow">
                                            <select name="info" value={order.payment.info} onChange={(e) => handleBankChange(e.target.value)} className="form-select">
                                                <option value="">ជ្រើសរើសគណនី</option>
                                                {appData.bankAccounts?.map((b: any) => <option key={b.BankName} value={b.BankName}>{b.BankName} ({b.AccountName})</option>)}
                                            </select>
                                        </div>
                                        {bankLogo && (
                                            <img src={bankLogo} alt="Bank Logo" className="h-10 w-16 object-contain bg-white/10 p-1 rounded-md" />
                                        )}
                                     </div>
                                )}
                            </div>
                        </fieldset>

                        <fieldset className="border border-gray-600 p-4 rounded-lg">
                            <legend className="px-2 text-lg font-semibold text-blue-300">ការកំណត់ Telegram</legend>
                            <div className="space-y-4">
                                <label className="flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={order.telegram.schedule}
                                        onChange={e => setOrder({...order, telegram: {...order.telegram, schedule: e.target.checked}})}
                                        className="form-radio h-4 w-4 bg-gray-700 border-gray-500 text-blue-500 focus:ring-blue-500"
                                    />
                                    <span className="ml-3 text-gray-300">កំណត់ពេលផ្ញើសារ</span>
                                </label>
                                {order.telegram.schedule && (
                                    <div className="animate-fade-in">
                                        <label className="input-label">ពេលវេលាដែលត្រូវផ្ញើ</label>
                                        <input 
                                            type="datetime-local" 
                                            value={order.telegram.time || ''}
                                            onChange={e => setOrder({...order, telegram: {...order.telegram, time: e.target.value}})}
                                            className="form-input"
                                            min={new Date().toISOString().slice(0, 16)}
                                        />
                                    </div>
                                )}
                            </div>
                        </fieldset>
                        
                        <textarea name="note" placeholder="ចំណាំ..." value={order.note} rows={4} onChange={(e) => setOrder({...order, note: e.target.value})} className="form-textarea"></textarea>
                    </div>
                );
            default: return null;
        }
    };

    const SubmissionStatusModal = () => {
        if (!submissionStatus) return null;
    
        const isSuccess = submissionStatus.type === 'success';
        const icon = isSuccess ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        );
    
        return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in p-4">
                <div className={`page-card text-center flex flex-col items-center transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale`}
                     style={{animationDelay: '0.1s'}}>
                    {icon}
                    <p className="text-lg font-semibold text-white mt-4 max-w-sm">{submissionStatus.message}</p>
                </div>
            </div>
        );
    };

    return (
        <div className="w-full max-w-4xl mx-auto">
             <SubmissionStatusModal />
            <MapModal 
                isOpen={isMapModalOpen}
                onClose={() => setIsMapModalOpen(false)}
                url={mapSearchUrl}
            />
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-white">បង្កើតការកម្មង់ថ្មី (ក្រុម {team})</h1>
                <button onClick={onCancel} className="btn btn-secondary">បោះបង់</button>
            </div>
             <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fadeIn 0.5s ease-in-out forwards; }
                .input-label { display: block; font-size: 0.875rem; font-weight: 500; color: #9ca3af; margin-bottom: 0.5rem; }
                .info-display { background-color: #1f2937; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid #374151; }
                .info-label { display: block; font-size: 0.75rem; color: #6b7280; }
                .info-value { display: block; font-weight: 600; font-size: 1.125rem; color: #d1d5db; margin-top: 0.25rem; }
                 @keyframes fade-in-scale {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .animate-fade-in-scale { animation: fade-in-scale 0.3s forwards; }
            `}</style>
            <div className="page-card">
                <div className="progress-bar">
                    <div className="progress-line"></div>
                    <div className="progress-line-active" style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}></div>
                    {STEPS.map(step => (
                        <div key={step.number} className={`progress-step ${currentStep >= step.number ? 'active' : ''}`}>
                            <div className="progress-step-circle">{step.number}</div>
                            <div className="progress-step-label">{step.title}</div>
                        </div>
                    ))}
                </div>
                
                <form onSubmit={(e) => e.preventDefault()} className="space-y-8 mt-8">
                    {renderStepContent()}
                    {error && <p className="text-red-400 mt-4 text-center bg-red-900/30 p-3 rounded-md">{error}</p>}
                    <div className="flex justify-between pt-4 border-t border-gray-700">
                        <button type="button" onClick={prevStep} className="btn btn-secondary" disabled={currentStep === 1 || loading}>ត្រឡប់ក្រោយ</button>
                        {currentStep < STEPS.length ? (
                            <button type="button" onClick={nextStep} className="btn btn-primary">
                                {currentStep === 3 ? 'ទៅកាន់ការផ្ទៀងផ្ទាត់' : 'បន្ត'}
                            </button>
                        ) : (
                             <button type="button" onClick={submitOrder} className="btn btn-primary" disabled={loading}>
                                {loading ? <Spinner size="sm" /> : 'បញ្ជូនការកម្មង់'}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateOrderPage;