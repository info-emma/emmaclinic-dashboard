import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, CheckCircle, AlertCircle, FileSpreadsheet, Cloud } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { useBranchStore } from '../../store/useBranchStore';
import { useT } from '../../i18n/useT';
import { parseExcelFile, isBranchPLFile, parseBranchPLFile } from '../../utils/parseExcel';

const MONTH_ABBR = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

interface DataUploadProps { onClose: () => void; }
type UploadState = 'idle' | 'dragging' | 'parsing' | 'syncing' | 'success' | 'error';

interface SuccessInfo {
  year?: number;
  isBranch: boolean;
  monthsLabel?: string;
  syncedAt: string;
}

export default function DataUpload({ onClose }: DataUploadProps) {
  const [state, setState] = useState<UploadState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [fileName, setFileName] = useState('');
  const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveReport = useDataStore(s => s.saveReport);
  const saveBranchReport = useBranchStore(s => s.saveBranchReport);
  const saveBranchReports = useBranchStore(s => s.saveBranchReports);
  const t = useT();

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setErrorMsg(t.fileTypes); setState('error'); return;
    }
    setFileName(file.name);
    const isBranch = isBranchPLFile(file.name);
    try {
      setState('parsing');
      let year: number | undefined;
      let monthsLabel: string | undefined;

      if (isBranch) {
        const result = await parseBranchPLFile(file);
        setState('syncing');
        if (Array.isArray(result)) {
          year = result[0].year;
          await saveBranchReports(result);
          const abbrs = result.map(d => MONTH_ABBR[d.month]);
          monthsLabel = abbrs.length > 1 ? `${abbrs[0]} – ${abbrs[abbrs.length - 1]}` : abbrs[0];
        } else {
          year = result.year;
          await saveBranchReport(result);
        }
      } else {
        const parsed = await parseExcelFile(file);
        year = (parsed as any).year;
        setState('syncing');
        await saveReport(file.name, parsed as any, year);
      }

      setSuccessInfo({
        year,
        isBranch,
        monthsLabel,
        syncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      setState('success');
      setTimeout(onClose, 2500);
    } catch (e: any) {
      setErrorMsg(e.message || 'Upload failed');
      setState('error');
    }
  }, [saveReport, saveBranchReport, saveBranchReports, onClose, t]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setState('idle');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const isUploading = state === 'parsing' || state === 'syncing';

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-emma-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="bg-white rounded-lg shadow-emma-lg w-full max-w-md mx-4 p-6 relative"
        initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-emma-grey hover:text-emma-black transition-colors"><X size={18} /></button>
        <h2 className="font-playfair text-xl font-semibold text-emma-black mb-1">{t.uploadTitle}</h2>
        <p className="text-xs font-inter text-emma-grey mb-5">{t.uploadDesc}</p>
        <AnimatePresence mode="wait">
          {state === 'success' ? (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-8 gap-3">
              <div className="relative">
                <CheckCircle size={40} className="text-acc-positive" />
                <Cloud size={14} className="text-acc-positive absolute -bottom-1 -right-1" />
              </div>
              <p className="font-inter text-sm font-medium text-emma-black">{t.uploadSuccess}</p>
              <p className="font-inter text-xs text-emma-grey truncate max-w-[260px]" title={fileName}>{fileName}</p>
              {successInfo && (
                <div className="flex items-center gap-3 mt-1 flex-wrap justify-center">
                  {successInfo.monthsLabel ? (
                    <span className="text-[11px] font-inter bg-emma-nude text-emma-gold-dark px-2 py-0.5 rounded">
                      {successInfo.monthsLabel} {successInfo.year}
                    </span>
                  ) : successInfo.year ? (
                    <span className="text-[11px] font-inter bg-emma-nude text-emma-gold-dark px-2 py-0.5 rounded">
                      {t.uploadYear} {successInfo.year}
                    </span>
                  ) : null}
                  <span className="text-[11px] font-inter bg-emma-nude text-emma-grey-dark px-2 py-0.5 rounded">
                    {successInfo.isBranch ? t.uploadTypeBranch : t.uploadTypeMain}
                  </span>
                  <span className="text-[11px] font-inter text-emma-grey">
                    {t.uploadSyncedAt} {successInfo.syncedAt}
                  </span>
                </div>
              )}
            </motion.div>
          ) : state === 'error' ? (
            <motion.div key="error" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-8 gap-3">
              <AlertCircle size={40} className="text-acc-negative" />
              <p className="font-inter text-sm font-medium text-emma-black">{t.uploadFailed}</p>
              <p className="font-inter text-xs text-acc-negative text-center">{errorMsg}</p>
              <button onClick={() => setState('idle')} className="emma-btn mt-2 text-xs">{t.tryAgain}</button>
            </motion.div>
          ) : isUploading ? (
            <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-8 gap-4">
              <div className="w-10 h-10 border-2 border-emma-gold-light border-t-emma-gold rounded-full animate-spin" />
              <p className="font-inter text-sm text-emma-grey truncate max-w-[260px]">{fileName}</p>
              {/* Step indicators */}
              <div className="flex flex-col gap-1.5 w-full max-w-[220px]">
                <div className="flex items-center gap-2 text-xs font-inter">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${state === 'parsing' || state === 'syncing' ? 'bg-emma-gold' : 'bg-emma-border'}`} />
                  <span className={state === 'parsing' || state === 'syncing' ? 'text-emma-black font-medium' : 'text-emma-grey'}>
                    {t.uploadParsing}
                    {state === 'parsing' && <span className="ml-1 text-emma-gold">●</span>}
                    {state === 'syncing' && <span className="ml-1 text-acc-positive">✓</span>}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-inter">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${state === 'syncing' ? 'bg-emma-gold animate-pulse' : 'bg-emma-border'}`} />
                  <span className={state === 'syncing' ? 'text-emma-black font-medium' : 'text-emma-grey'}>
                    {t.uploadSyncing}
                    {state === 'syncing' && <span className="ml-1 text-emma-gold">●</span>}
                  </span>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div onDrop={onDrop} onDragOver={e => { e.preventDefault(); setState('dragging'); }} onDragLeave={() => setState('idle')}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center gap-3 cursor-pointer transition-all duration-200
                  ${state === 'dragging' ? 'border-emma-gold bg-emma-nude/60 scale-[1.01]' : 'border-emma-border hover:border-emma-gold-light hover:bg-emma-nude/30'}`}>
                <div className="w-12 h-12 rounded-full bg-emma-nude flex items-center justify-center">
                  {state === 'dragging' ? <Upload size={22} className="text-emma-gold" /> : <FileSpreadsheet size={22} className="text-emma-gold-dark" />}
                </div>
                <div className="text-center">
                  <p className="font-inter text-sm font-medium text-emma-black">{state === 'dragging' ? t.dropToUpload : t.dragDrop}</p>
                  <p className="font-inter text-xs text-emma-grey mt-1">{t.clickBrowse}</p>
                </div>
                <p className="font-inter text-xs text-emma-grey/70">{t.fileTypes}</p>
              </div>
              <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
