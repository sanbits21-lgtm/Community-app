import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface ToastItem {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

const ToastContext = createContext<((message: string, action?: ToastItem['action']) => void) | null>(null);

/** Bottom-of-screen message with an optional action (used for "Deleted — Undo"). Auto-dismisses. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((message: string, action?: ToastItem['action']) => {
    clearTimeout(timer.current);
    setItem({ id: Date.now(), message, ...(action ? { action } : {}) });
    timer.current = setTimeout(() => setItem(null), action ? 9000 : 3500);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-6">
        {item && (
          <div key={item.id} className="rise pointer-events-auto flex items-center gap-4 rounded-xl bg-neutral-900 px-4 py-3 text-white shadow-xl">
            <span>{item.message}</span>
            {item.action && (
              <button
                type="button"
                className="font-bold text-saffron underline"
                onClick={() => {
                  item.action?.run();
                  setItem(null);
                }}
              >
                {item.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const c = useContext(ToastContext);
  if (!c) throw new Error('useToast outside ToastProvider');
  return c;
}
