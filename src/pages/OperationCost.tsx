import { useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, GitBranch, Upload, History, RefreshCw, Trash2 } from 'lucide-react';
import { useT } from '../i18n/useT';
import { useDataStore } from '../store/useDataStore';
import DataUpload from '../components/upload/DataUpload';

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

function ComingSoonSection({
  title, icon: Icon, description, onUpload,
}: {
  title: string; icon: React.ElementType; description: string; onUpload: () => void;
}) {
  return (
    <div className="emma-card flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-14 h-14 rounded-full bg-emma-nude flex items-center justify-center">
        <Icon size={24} className="text-emma-gold-dark" />
      </div>
      <div>
        <h3 className="font-playfair text-lg text-emma-black mb-1">{title}</h3>
        <p className="text-xs font-inter text-emma-grey max-w-sm">{description}</p>
      </div>
      <button
        onClick={onUpload}
        className="flex items-center gap-2 px-4 py-2 rounded border border-emma-gold/40 bg-emma-nude/60 hover:bg-emma-gold/10 hover:border-emma-gold text-xs font-inter text-emma-gold-dark transition-all duration-200"
      >
        <Upload size={12} />
        Upload operation data to populate this section
      </button>
    </div>
  );
}

export default function OperationCost() {
  const t = useT();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const reports = useDataStore(s => s.reports);
  const currentReportId = useDataStore(s => s.currentReportId);
  const loadReport = useDataStore(s => s.loadReport);
  const deleteReport = useDataStore(s => s.deleteReport);

  return (
    <div className="space-y-6">
      <motion.div {...fadeUp} transition={{ duration: 0.3 }}>
        <h2 className="font-playfair text-xl text-emma-black">{t.pageOpCost}</h2>
        <p className="text-xs font-inter text-emma-grey mt-1">
          Track and analyse operational costs across the clinic — overview and by branch.
        </p>
      </motion.div>

      {/* Report History */}
      {reports.length > 0 && (
        <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.02 }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-emma-gold rounded-full" />
            <h3 className="font-inter text-sm font-semibold text-emma-black flex items-center gap-1.5">
              <History size={14} />
              Report History
            </h3>
            <button
              onClick={() => setUploadOpen(true)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-emma-gold/20 hover:bg-emma-gold/30 border border-emma-gold/40 text-emma-gold-dark text-xs font-inter font-medium rounded transition-all duration-200"
            >
              <Upload size={12} />
              Upload New
            </button>
          </div>
          <div className="emma-card p-0 overflow-hidden">
            {reports.map(r => (
              <div
                key={r.id}
                className={`flex items-center border-b border-emma-border last:border-0 ${r.id === currentReportId ? 'bg-emma-gold/10' : ''}`}
              >
                <button
                  onClick={() => loadReport(r.id)}
                  className={`flex-1 text-left px-4 py-3 transition-colors min-w-0 ${
                    r.id === currentReportId ? 'text-emma-gold' : 'text-emma-black hover:bg-emma-nude/40'
                  }`}
                >
                  <p className="text-sm font-inter font-medium truncate">{r.file_name}</p>
                  <p className="text-xs text-emma-grey mt-0.5">
                    {new Date(r.uploaded_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {r.year != null && ` · ${r.year > 2500 ? r.year - 543 : r.year}`}
                    {r.id === currentReportId && <span className="ml-2 text-emma-gold font-medium">· Active</span>}
                  </p>
                </button>
                <button
                  onClick={async () => {
                    setDeletingId(r.id);
                    try { await deleteReport(r.id); } finally { setDeletingId(null); }
                  }}
                  disabled={deletingId === r.id}
                  className="flex-shrink-0 px-4 py-3 text-emma-grey hover:text-red-500 transition-colors disabled:opacity-40"
                  title="ลบ report นี้"
                >
                  {deletingId === r.id
                    ? <RefreshCw size={14} className="animate-spin" />
                    : <Trash2 size={14} />}
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Section 1: Overview Operation Cost */}
      <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.05 }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 bg-emma-gold rounded-full" />
          <h3 className="font-inter text-sm font-semibold text-emma-black">{t.pageOpCostOverview}</h3>
        </div>
        <ComingSoonSection
          title="Operation Cost Overview"
          icon={DollarSign}
          description="Monthly operation cost trends, cost-to-revenue ratio, and key cost drivers. Upload your operation cost data to get started."
          onUpload={() => setUploadOpen(true)}
        />
      </motion.div>

      {/* Section 2: Operation Cost by Branch */}
      <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.1 }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 bg-emma-gold rounded-full" />
          <h3 className="font-inter text-sm font-semibold text-emma-black">{t.pageOpCostByBranch}</h3>
        </div>
        <ComingSoonSection
          title="Cost by Branch"
          icon={GitBranch}
          description="Break down operation costs by branch or location. Compare efficiency and cost structure across all EMMA Clinic branches."
          onUpload={() => setUploadOpen(true)}
        />
      </motion.div>

      {uploadOpen && <DataUpload onClose={() => setUploadOpen(false)} />}
    </div>
  );
}
