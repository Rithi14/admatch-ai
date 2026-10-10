import { Link } from 'react-router-dom';
import { Compass, History, LayoutDashboard, PlusCircle } from 'lucide-react';
import EmptyState from '../components/common/EmptyState';

export default function NotFound() {
  return (
    <div className="stack narrow">
      <div className="card not-found">
        <p className="not-found-code" aria-hidden="true">
          404
        </p>
        <EmptyState icon={Compass} title="We couldn’t find that page" message="The link may be broken or the page may have moved. Pick one of these instead:">
          <Link to="/" className="btn btn-primary">
            <LayoutDashboard size={16} aria-hidden="true" /> Dashboard
          </Link>
          <Link to="/new" className="btn btn-secondary">
            <PlusCircle size={16} aria-hidden="true" /> New audit
          </Link>
          <Link to="/history" className="btn btn-secondary">
            <History size={16} aria-hidden="true" /> History
          </Link>
        </EmptyState>
      </div>
    </div>
  );
}
