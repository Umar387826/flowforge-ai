import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Bell,
  Bot,
  Check,
  ChevronDown,
  CreditCard,
  Database,
  FileText,
  GitBranch,
  Globe,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Plug,
  Settings,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { NotificationItem } from '../../types/api';

export const DASHBOARD_NAV = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { id: 'agents', label: 'AI Agents', Icon: Bot },
  { id: 'knowledge', label: 'Knowledge Bases', Icon: Database },
  { id: 'documents', label: 'Documents', Icon: FileText },
  { id: 'conversations', label: 'Conversations', Icon: MessageSquare },
  { id: 'deployment', label: 'Chatbot Deployment', Icon: Globe },
  { id: 'leads', label: 'Leads', Icon: Users },
  { id: 'workflows', label: 'Workflows', Icon: GitBranch },
  { id: 'integrations', label: 'Integrations', Icon: Plug },
  { id: 'analytics', label: 'Usage Analytics', Icon: BarChart3 },
  { id: 'billing', label: 'Billing', Icon: CreditCard },
  { id: 'notifications', label: 'Notifications', Icon: Bell },
  { id: 'members', label: 'Organization Members', Icon: Users },
  { id: 'settings', label: 'Settings', Icon: Settings },
  { id: 'audit', label: 'Audit History', Icon: History },
] as const;

export type DashboardSectionId = (typeof DASHBOARD_NAV)[number]['id'];

