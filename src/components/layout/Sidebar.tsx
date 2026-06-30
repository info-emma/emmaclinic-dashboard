import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, PieChart, Target, BarChart2,
  Upload, RefreshCw, History, Settings, LogOut,
  Tag, ListOrdered, ChevronDown, ChevronRight, Pin, PinOff, Trash2, GitBranch, Receipt, Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useT } from '../../i18n/useT';
import DataUpload from '../upload/DataUpload';

interface SidebarProps {
  open: boolean;
  pinned: boolean;
  onClose: () => void;
  onTogglePin: () => void;
}

const ASIDE_CLASS = 'flex flex-col w-60 min-w-[240px] h-screen bg-emma-black text-emma-white border-r border-emma-grey-dark overflow-hidden relative';

interface NavGroupProps {
  label: string;
  icon: React.ElementType;
  prefix: string;
  children: React.ReactNode;
  onClose: () => void;
}

function NavGroup({ label, icon: Icon, prefix, children, onClose: _onClose }: NavGroupProps) {
  const location = useLocation();
  const isActive = location.pathname.startsWith(prefix);
  const [open, setOpen] = useState(isActive);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-base font-inter font-bold transition-all duration-200
          ${isActive ? 'text-emma-gold' : 'text-white hover:text-emma-white hover:bg-white/5'}`}
      >
        <Icon size={16} className="flex-shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        {open
          ? <ChevronDown size={12} className="flex-shrink-0 opacity-60" />
          : <ChevronRight size={12} className="flex-shrink-0 opacity-60" />
        }
      </button>
      {open && (
        <div className="ml-6 pl-3 border-l border-emma-grey-dark space-y-0.5 mt-0.5 mb-1">
          {children}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ open, pinned, onClose, onTogglePin }: SidebarProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const t = useT();
  const data = useDataStore(s => s.data);
  const signOut = useAuthStore(s => s.signOut);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };
  const loading = useDataStore(s => s.loading);
  const reports = useDataStore(s => s.reports);
  const currentReportId = useDataStore(s => s.currentReportId);
  const loadReport = useDataStore(s => s.loadReport);
  const deleteReport = useDataStore(s => s.deleteReport);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const subItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded text-sm font-inter font-bold transition-all duration-200
    ${isActive
      ? 'bg-emma-gold text-emma-black'
      : 'text-white hover:text-emma-white hover:bg-white/5'}`;

  const lastUpdated = data?.lastUpdated
    ? new Date(data.lastUpdated).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : null;

  const inner = (
    <>
      <div className="circle-motif w-40 h-40 -top-12 -left-12" style={{ borderColor: '#C9A870' }} />
      <div className="circle-motif w-24 h-24 top-20 -right-8" style={{ borderColor: '#C9A870' }} />

      {/* Logo */}
      <div className="flex flex-col items-center py-8 px-6 border-b border-emma-grey-dark relative z-10">
        <button
          onClick={onTogglePin}
          title={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
          className="absolute top-3 right-3 p-1.5 text-emma-grey hover:text-emma-gold transition-colors"
        >
          {pinned ? <Pin size={14} className="text-emma-gold" /> : <PinOff size={14} />}
        </button>
        <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-emma-gold mb-3">
          <img src="/logo.jpg" alt="EMMA Clinic" className="w-full h-full object-cover" />
        </div>
        <h1 className="font-playfair text-lg text-emma-white tracking-wide">EMMA Clinic</h1>
        <p className="text-xs text-emma-grey mt-0.5 tracking-widest uppercase font-inter">{t.execDashboard}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 relative z-10 overflow-y-auto">

        {/* OVERVIEW */}
        <NavLink
          to="/"
          end
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded text-base font-inter font-bold transition-all duration-200
            ${isActive ? 'bg-emma-gold text-emma-black' : 'text-white hover:text-emma-white hover:bg-white/5'}`
          }
        >
          <LayoutDashboard size={16} className="flex-shrink-0" />
          {t.navOverview}
        </NavLink>

        {/* EXCOM group */}
        <NavGroup label="ExCom" icon={TrendingUp} prefix="/excom" onClose={onClose}>
          <NavLink to="/excom/revenue" onClick={onClose} className={subItemClass}>
            <TrendingUp size={13} className="flex-shrink-0" />
            {t.navRevenue}
          </NavLink>
          <NavLink to="/excom/pl" onClick={onClose} className={subItemClass}>
            <PieChart size={13} className="flex-shrink-0" />
            {t.navPLAnalysis}
          </NavLink>
          <NavLink to="/excom/plan" onClick={onClose} className={subItemClass}>
            <Target size={13} className="flex-shrink-0" />
            {t.navPlan}
          </NavLink>
          <NavLink to="/excom/compare" onClick={onClose} className={subItemClass}>
            <BarChart2 size={13} className="flex-shrink-0" />
            {t.navCompare}
          </NavLink>
          <NavLink to="/excom/sga" onClick={onClose} className={subItemClass}>
            <Receipt size={13} className="flex-shrink-0" />
            {t.navSGA}
          </NavLink>
        </NavGroup>

        {/* OPERATION group */}
        <NavGroup label="Operation" icon={Settings} prefix="/operation" onClose={onClose}>
          <NavLink to="/operation/branch" onClick={onClose} className={subItemClass}>
            <GitBranch size={13} className="flex-shrink-0" />
            {t.navBranch}
          </NavLink>
          <NavLink to="/operation/pricing" onClick={onClose} className={subItemClass}>
            <Tag size={13} className="flex-shrink-0" />
            {t.navPricing}
          </NavLink>
          <NavLink to="/operation/procedure" onClick={onClose} className={subItemClass}>
            <ListOrdered size={13} className="flex-shrink-0" />
            {t.navProcedure}
          </NavLink>
        </NavGroup>

      </nav>

      {/* Bottom section */}
      <div className="px-4 pb-6 relative z-10 space-y-3">
        {lastUpdated && (
          <div className="px-3 py-2 rounded bg-white/5 border border-emma-grey-dark">
            <p className="text-xs text-emma-grey font-inter">{t.lastUpdated}</p>
            <p className="text-xs text-emma-grey-light font-inter mt-0.5">{lastUpdated}</p>
            {data?.fileName && (
              <p className="text-xs text-emma-grey truncate mt-0.5" title={data.fileName}>
                {data.fileName}
              </p>
            )}
          </div>
        )}
        <button
          onClick={() => setUploadOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emma-gold/20 hover:bg-emma-gold/30 border border-emma-gold/40 text-emma-gold-light text-sm font-inter font-medium rounded transition-all duration-200"
        >
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
          {t.updateData}
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5
            bg-white/5 hover:bg-red-500/10 border border-emma-grey-dark hover:border-red-500/30
            text-emma-grey hover:text-red-400 text-sm font-inter font-medium rounded transition-all duration-200"
        >
          <LogOut size={14} />
          ออกจากระบบ
        </button>

        {reports.length > 0 && (
          <div className="rounded bg-white/5 border border-emma-grey-dark overflow-hidden">
            <button
              onClick={() => setHistoryOpen(o => !o)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-inter text-emma-grey hover:text-emma-grey-light transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <History size={12} />
                Report History ({reports.length})
              </span>
              <span className="text-[10px]">{historyOpen ? '▲' : '▼'}</span>
            </button>
            {historyOpen && (
              <div className="border-t border-emma-grey-dark max-h-40 overflow-y-auto">
                {reports.map(r => (
                  <div
                    key={r.id}
                    className={`flex items-center border-b border-emma-grey-dark/50 last:border-0
                      ${r.id === currentReportId ? 'bg-emma-gold/15' : ''}`}
                  >
                    <button
                      onClick={() => { loadReport(r.id); setHistoryOpen(false); }}
                      className={`flex-1 text-left px-3 py-2 transition-colors min-w-0
                        ${r.id === currentReportId
                          ? 'text-emma-gold'
                          : 'text-emma-grey-light hover:text-white hover:bg-white/5'}`}
                    >
                      <p className="text-[11px] font-inter font-medium truncate" title={r.file_name}>
                        {r.file_name}
                      </p>
                      <p className="text-[10px] text-emma-grey mt-0.5">
                        {new Date(r.uploaded_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </button>
                    <button
                      onClick={async () => {
                        setDeletingId(r.id);
                        try { await deleteReport(r.id); } finally { setDeletingId(null); }
                      }}
                      disabled={deletingId === r.id}
                      className="flex-shrink-0 px-2 py-2 text-emma-grey hover:text-red-400 transition-colors disabled:opacity-40"
                      title="ลบ report นี้"
                    >
                      {deletingId === r.id
                        ? <RefreshCw size={11} className="animate-spin" />
                        : <Trash2 size={11} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {open && (
        <aside className={`hidden lg:flex ${ASIDE_CLASS}`}>
          {inner}
        </aside>
      )}
      {open && (
        <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 ${ASIDE_CLASS}`}>
          {inner}
        </aside>
      )}
      {uploadOpen && <DataUpload onClose={() => setUploadOpen(false)} />}
    </>
  );
}
