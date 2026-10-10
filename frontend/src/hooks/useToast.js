import { useCallback, useState } from 'react';

export function useToast() {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'success') => {
        const id = `${Date.now()}-${Math.random()}`;

        setToasts((current) => [
            ...current,
            { id, message: String(message), type },
        ]);

        return id;
    }, []);

    const dismissToast = useCallback((id) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const success = useCallback((message) => showToast(message, 'success'), [showToast]);
    const error = useCallback((message) => showToast(message, 'error'), [showToast]);
    const info = useCallback((message) => showToast(message, 'info'), [showToast]);
    const warning = useCallback((message) => showToast(message, 'warning'), [showToast]);

    return {
        toasts,
        showToast,
        dismissToast,
        success,
        error,
        info,
        warning,
    };
}