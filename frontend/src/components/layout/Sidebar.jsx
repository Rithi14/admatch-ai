import { Link, NavLink } from 'react-router-dom';
import { FlaskConical, History, LayoutDashboard, PlusCircle, Server, Settings, X } from 'lucide-react';
import { useAudit } from '../../hooks/useAudit';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/new', label: 'New Audit', icon: PlusCircle },
  { to: '/history', label: 'Audit History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ isOpen, onClose }) {
  const { isDemo } = useAudit();

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'show' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`} id="app-sidebar" aria-label="Sidebar">
        <div className="sidebar-head">
          <Link to="/" className="brand" onClick={onClose}>
            {/* The image src has been changed from /logo.svg to /image.png */}
            <img src="/image.png" alt="" className="brand-logo" width="36" height="36" />
            <span className="brand-text">
              AdMatch <span className="brand-accent">AI</span>
            </span>
          </Link>
          <button type="button" className="icon-btn sidebar-close" onClick={onClose} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Main">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className={`mode-card ${isDemo ? 'is-demo' : 'is-live'}`}>
            {isDemo ? <FlaskConical size={18} aria-hidden="true" /> : <Server size={18} aria-hidden="true" />}
            <div>
              <strong>{isDemo ? 'Demo mode' : 'Live backend mode'}</strong>
              <p>
                {isDemo
                  ? 'Keyword-matching demo, not real AI. No websites are fetched. Data stays in this browser.'
                  : 'Audits are sent to your configured backend. Results depend on that service.'}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}