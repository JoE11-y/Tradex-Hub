import { useEffect, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';

function NotifIcon({ type }: { type: string }) {
  const cls = 'w-4 h-4';
  switch (type) {
    case 'achievement':
      return (
        <svg className={`${cls} text-indigo-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      );
    case 'level_up':
      return (
        <svg className={`${cls} text-indigo-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 19V5m-7 7l7-7 7 7" />
        </svg>
      );
    case 'xp':
      return (
        <svg className={`${cls} text-emerald-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      );
    case 'liquidation':
      return (
        <svg className={`${cls} text-red-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    default:
      return (
        <svg className={`${cls} text-slate-200`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
  }
}

interface NotifItemProps {
  notif: { id: string; type: string; title: string; message: string };
  onDismiss: (id: string) => void;
}

function NotificationItem({ notif, onDismiss }: NotifItemProps) {
  const dismiss = useCallback(() => onDismiss(notif.id), [onDismiss, notif.id]);

  useEffect(() => {
    const timer = setTimeout(dismiss, 4000);
    return () => clearTimeout(timer);
  }, [dismiss]);

  const bgColor =
    notif.type === 'achievement'
      ? 'bg-indigo-900/90 border-indigo-600/50'
      : notif.type === 'level_up'
        ? 'bg-indigo-900/90 border-indigo-600/50'
        : notif.type === 'xp'
          ? 'bg-emerald-900/90 border-emerald-600/50'
          : notif.type === 'liquidation'
            ? 'bg-red-900/90 border-red-600/50'
            : 'bg-slate-800/90 border-slate-600/50';

  return (
    <div
      className={`${bgColor} border rounded-lg px-4 py-3 shadow-lg animate-in slide-in-from-right cursor-pointer`}
      onClick={dismiss}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5">
          <NotifIcon type={notif.type} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">
            {notif.title}
          </div>
          <div className="text-xs text-slate-300 mt-0.5">
            {notif.message}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationToast() {
  const notifications = useGameStore((s) => s.notifications);
  const dismissNotification = useGameStore((s) => s.dismissNotification);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {notifications.slice(-3).map((notif) => (
        <NotificationItem
          key={notif.id}
          notif={notif}
          onDismiss={dismissNotification}
        />
      ))}
    </div>
  );
}
