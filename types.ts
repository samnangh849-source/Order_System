
export interface User {
  UserName: string;
  Password?: string; // Should not be stored in client state long-term
  FullName: string;
  Role: string;
  Team: string;
  IsSystemAdmin: boolean;
  ProfilePictureURL: string;
}

// NEW: Represents master product data from the static API
export interface MasterProduct {
  ProductName: string;
  Barcode: string;
  Price: number;
  Cost: number;
  ImageURL: string;
}

// Represents a product item within an order being created
export interface Product {
    id: number;
    name: string;
    quantity: number;
    originalPrice: number;
    finalPrice: number;
    total: number;
    discountPercent: number;
    colorInfo: string;
    image: string;
    cost: number; // NEW: To track product cost for profit calculation
}

export interface Order {
    page: string | null;
    telegramValue: string | null;
    customer: {
        name: string;
        phone: string;
        province: string;
        district: string;
        sangkat: string;
        additionalLocation: string;
        shippingFee: number;
    };
    products: Product[];
    shipping: {
        method: string | null;
        details: string | null;
        cost: number;
    };
    payment: {
        status: 'Paid' | 'Unpaid';
        info: string;
    };
    telegram: {
        schedule: boolean;
        time: string | null;
    };
    subtotal: number;
    grandTotal: number;
    note: string;
}

export interface Target {
    UserName: string;
    Month: string; // YYYY-MM format
    TargetAmount: number;
}

// Updated structure for data from /api/static-data
export interface AppData {
    users: User[];
    products: MasterProduct[];
    pages: any[]; // Formerly teams
    locations: any[];
    shippingMethods: any[];
    drivers: any[];
    bankAccounts: any[];
    phoneCarriers: any[];
    colors: any[];
    settings?: any[];
    admin?: any;
    targets?: Target[]; // NEW for performance tracking
}


// Represents the raw order data from the "AllOrders" sheet (updated)
export interface FullOrder {
    Timestamp: string;
    "Order ID": string;
    User: string;
    Page: string;
    TelegramValue: string;
    "Customer Name": string;
    "Customer Phone": string;
    Location: string;
    "Address Details": string;
    Note: string;
    "Shipping Fee (Customer)": number;
    Subtotal: number;
    "Grand Total": number;
    "Products (JSON)": string;
    "Internal Shipping Method": string;
    "Internal Shipping Details": string;
    "Internal Cost": number;
    "Payment Status": string;
    "Payment Info": string;
    "Telegram Message ID": string;
    Team: string;
    // --- NEW COLUMNS from Go Backend ---
    "Discount ($)": number;
    "Delivery Unpaid": number;
    "Delivery Paid": number;
    "Total Product Cost ($)": number;
}


export interface ParsedProduct {
    name: string;
    quantity: number;
    total: number;
    colorInfo: string;
}

// Represents a parsed order for easier frontend manipulation
export interface ParsedOrder extends Omit<FullOrder, "Products (JSON)"> {
    Products: ParsedProduct[];
}

// Represents a chat message from the backend/websocket
export interface BackendChatMessage {
  Timestamp: string;
  UserName: string;
  MessageType: 'text' | 'image' | 'audio';
  Content: string;
}

// Represents a chat message enhanced for frontend rendering
export interface ChatMessage {
  id: string;
  user: string; // UserName
  fullName: string;
  avatar: string;
  content: string;
  timestamp: string;
  type: 'text' | 'image' | 'audio';
}