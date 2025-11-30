
import { useState, useEffect, useCallback } from 'react';

/**
 * A custom hook that syncs a state variable with a URL query parameter.
 * This allows the state to be preserved in the browser history, enabling Back/Forward navigation.
 * 
 * @param param The name of the query parameter (e.g., 'view', 'tab').
 * @param defaultValue The default value if the parameter is missing.
 * @returns [state, setState] tuple.
 */
export function useUrlState<T extends string>(param: string, defaultValue: T): [T, (newValue: T) => void] {
    const [state, setState] = useState<T>(() => {
        if (typeof window === 'undefined') return defaultValue;
        const params = new URLSearchParams(window.location.search);
        return (params.get(param) as T) || defaultValue;
    });

    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const newValue = (params.get(param) as T) || defaultValue;
            setState(newValue);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [param, defaultValue]);

    const updateState = useCallback((newValue: T) => {
        setState(newValue);
        const url = new URL(window.location.href);
        if (newValue === defaultValue) {
            url.searchParams.delete(param);
        } else {
            url.searchParams.set(param, newValue);
        }
        window.history.pushState({}, '', url.toString());
    }, [param, defaultValue]);

    return [state, updateState];
}
