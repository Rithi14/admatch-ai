import { useEffect } from 'react';
import { Link, matchPath, useLocation } from 'react-router-dom';
import { FlaskConical, Menu, PlusCircle, Server } from 'lucide-react';
import { useAudit } from '../../hooks/useAudit';

const PAGE_TITLES = [
  { path: '/', title: 'Dashboard', subtitle: 'Overview of your message-match audits' },
  { path: '/new', title: 'New Audit', subtitle: 'Compare an ad against its landing page' },
  { path: '/history', title: 'Audit History', subtitle: 'Search, filter and revisit previous audits' },
  { path: '/audits/:id', title: 'Audit Report', subtitle: 'Score, evidence and recommended fixes' },
  { path: '/settings', title: 'Settings', subtitle: 'Mode, backend connection and local data' },
];

const NOT_FOUND = { title: 'Page not found', subtitle: 'This page does not exist' };

export function getPageInfo(pathname) {
  return PAGE_TITLES.find((p) => matchPath({ path: p.path, end: true }, pathname)) || NOT_FOUND;
}

export default function Topbar({ onMenuClick, menuOpen }) {
  const { pathname } = useLocation();
  const { title, subtitle } = getPageInfo(pathname);
  const { isDemo } = useAudit();

  useEffect(() => {
    document.title = `${title} · AdMatch AI`;
  }, [title]);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="icon-btn menu-btn"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
        >
          <Menu size={22} />
        </button>
        <div className="topbar-titles">
          <h1 className="topbar-title">{title}</h1>
          <p className="topbar-sub">{subtitle}</p>
        </div>
      </div>
      <div className="topbar-right">
        <Link to="/settings" className={`chip ${isDemo ? 'chip-demo' : 'chip-live'}`} title="Change mode in Settings">
          {isDemo ? <FlaskConical size={13} aria-hidden="true" /> : <Server size={13} aria-hidden="true" />}
          <span>{isDemo ? 'Demo mode' : 'Live mode'}</span>
        </Link>
        {pathname !== '/new' && (
          <Link to="/new" className="btn btn-primary btn-sm">
            <PlusCircle size={16} aria-hidden="true" />
            <span className="hide-sm">New Audit</span>
          </Link>
        )}
      </div>
    </header>
  );
}
