'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

interface NavProps {
  role: 'staff' | 'owner';
  name: string;
}

const staffLinks = [
  { href: '/staff', label: 'ホーム', icon: '🏠' },
  { href: '/staff/punch', label: '打刻', icon: '⏱' },
  { href: '/staff/shift-request', label: 'シフト', icon: '📅' },
  { href: '/staff/swap', label: '交換', icon: '🔄' },
  { href: '/staff/my-salary', label: '給料', icon: '💰' },
];

const ownerLinks = [
  { href: '/owner', label: 'ホーム', icon: '🏠' },
  { href: '/owner/shifts', label: 'シフト', icon: '📅' },
  { href: '/owner/auto-schedule', label: '自動調整', icon: '🤖' },
  { href: '/owner/staff', label: 'スタッフ', icon: '👥' },
  { href: '/owner/salary', label: '給料', icon: '💰' },
];

export default function Nav({ role, name }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const links = role === 'owner' ? ownerLinks : staffLinks;
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(data => setUnread(data.unreadCount || 0))
      .catch(() => {});

    const interval = setInterval(() => {
      fetch('/api/notifications')
        .then(r => r.json())
        .then(data => setUnread(data.unreadCount || 0))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/');
  };

  return (
    <>
      {/* トップバー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-12">
          <span className="font-bold text-orange-600 text-sm">{name}</span>
          <div className="flex items-center gap-3">
            {unread > 0 && (
              <button
                onClick={() => {
                  fetch('/api/notifications', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ readAll: true }),
                  }).then(() => setUnread(0));
                }}
                className="relative text-sm text-gray-500 hover:text-orange-500"
              >
                🔔
                <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                  {unread}
                </span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-red-500"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* ボトムナビ */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
        <div className="max-w-4xl mx-auto flex">
          {links.map(link => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex-1 flex flex-col items-center py-2 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-orange-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <span className="text-lg mb-0.5">{link.icon}</span>
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ボトムナビの高さ分のスペーサー */}
      <div className="h-16" />
    </>
  );
}
