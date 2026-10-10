import { Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import NewAudit from './pages/NewAudit';
import AuditReport from './pages/AuditReport';
import AuditHistory from './pages/AuditHistory';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import { BrowserRouter } from 'react-router-dom'

<BrowserRouter
  future={{
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  }}
>
  {/* your existing routes */}
</BrowserRouter>

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="new" element={<NewAudit />} />
        <Route path="audits/:id" element={<AuditReport />} />
        <Route path="history" element={<AuditHistory />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
