import React, { createContext, useState, useCallback } from 'react';

export const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type, message, title = '') => {
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newToast = { id, type, message, title };

    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  const success = useCallback((message, title = 'Success') => {
    addToast('success', message, title);
  }, [addToast]);

  const error = useCallback((message, title = 'Error') => {
    addToast('error', message, title);
  }, [addToast]);

  const info = useCallback((message, title = 'Info') => {
    addToast('info', message, title);
  }, [addToast]);

  const value = {
    toasts,
    toast: {
      success,
      error,
      info,
    },
    removeToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-container" role="region" aria-label="Notifications">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`toast toast-${t.type}`}
              onClick={() => removeToast(t.id)}
              style={{ cursor: 'pointer' }}
            >
              <div>
                {t.title && <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{t.title}</div>}
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{t.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
};

export default ToastContext;
