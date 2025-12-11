
import React, { createContext } from 'react';
import { User, AppData, MasterProduct } from '../types';
import { GoogleGenAI } from "@google/genai";

export interface AppContextType {
    currentUser: User | null;
    appData: AppData;
    login: (user: User) => void;
    logout: () => void;
    refreshData: () => Promise<void>;
    originalAdminUser: User | null;
    returnToAdmin: () => void;
    previewImage: (url: string) => void;
    updateCurrentUser: (updatedData: Partial<User>) => void;
    setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
    geminiAi: GoogleGenAI | null;
    updateProductInData: (productName: string, newData: Partial<MasterProduct>) => void;
    apiKey: string;
    setAppState: (newState: 'login' | 'role_selection' | 'admin_dashboard' | 'user_journey') => void;
    setOriginalAdminUser: React.Dispatch<React.SetStateAction<User | null>>;
    fetchData: (force?: boolean) => Promise<void>;
    setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
    setChatVisibility: (visible: boolean) => void;
}

export const AppContext = createContext<AppContextType>({} as AppContextType);