export const DashboardLayout: React.FC<{
  activeSection: DashboardSectionId;
  onSelectSection: (id: DashboardSectionId) => void;
  children: React.ReactNode;
}> = ({ activeSection, onSelectSection, children }) => {
  const { user, organizations, activeOrg, switchOrganization, logout, theme, toggleTheme, backendReachable } =
    useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const notifRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  const currentNav = DASHBOARD_NAV.find((n) => n.id === activeSection);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    if (!activeOrg) return;
    let active = true;
    setNotifLoading(true);
    api
      .listNotifications()
      .then((res) => {
        if (active && Array.isArray(res?.results)) {
          setNotifications(res.results);
        }
      })
      .catch(() => {
        // Backend offline or unauthenticated in isolated render
      })
      .finally(() => {
        if (active) setNotifLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeOrg?.id]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleMarkNotificationRead = async (id: string) => {
    try {
      const updated = await api.markNotificationRead(id);
      setNotifications((prev) => prev.map((item) => (item.id === id ? updated : item)));
    } catch {
      // Ignore transient error in popover
    }
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[var(--ff-bg-navy)] text-[var(--ff-text-on-navy)]">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-15 shrink-0 items-center justify-between border-b border-[var(--ff-border-navy)] px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ff-royal)] text-xs font-bold text-white">
              FF
            </div>
            <div className="min-w-0">
              <span className="block truncate font-display text-sm font-bold tracking-tight text-white whitespace-nowrap">
                FlowForge AI
              </span>
              <span className="block truncate text-[10px] font-medium text-[var(--ff-teal-text)]">
                Automation Cloud
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1 text-[var(--ff-text-on-navy-muted)] hover:bg-[var(--ff-bg-navy-hover)] hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="shrink-0 border-b border-[var(--ff-border-navy)] p-3">
          <label
            htmlFor="org-switcher"
            className="block px-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ff-text-on-navy-muted)]"
          >
            Organization
          </label>
          <select
            id="org-switcher"
            value={activeOrg?.id || ''}
            onChange={(e) => switchOrganization(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-[var(--ff-border-navy)] bg-[var(--ff-bg-navy-elevated)] px-2.5 py-2 text-xs font-medium text-white focus:border-[var(--ff-royal)] focus:outline-none"
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.role})
              </option>
            ))}
          </select>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2.5" aria-label="Dashboard sections">
          {DASHBOARD_NAV.map(({ id, label, Icon }) => {
            const active = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onSelectSection(id);
                  setMobileOpen(false);
                }}
                className={`ff-nav-item ${active ? 'ff-nav-item-active' : ''}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate text-left">{label}</span>
                {id === 'notifications' && unreadCount > 0 && (
                  <span className="rounded bg-[var(--ff-teal)] px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="shrink-0 border-t border-[var(--ff-border-navy)] p-3">
        <div className="flex items-center gap-2.5 rounded-lg bg-[var(--ff-bg-navy-elevated)] p-2">
          {!avatarError ? (
            <img
              src="/src/assets/images/avatar_workspace_user_1795010567707.jpg"
              alt={user?.full_name || 'Workspace user'}
              referrerPolicy="no-referrer"
              onError={() => setAvatarError(true)}
              className="h-8 w-8 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--ff-royal)] text-xs font-semibold text-white">
              {(user?.full_name || user?.email || 'U').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{user?.full_name || 'Workspace Admin'}</p>
            <p className="truncate text-[11px] text-[var(--ff-text-on-navy-muted)]">{user?.email || ''}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-md p-1.5 text-[var(--ff-text-on-navy-muted)] transition-colors hover:bg-[var(--ff-bg-navy-hover)] hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[var(--ff-bg-canvas)] text-[var(--ff-text-primary)]">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-[var(--ff-border-navy)] lg:block">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="h-full w-68 max-w-[82vw] border-r border-[var(--ff-border-navy)] shadow-2xl">
            {sidebarContent}
          </div>
          <div className="flex-1 bg-slate-950/60 backdrop-blur-[1px]" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-15 items-center justify-between gap-3 border-b border-[var(--ff-border)] bg-[var(--ff-bg-surface)] px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-md border border-[var(--ff-border)] p-1.5 text-[var(--ff-text-secondary)] hover:bg-[var(--ff-bg-subtle)] lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 items-center text-xs text-[var(--ff-text-muted)] whitespace-nowrap">
              <span className="hidden truncate max-w-[180px] sm:inline">{activeOrg?.name || 'Workspace'}</span>
              <span className="mx-2 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="truncate font-display text-sm font-semibold text-[var(--ff-text-primary)]">
                {currentNav?.label}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            {organizations.length > 0 && (
              <select
                aria-label="Active organization"
                value={activeOrg?.id || ''}
                onChange={(e) => switchOrganization(e.target.value)}
                className="ff-select hidden w-44 py-1.5 text-xs md:block"
              >
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            )}

            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((o) => !o);
                  setProfileOpen(false);
                }}
                aria-label="Open notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-md border border-[var(--ff-border)] bg-[var(--ff-bg-surface)] text-[var(--ff-text-secondary)] transition-colors hover:bg-[var(--ff-bg-subtle)] hover:text-[var(--ff-text-primary)]"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded bg-[var(--ff-royal)] px-1 font-mono text-[10px] font-bold tabular-nums text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div
                  role="dialog"
                  aria-label="Notifications popover"
                  className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-[var(--ff-radius-lg)] border border-[var(--ff-border)] bg-[var(--ff-bg-surface)] shadow-[var(--ff-shadow-popover)]"
                >
                  <div className="flex items-center justify-between border-b border-[var(--ff-border)] px-4 py-3">
                    <span className="font-display text-xs font-semibold text-[var(--ff-text-primary)]">
                      Notifications ({unreadCount} unread)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        onSelectSection('notifications');
                      }}
                      className="text-xs font-medium text-[var(--ff-royal-text)] hover:underline"
                    >
                      View all
                    </button>
                  </div>

                  <div className="max-h-72 divide-y divide-[var(--ff-border)] overflow-y-auto">
                    {notifLoading ? (
                      <p className="p-4 text-xs text-[var(--ff-text-muted)]">Loading notifications...</p>
                    ) : notifications.length === 0 ? (
                      <p className="p-4 text-xs text-[var(--ff-text-muted)]">No workspace notifications yet.</p>
                    ) : (
                      notifications.slice(0, 6).map((n) => (
                        <div
                          key={n.id}
                          className={`flex items-start justify-between gap-2 p-3 text-xs ${
                            !n.is_read ? 'bg-[var(--ff-royal-soft)]' : ''
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--ff-text-primary)]">{n.title}</p>
                            <p className="mt-0.5 line-clamp-2 text-[var(--ff-text-secondary)]">{n.message}</p>
                          </div>
                          {!n.is_read && (
                            <button
                              type="button"
                              onClick={() => handleMarkNotificationRead(n.id)}
                              title="Mark as read"
                              aria-label={`Mark ${n.title} as read`}
                              className="shrink-0 rounded border border-[var(--ff-border)] bg-[var(--ff-bg-surface)] p-1 text-[var(--ff-royal-text)] hover:bg-[var(--ff-bg-subtle)]"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle light or dark theme"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--ff-border)] bg-[var(--ff-bg-surface)] text-[var(--ff-text-secondary)] transition-colors hover:bg-[var(--ff-bg-subtle)] hover:text-[var(--ff-text-primary)]"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((p) => !p);
                  setNotifOpen(false);
                }}
                aria-label="Open profile menu"
                className="flex items-center gap-2 rounded-md border border-[var(--ff-border)] bg-[var(--ff-bg-surface)] px-2 py-1 text-xs transition-colors hover:bg-[var(--ff-bg-subtle)]"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--ff-bg-navy)] text-[10px] font-bold text-white">
                  {(user?.full_name || user?.email || 'U').slice(0, 2).toUpperCase()}
                </div>
                <span className="hidden max-w-[110px] truncate font-medium text-[var(--ff-text-primary)] sm:inline">
                  {user?.full_name || 'Account'}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-[var(--ff-text-muted)]" />
              </button>

              {profileOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 rounded-[var(--ff-radius-lg)] border border-[var(--ff-border)] bg-[var(--ff-bg-surface)] p-1.5 shadow-[var(--ff-shadow-popover)]"
                >
                  <div className="border-b border-[var(--ff-border)] px-3 py-2">
                    <p className="truncate text-xs font-semibold text-[var(--ff-text-primary)]">{user?.full_name}</p>
                    <p className="truncate text-[11px] text-[var(--ff-text-muted)]">{user?.email}</p>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      onSelectSection('settings');
                    }}
                    className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-[var(--ff-text-secondary)] hover:bg-[var(--ff-bg-subtle)] hover:text-[var(--ff-text-primary)]"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    <span>Profile &amp; Settings</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-[var(--ff-danger)] hover:bg-[var(--ff-danger-soft)]"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {!backendReachable && (
          <div className="border-b border-[rgba(217,119,6,0.3)] bg-[var(--ff-warning-soft)] px-4 py-2 text-xs text-[var(--ff-warning)] sm:px-6">
            Django API backend is currently offline. Start PostgreSQL, Redis, Celery, and Daphne via{' '}
            <code className="font-mono font-semibold">docker compose up</code> to persist live data.
          </div>
        )}

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
};
