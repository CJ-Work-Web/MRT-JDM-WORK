import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, query, addDoc, serverTimestamp, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { 
  Search, 
  Plus, 
  Trash2, 
  FileText, 
  CheckCircle, 
  Upload, 
  Database,
  AlertCircle,
  MapPin,
  Phone,
  User,
  Save,
  Clock,
  ClipboardList,
  RotateCcw,
  Calendar,
  DollarSign,
  MessageSquare,
  ChevronRight,
  ShieldCheck,
  Link2, 
  Link2Off,
  Building2,
  Copy,
  X,
  ChevronLeft,
  Hash,
  LayoutDashboard,
  ExternalLink,
  AlertTriangle,
  Loader2,
  Download,
  Filter,
  BarChart3,
  Check,
  ChevronDown,
  Settings2,
  Edit3,
  Info,
  History
} from 'lucide-react';

// --- 全域輔助：UUID 生成器 ---
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * 環境變數讀取 (相容 Google 開發環境與 Vercel 生產環境)
 */
const getSafeEnv = () => {
  let env = {};
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      env = import.meta.env;
    }
  } catch (e) {}
  if (!env.VITE_FIREBASE_CONFIG && typeof process !== 'undefined' && process.env) {
    env = { ...env, ...process.env };
  }
  return env;
};

/**
 * Firebase 初始化與 App ID
 */
const getFirebaseConfig = () => {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    return JSON.parse(__firebase_config);
  }
  const env = getSafeEnv();
  const configStr = env.VITE_FIREBASE_CONFIG;
  if (configStr) {
    try {
      return JSON.parse(configStr);
    } catch (e) {
      console.error("Firebase config 解析失敗:", e);
    }
  }
  return {};
};

const getAppId = () => {
  if (typeof __app_id !== 'undefined' && __app_id) {
    return __app_id;
  }
  return 'mrt-jdm-repair-default';
};

const firebaseConfig = getFirebaseConfig();
const app = firebaseConfig?.apiKey ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const appId = getAppId();

// --- 常量與狀態初始化 ---

const chunkArray = (array, size) => {
  const result = [];
  if (!array) return result;
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

function getInitialFormState() {
  return {
    station: '', 
    address: '', 
    tenant: '', 
    phone: '', 
    repairType: '2.1', 
    reportDate: '', 
    isSubLease: false, 
    repairItems: [],
    costItems: [{ id: generateUUID(), contractor: '', workTask: '', invoiceNumber: '', billingDate: '', costAmount: '', voucherNumber: '', remarks: '' }],
    incomeItems: [{ id: generateUUID(), source: '晟晁', receiptNumber: '', receiveDate: '', subtotal: 0, serviceFee: 0, tax: 0, incomeAmount: 0, incomeVoucherNumber: '', remarks: '' }],
    quoteTitle: '', 
    siteDescription: '收到承租人報修，請我方派員查看。',
    constructionDesc1: '經廠商檢測，。',
    constructionDesc2: '',
    completionDate: '', 
    completionDesc1: '廠商將OOO更新，測試功能正常，完成修繕。',
    completionDesc2: '', 
    totalAmount: 0, 
    satisfactionLevel: '', 
    satisfactionScore: null,
    jdmControl: { caseNumber: '', reportDate: '', reportSubmitDate: '', approvalDate: '', closeDate: '', closeSubmitDate: '', checklist: [], status: '', remarks: '' }
  };
}

const EDITABLE_INPUT_STYLE = "border-slate-300 bg-white hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm outline-none font-bold text-sm px-4 py-2.5";
const HIGHLIGHT_INPUT_STYLE = "bg-amber-50 border-amber-400 text-amber-900 shadow-inner focus:ring-2 focus:ring-amber-200 transition-all outline-none font-black text-sm px-4 py-2.5";
const READONLY_INPUT_STYLE = "border border-slate-200 bg-slate-100 text-slate-700 font-black cursor-default outline-none shadow-inner text-sm px-4 py-2.5";
const SIDEBAR_INPUT_STYLE = "border-slate-300 bg-white hover:border-blue-500 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm outline-none font-bold text-sm px-3 py-2 placeholder:text-slate-400";

const SATISFACTION_LEVELS = [
  { label: '非常滿意', score: 100, color: 'bg-emerald-500', textColor: 'text-emerald-600', borderColor: 'border-emerald-200', bgColor: 'bg-emerald-50' },
  { label: '滿意', score: 75, color: 'bg-lime-500', textColor: 'text-lime-600', borderColor: 'border-lime-200', bgColor: 'bg-lime-50' },
  { label: '普通', score: 50, color: 'bg-yellow-500', textColor: 'text-yellow-600', borderColor: 'border-yellow-200', bgColor: 'bg-yellow-50' },
  { label: '尚須改進', score: 25, color: 'bg-orange-500', textColor: 'text-orange-600', borderColor: 'border-orange-200', bgColor: 'bg-orange-50' },
  { label: '不滿意', score: 0, color: 'bg-rose-500', textColor: 'text-rose-600', borderColor: 'border-rose-200', bgColor: 'bg-rose-50' },
  { label: '不需滿意度', score: null, color: 'bg-slate-400', textColor: 'text-slate-500', borderColor: 'border-slate-200', bgColor: 'bg-slate-50' }
];

const JDM_CHECKLIST_ITEMS = [
  { id: 'photoBefore', label: '維修前照片' }, { id: 'photoDuring', label: '維修中照片' },
  { id: 'photoAfter', label: '維修後照片' }, { id: 'quotation', label: '報價單' },
  { id: 'warranty', label: '保固書' }, { id: 'invoice', label: '發票' },
  { id: 'bankCopy', label: '存摺影本' }, { id: 'satisfactionForm', label: '滿意度調查表' }
];

const CHECKLIST_MAP = Object.fromEntries(JDM_CHECKLIST_ITEMS.map(i => [i.id, i.label]));

// --- 子組件定義 ---

const AutoResizeTextarea = ({ value, onChange, className, rows = 1, placeholder = "" }) => {
  const textareaRef = useRef(null);
  useEffect(() => {
    const t = textareaRef.current;
    if (t) { t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`; }
  }, [value]);
  return (
    <textarea ref={textareaRef} value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      className={`${className} resize-none overflow-hidden border hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm outline-none text-sm`}
    />
  );
};

const QuickPhraseMenu = React.memo(({ onSelect, type }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const phrases = useMemo(() => (
    type === 'report' 
      ? [
          "檢附照片、報價單、合約內修繕價目表。", 
          "檢附照片、報價單。", 
          "檢附照片、報價單，本案修繕價格超過一萬元，檢附三家廠商報價單。"
        ]
      : [
          "檢附照片、滿意度調查表。", 
          "檢附照片、保固書、滿意度調查表，電子鎖保固日期：民國年月日至年月日。", 
          "檢附照片、本案為空屋修繕，無須檢附滿意度調查表。", 
          "檢附照片、發票、滿意度調查表。", 
          "檢附照片、發票、本案為空屋修繕，無須檢附滿意度調查表。"
        ]
  ), [type]);

  useEffect(() => {
    const handleClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative inline-block shrink-0" ref={menuRef}>
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-all text-xs font-bold border border-purple-200 whitespace-nowrap"><MessageSquare size={12} /> 快速句型</button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-100 text-left">
          <div className="p-2.5 bg-slate-50 border-b border-slate-100 text-xs font-black text-slate-500 uppercase tracking-widest px-4">選擇快速句型</div>
          {phrases.map((p, i) => (<button key={i} onClick={() => { onSelect(p); setIsOpen(false); }} className="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:bg-purple-50 border-b border-slate-50 last:border-none flex items-start gap-2.5 group"><div className="mt-1 shrink-0"><ChevronRight size={12} className="text-slate-300 group-hover:text-purple-400" /></div><span>{String(p)}</span></button>))}
        </div>
      )}
    </div>
  );
});

const InfoCard = ({ icon: Icon, label, value, colorClass, onCopy, fullWidth = false }) => (
  <div className={`${colorClass} rounded-2xl p-4 border flex items-start gap-4 transition-all relative group ${fullWidth ? 'sm:col-span-2' : ''}`}> 
    <div className="bg-white p-2.5 rounded-xl shadow-sm shrink-0"><Icon size={20} className="text-current" /></div>
    <div className="space-y-0.5 flex-1 min-w-0">
      <div className="flex justify-between items-center mb-0.5">
        <span className="text-xs font-black opacity-80 uppercase tracking-widest block whitespace-nowrap shrink-0">{String(label || '')}</span>
        {value && (
          <button type="button" onClick={(e) => onCopy(value, e)} className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black transition-all hover:bg-blue-100 whitespace-nowrap border border-blue-100">
            <Copy size={10} /> 複製
          </button>
        )}
      </div>
      <div className="text-sm font-black text-slate-700 leading-tight truncate">
        {value ? String(value) : '--'}
      </div>
    </div>
  </div>
);

const MemoizedRepairRow = React.memo(({ item, onEdit, onDelete }) => {
  const status = String(item.jdmControl?.status || '');
  const reportDate = String(item.jdmControl?.reportDate || '');
  const checklist = (item.jdmControl && Array.isArray(item.jdmControl.checklist)) ? item.jdmControl.checklist : [];
  const isMissingApproval = status === '結報' && !item.jdmControl?.approvalDate && item.repairType !== '2.1';
  
  const totalCost = (item.costItems || []).reduce((sum, ci) => sum + (Number(ci.costAmount) || 0), 0);

  return (
    <tr className="hover:bg-slate-50/50 group transition-colors border-b last:border-none border-slate-100 text-[11px] md:text-xs">
      <td className="p-2 text-center">
        <span className={`px-2 py-0.5 rounded-full font-black inline-flex justify-center shadow-sm whitespace-nowrap w-20 ${!status ? 'bg-slate-100 text-slate-500' : status === '結報' ? 'bg-emerald-100 text-emerald-700' : status === '退件' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
          {status || '待提報'}
        </span>
      </td>
      <td className="p-2 text-center">
        <div className="text-slate-600 font-mono font-black whitespace-nowrap">
          {reportDate || '--'}
        </div>
      </td>
      <td className="p-2">
        <div className="text-slate-900 font-black truncate max-w-full">{String(item.jdmControl?.caseNumber || '未編號')}</div>
        <div className="font-bold text-[9px] text-slate-500 mt-0.5 uppercase truncate">{String(item.station || '未知')}</div>
      </td>
      <td className="p-2">
        <div className="font-black text-slate-900 truncate max-w-full">{String(item.tenant || '--')}</div>
        <div className="text-[9px] text-slate-500 mt-0.5 truncate leading-relaxed font-bold" title={String(item.address || '')}>{String(item.address || '無地址')}</div>
      </td>
      <td className="p-2">
        <div className="font-bold text-slate-600 truncate leading-relaxed max-w-full" title={String(item.quoteTitle || '')}>
          {String(item.quoteTitle || '--')}
        </div>
      </td>
      <td className="p-2 text-right">
        <div className="font-mono font-black text-rose-600 whitespace-nowrap">
          ${totalCost.toLocaleString()}
        </div>
      </td>
      <td className="p-2">
        <div className="flex flex-wrap gap-1">
          {isMissingApproval && (
            <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 border border-orange-200 rounded text-[9px] font-black whitespace-nowrap animate-pulse">缺奉核日</span>
          )}
          {checklist.length > 0 ? (
            checklist.map(id => (
              <span key={id} className="px-1.5 py-0.5 bg-orange-50 text-orange-600 border border-orange-100 rounded text-[9px] font-black whitespace-nowrap">
                {String(CHECKLIST_MAP[id] || id)}
              </span>
            ))
          ) : (
            !isMissingApproval && <span className="font-black text-emerald-600 flex items-center gap-1.5 whitespace-nowrap"><CheckCircle size={10} /> 資料齊備</span>
          )}
        </div>
      </td>
      <td className="p-2 text-center">
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => onEdit(item)} className="p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 shadow-sm transition-all active:scale-95 shrink-0"><ExternalLink size={14} /></button>
          <button onClick={() => onDelete(item.id)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors shrink-0"><Trash2 size={14} /></button>
        </div>
      </td>
    </tr>
  );
});

const LoginScreen = ({ auth }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Login successful, onAuthStateChanged will handle state update
    } catch (err) {
      console.error("Login error:", err);
      let errorMessage = "登入失敗，請檢查 Email 或密碼。";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        errorMessage = "Email 或密碼不正確。";
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = "Email 格式不正確。";
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = "登入嘗試過多，請稍後再試。";
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 p-4">
      <div className="w-full max-w-md bg-white p-8 md:p-12 rounded-3xl shadow-2xl text-center border border-slate-200 animate-in fade-in zoom-in-95">
        <div className="mx-auto w-fit bg-blue-100 text-blue-600 p-4 rounded-full mb-6">
          <User size={40} />
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-8">登入管理系統</h1>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-5 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all text-base font-medium"
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="密碼"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all text-base font-medium"
              required
            />
          </div>
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2 rounded-xl text-sm font-bold animate-in fade-in">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-black text-lg shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : '登入'}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- 主應用組件 ---

const App = () => {
  // 1. State Definitions
  const [user, setUser] = useState(null);
  const [configError, setConfigError] = useState(false);
  const [activeView, setActiveView] = useState('editor'); 
  const [currentDocId, setCurrentDocId] = useState(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false); 
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [hasActivatedDashboard, setHasActivatedDashboard] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [allCases, setAllCases] = useState([]);
  const [flattenedAddressData, setFlattenedAddressData] = useState([]); 
  const [sheetNames, setSheetNames] = useState([]);
  const [fileBData, setFileBData] = useState([]); 
  const [searchSheet, setSearchSheet] = useState(''); 
  const [searchAddress, setSearchAddress] = useState(''); 
  const [debouncedSearchAddress, setDebouncedSearchAddress] = useState(''); 
  const [searchB, setSearchB] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isXlsxLoaded, setIsXlsxLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('expense');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [copyTip, setCopyTip] = useState({ show: false, x: 0, y: 0 });
  const [isSyncEnabled, setIsSyncEnabled] = useState(true);
  const [floatingTip, setFloatingTip] = useState({ show: false, text: '' });
  const [statusConfirm, setStatusConfirm] = useState({ show: false, target: '', message: '' });

  const [queryError, setQueryError] = useState(null);

  const [importStatus, setImportStatus] = useState({
    isProcessingA: false,
    isProcessingB: false,
    isProcessingC: false,
    fileNameA: '',
    hasImportedB: false
  });

  const [isManualMode, setIsManualMode] = useState(false);

  const [dashboardFilter, setDashboardFilter] = useState({ 
    search: '', 
    status: '未完成案件', 
    stations: [],
    reportMonth: '',
    closeMonth: '',
    specialFormula: '',
    baseMonth: new Date().toLocaleDateString('en-CA').slice(0, 7) 
  });
  
  const [isSpecialSearchOpen, setIsSpecialSearchOpen] = useState(false);
  const specialSearchRef = useRef(null);

  const [exportMode, setExportMode] = useState('待追蹤事項');
  const [isStationDropdownOpen, setIsStationDropdownOpen] = useState(false);
  const stationDropdownRef = useRef(null);
  const [isCostSidebarOpen, setIsCostSidebarOpen] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(100);
  
  const [formData, setFormData] = useState(getInitialFormState());
  const lastChangedField = useRef(null);

  // 2. Data Calculation Memos
  
  const calculationSummary = useMemo(() => {
    const sub = formData.repairItems.reduce((s, i) => s + ((Number(i.price) || 0) * (Number(i.quantity) || 0)), 0);
    const fee = formData.repairType === '2.1' ? Math.round(sub * 0.05) : 0;
    const tax = Math.round((sub + fee) * 0.05);
    return { subtotal: sub, tax, serviceFee: fee, final: sub + fee + tax };
  }, [formData.repairItems, formData.repairType]);

  const financialStats = useMemo(() => {
    const totalCosts = formData.costItems.reduce((sum, item) => sum + (Number(item.costAmount) || 0), 0);
    const totalIncome = formData.incomeItems.reduce((sum, item) => sum + (Number(item.incomeAmount) || 0), 0);
    return {
      totalCosts,
      totalIncome,
      netProfit: totalIncome - totalCosts
    };
  }, [formData.costItems, formData.incomeItems]);

  const jdmErrors = useMemo(() => {
    const { reportDate, reportSubmitDate, approvalDate, closeDate, closeSubmitDate, status, caseNumber } = formData.jdmControl;
    const errors = [];
    const sequence = [
      { key: 'reportDate', label: '提報日' },
      { key: 'reportSubmitDate', label: '送件日' }, 
      { key: 'approvalDate', label: '奉核日' },
      { key: 'closeDate', label: '結報日' },
      { key: 'closeSubmitDate', label: '送件日' } 
    ];

    for (let i = 0; i < sequence.length; i++) {
      const earlierDate = formData.jdmControl[sequence[i].key];
      if (!earlierDate) continue;
      for (let j = i + 1; j < sequence.length; j++) {
        const laterDate = formData.jdmControl[sequence[j].key];
        if (!laterDate) continue;
        if (formData.repairType === '2.1' && sequence[i].key === 'reportSubmitDate' && sequence[j].key === 'closeDate') {
          continue; 
        }
        const isStrict = (sequence[i].key === 'reportSubmitDate' && sequence[j].key === 'approvalDate');
        if (isStrict ? (earlierDate >= laterDate) : (earlierDate > laterDate)) {
          errors.push(`${sequence[j].label}應${isStrict ? '晚於' : '晚於或等於'}${sequence[i].label}`);
        }
      }
    }

    if (status === '提報') {
      if (!reportDate) errors.push("狀態為提報時，提報日必填");
      if (!reportSubmitDate) errors.push("狀態為提報時，送件日必填");
      if (closeDate || closeSubmitDate) {
        errors.push("案件狀態為提報時，不可填寫結報日期與送件日");
      }
      if (!caseNumber.trim()) errors.push("狀態為提報時，JDM 系統案號必填");
    }
    if (status === '結報') {
      if (!reportDate) errors.push("狀態為結報時，提報日必填");
      if (!reportSubmitDate) errors.push("狀態為結報時，送件日必填");
      if (!closeDate) errors.push("狀態為結報時，結報日必填");
      if (!closeSubmitDate) errors.push("狀態為結報時，送件日必填");
      if (!caseNumber.trim()) errors.push("狀態為結報時，JDM 系統案號必填");
    }
    if (formData.repairType === '2.1') {
      if (reportSubmitDate && closeSubmitDate && reportSubmitDate !== closeSubmitDate) {
        errors.push("契約內案件：送件日須為同一天");
      }
    }

    return [...new Set(errors)];
  }, [formData.jdmControl, formData.repairType]);

  const getJdmFieldError = useCallback((fieldId) => {
    const { reportDate, reportSubmitDate, approvalDate, closeDate, closeSubmitDate, status, caseNumber } = formData.jdmControl;
    const vals = { reportDate, reportSubmitDate, approvalDate, closeDate, closeSubmitDate };
    
    if (fieldId === 'caseNumber') return (status === '提報' || status === '結報') && !caseNumber.trim();
    if (status === '提報' && (fieldId === 'reportDate' || fieldId === 'reportSubmitDate') && !vals[fieldId]) return true;
    if (status === '提報' && (fieldId === 'closeDate' || fieldId === 'closeSubmitDate') && vals[fieldId]) return true;
    if (status === '結報' && ['reportDate', 'reportSubmitDate', 'closeDate', 'closeSubmitDate'].includes(fieldId) && !vals[fieldId]) return true;

    if (formData.repairType === '2.1') {
      if ((fieldId === 'reportSubmitDate' || fieldId === 'closeSubmitDate') && reportSubmitDate && closeSubmitDate && reportSubmitDate !== closeSubmitDate) {
        return true;
      }
    }

    if (!vals[fieldId]) return false;
    const sequence = ['reportDate', 'reportSubmitDate', 'approvalDate', 'closeDate', 'closeSubmitDate'];
    const myIdx = sequence.indexOf(fieldId);
    
    for (let i = 0; i < sequence.length; i++) {
      if (i === myIdx) continue;
      const otherVal = vals[sequence[i]];
      if (!otherVal) continue;

      if (formData.repairType === '2.1') {
        if ((fieldId === 'reportSubmitDate' && sequence[i] === 'closeDate') || (fieldId === 'closeDate' && sequence[i] === 'reportSubmitDate')) {
          continue;
        }
      }

      if (i < myIdx) {
        const isStrict = (sequence[i] === 'reportSubmitDate' && fieldId === 'approvalDate');
        if (isStrict ? (otherVal >= vals[fieldId]) : (otherVal > vals[fieldId])) return true;
      } else {
        const isStrict = (fieldId === 'reportSubmitDate' && sequence[i] === 'approvalDate');
        if (isStrict ? (vals[fieldId] >= otherVal) : (vals[fieldId] > otherVal)) return true;
      }
    }
    return false;
  }, [formData.jdmControl, formData.repairType]);

  const isDashboardSearchActive = useMemo(() => {
    return dashboardFilter.search.trim() !== '' || dashboardFilter.status !== '全部' || dashboardFilter.stations.length > 0 || dashboardFilter.reportMonth !== '' || dashboardFilter.closeMonth !== '' || dashboardFilter.specialFormula !== '';
  }, [dashboardFilter]);

  const availableStations = useMemo(() => {
    const stations = allCases.map(c => c.station).filter(Boolean);
    return [...new Set(stations)].sort();
  }, [allCases]);

  const addressResults = useMemo(() => {
    if (!debouncedSearchAddress || flattenedAddressData.length === 0) return [];
    const filtered = flattenedAddressData.filter(r => {
      if (formData.station && r.sourceStation !== formData.station) return false;
      const addr = String(r['建物門牌'] || r['門牌'] || ''), name = String(r['承租人'] || r['姓名'] || '');
      return addr.includes(debouncedSearchAddress) || name.includes(debouncedSearchAddress);
    });

    return filtered.sort((a, b) => {
      const addrA = String(a['建物門牌'] || a['門牌'] || '');
      const addrB = String(b['建物門牌'] || b['門牌'] || '');
      return addrA.localeCompare(addrB, 'zh-Hant');
    }).slice(0, 50);
  }, [debouncedSearchAddress, flattenedAddressData, formData.station]);

  const dashboardResults = useMemo(() => {
    if (!isDashboardSearchActive) return [];
    let filtered = [...allCases];
    if (dashboardFilter.search) {
      const s = dashboardFilter.search.toLowerCase();
      filtered = filtered.filter(c => 
        (String(c.address || '')).toLowerCase().includes(s) || 
        (String(c.tenant || '')).toLowerCase().includes(s) || 
        (String(c.station || '')).toLowerCase().includes(s) || 
        (String(c.jdmControl?.caseNumber || '')).toLowerCase().includes(s) ||
        (String(c.quoteTitle || '')).toLowerCase().includes(s) || 
        (c.repairItems || []).some(ri => (String(ri.name || '')).toLowerCase().includes(s))
      );
    }


    if (dashboardFilter.specialFormula && dashboardFilter.reportMonth && dashboardFilter.closeMonth) {
      const rM = dashboardFilter.reportMonth, cM = dashboardFilter.closeMonth;
      switch (dashboardFilter.specialFormula) {
        case '本期已完工': filtered = filtered.filter(c => { const rD = String(c.jdmControl?.reportDate || ''), cD = String(c.jdmControl?.closeDate || ''), status = String(c.jdmControl?.status || ''), type = c.repairType; return rD.startsWith(rM) && (cD >= rM && cD <= (cM + '-31')) && status === '結報' && type === '2.2'; }); break;
        case '前期已完工': filtered = filtered.filter(c => { const rD = String(c.jdmControl?.reportDate || ''), cD = String(c.jdmControl?.closeDate || ''), status = String(c.jdmControl?.status || ''), type = c.repairType; return (rD !== '' && rD < rM) && (cD >= rM && cD <= (cM + '-31')) && status === '結報' && type === '2.2'; }); break;
        case '本期待追蹤': filtered = filtered.filter(c => { const rD = String(c.jdmControl?.reportDate || ''), cD = String(c.jdmControl?.closeDate || ''), status = String(c.jdmControl?.status || ''), type = c.repairType; return rD.startsWith(rM) && !cD && status === '提報' && type === '2.2'; }); break;
        case '前期待追蹤': filtered = filtered.filter(c => { const rD = String(c.jdmControl?.reportDate || ''), cD = String(c.jdmControl?.closeDate || ''), status = String(c.jdmControl?.status || ''), type = c.repairType; return (rD !== '' && rD < rM) && !cD && status === '提報' && type === '2.2'; }); break;
        case '約內已完工': filtered = filtered.filter(c => { const rD = String(c.jdmControl?.reportDate || ''), cD = String(c.jdmControl?.closeDate || ''), status = String(c.jdmControl?.status || ''), type = c.repairType; return rD.startsWith(rM) && cD.startsWith(cM) && status === '結報' && type === '2.1'; }); break;
        case '內控管理': filtered = filtered.filter(c => { 
          const rD = String(c.jdmControl?.reportDate || ''); 
          const cD = String(c.jdmControl?.closeDate || ''); 
          return (rD >= rM) && (cD >= rM && cD <= (cM + '-31')); 
        }); break;
      }
    } else {
      if (dashboardFilter.reportMonth) filtered = filtered.filter(c => String(c.jdmControl?.reportDate || '').startsWith(dashboardFilter.reportMonth));
      if (dashboardFilter.closeMonth) filtered = filtered.filter(c => String(c.jdmControl?.closeDate || '').startsWith(dashboardFilter.closeMonth));
    }
    return filtered.sort((a, b) => { const dA = String(a.jdmControl?.reportDate || '9999-99-99'); const dB = String(b.jdmControl?.reportDate || '9999-99-99'); return dA.localeCompare(dB); });
  }, [allCases, dashboardFilter, isDashboardSearchActive]);

  const isFormDirty = useMemo(() => formData.station !== '' || formData.tenant !== '' || formData.address !== '' || formData.repairItems.length > 0, [formData]);

  // 3. Handlers

  const showMessage = (text, type) => { setMessage({ text, type }); setTimeout(() => setMessage({ text: '', type: '' }), 5000); };

  const copyToClipboard = useCallback((text, e) => {
    if (!text) return; if (e) e.stopPropagation();
    const ta = document.createElement("textarea"); ta.value = String(text); document.body.appendChild(ta); ta.select();
    try { 
      document.execCommand('copy'); 
      setCopyTip({ show: true, x: e ? e.clientX : 0, y: e ? e.clientY : 0 });
      setTimeout(() => setCopyTip({ show: false, x: 0, y: 0 }), 1500);
    } catch (err) {}
    document.body.removeChild(ta);
  }, []);

  const updateFormField = useCallback((field, value) => {
    if (field === 'reportDate' || field === 'completionDate') lastChangedField.current = field;
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const updateJdmField = useCallback((f, v) => {
    setFormData(prev => ({ ...prev, jdmControl: { ...prev.jdmControl, [f]: v } }));
  }, []);

  const toggleJdmCheckItem = useCallback((id) => {
    setFormData(prev => {
      const list = prev.jdmControl.checklist || [];
      const newList = list.includes(id) ? list.filter(i => i !== id) : [...list, id];
      return { ...prev, jdmControl: { ...prev.jdmControl, checklist: newList } };
    });
  }, []);

  const handleStatusClick = (targetStatus) => {
    if (formData.jdmControl.status === targetStatus) { updateJdmField('status', ''); return; }
    if (targetStatus === '提報' || targetStatus === '結報') {
      setStatusConfirm({ show: true, target: targetStatus, message: `${targetStatus}後將清除對應待補資料` });
    } else {
      updateJdmField('status', targetStatus);
    }
  };

  const executeStatusChange = () => {
    const { target } = statusConfirm;
    let newChecklist = [...(formData.jdmControl.checklist || [])];
    if (target === '提報') newChecklist = newChecklist.filter(id => id !== 'photoBefore' && id !== 'quotation');
    else if (target === '結報') newChecklist = [];
    setFormData(prev => ({ ...prev, jdmControl: { ...prev.jdmControl, status: target, checklist: newChecklist } }));
    setStatusConfirm({ show: false, target: '', message: '' });
    showMessage(`已變更狀態為${target}`, "success");
  };

  const handleExportExcel = () => {
    if (!window.XLSX) return;
    
    if (exportMode === '內控管理') {
      const inCases = dashboardResults.filter(c => c.repairType === '2.1');
      const outCases = dashboardResults.filter(c => c.repairType !== '2.1');
      const calcStats = (list) => {
        const c = list.reduce((s, i) => s + (i.costItems || []).reduce((ss, cc) => ss + (Number(cc.costAmount) || 0), 0), 0);
        const r = list.reduce((s, i) => s + (i.incomeItems || []).reduce((ss, ii) => ss + (Number(ii.incomeAmount) || 0), 0), 0);
        return { c, r, p: r - c };
      };
      const inStats = calcStats(inCases);
      const outStats = calcStats(outCases);
      const statsRows = [ 
        { label: "契約內費用合計", value: inStats.c }, 
        { label: "契約內收入合計", value: inStats.r }, 
        { label: "契約內總計收益", value: inStats.p }, 
        { label: "", value: "" }, 
        { label: "契約外費用合計", value: outStats.c }, 
        { label: "契約外收入合計", value: outStats.r }, 
        { label: "契約外總計收益", value: outStats.p }, 
        { label: "", value: "" }, 
        { label: "全部案件總計收益", value: inStats.p + outStats.p } 
      ];

      const maxLength = Math.max(dashboardResults.length, statsRows.length);
      const finalRows = [];

      for (let i = 0; i < maxLength; i++) {
        const item = dashboardResults[i];
        const row = {};
        const stat = statsRows[i];
        if (item) {
          const totalCost = (item.costItems || []).reduce((sum, ci) => sum + (Number(ci.costAmount) || 0), 0);
          const costContractors = [...new Set((item.costItems || []).map(ci => ci.contractor).filter(Boolean))].join(', ');
          const costInvoices = (item.costItems || []).map(ci => ci.invoiceNumber).filter(Boolean).join(', ');
          const totalCaseIncome = (item.incomeItems || []).reduce((sum, ii) => sum + (Number(ii.incomeAmount) || 0), 0);
          const incomeSources = [...new Set((item.incomeItems || []).map(ii => ii.source).filter(Boolean))].join(', ');
          const incomeInvoices = (item.incomeItems || []).map(ii => ii.receiptNumber).filter(Boolean).join(', ');
          
          row["契約內/外類別"] = item.repairType === '2.1' ? "契約內" : "契約外";
          row["JDM系統案號"] = String(item.jdmControl?.caseNumber || '');
          row["建物門牌地址"] = String(item.address || '');
          row["報價單標題"] = String(item.quoteTitle || '');
          row["費用合計"] = totalCost;
          row["維修廠商"] = costContractors;
          row["發票 / 收據號碼"] = costInvoices;
          row["收入合計"] = totalCaseIncome;
          row["請款廠商"] = incomeSources;
          row["發票號碼"] = incomeInvoices;
        } else {
          ["契約內/外類別", "JDM系統案號", "建物門牌地址", "報價單標題", "費用合計", "維修廠商", "發票 / 收據號碼", "收入合計", "請款廠商", "發票號碼"].forEach(k => row[k] = "");
        }
        row[" "] = ""; row["統計項目"] = stat ? stat.label : ""; row["統計數值"] = stat ? stat.value : "";
        finalRows.push(row);
      }
      const ws = window.XLSX.utils.json_to_sheet(finalRows);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, "內控管理");
      window.XLSX.writeFile(wb, `內控管理_${new Date().toISOString().slice(0,10)}.xlsx`);
      showMessage("Excel 內控管理 已下載", "success");
      return;
    }

    const exportData = dashboardResults.map((item, index) => {
      const fmtDate = (d) => String(d || '').replace(/-/g, '/');
      const combinedDesc = `${String(item.siteDescription || '').trim()} ${String(item.constructionDesc1 || '').trim()}`.trim();
      
      if (exportMode === '待追蹤事項') {
        return { "項次": index + 1, "案號": String(item.jdmControl?.caseNumber || ''), "站別": String(item.station || ''), "地址": String(item.address || ''), "報修日期": fmtDate(item.jdmControl?.reportDate), "故障問題描述": combinedDesc, "處理進度": "", "完工日": "" };
      } else if (exportMode === '工作提報單') {
        return { "契約狀態": item.repairType === '2.1' ? "契約內" : "契約外", "案號": String(item.jdmControl?.caseNumber || ''), "站別": String(item.station || ''), "地址": String(item.address || ''), "故障問題描述": combinedDesc, "報修日期": fmtDate(item.jdmControl?.reportDate), "完工日期": fmtDate(item.jdmControl?.closeDate), "送件日期": fmtDate(item.jdmControl?.closeSubmitDate) };
      } else if (exportMode === '滿意度調查') {
        return {
          "JDM系統案號": String(item.jdmControl?.caseNumber || ''),
          "捷運站點": String(item.station || ''),
          "門牌": String(item.address || ''),
          "施工說明": combinedDesc, 
          "JDM提報日期": fmtDate(item.jdmControl?.reportDate),
          "JDM結報日期": fmtDate(item.jdmControl?.closeDate),
          "JDM送件日期": fmtDate(item.jdmControl?.closeSubmitDate),
          "滿意度分級": String(item.satisfactionLevel || '--'),
          "滿意度分數": item.satisfactionLevel === '不需滿意度' ? "" : item.satisfactionScore, 
          "類別": item.repairType === '2.1' ? "契約內" : "契約外"
        };
      }
      return null;
    }).filter(Boolean);

    const ws = window.XLSX.utils.json_to_sheet(exportData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, exportMode);
    window.XLSX.writeFile(wb, `${exportMode}_${new Date().toISOString().slice(0,10)}.xlsx`);
    showMessage(`Excel ${exportMode} 已下載`, "success");
  };

  const executeReset = () => { setFormData(getInitialFormState()); setCurrentDocId(null); setIsResetModalOpen(false); setIsManualMode(false); setActiveView('editor'); window.scrollTo({ top: 0, behavior: 'smooth' }); showMessage("已重設案件", "success"); };
  const handleResetClick = () => (currentDocId || isFormDirty) ? setIsResetModalOpen(true) : executeReset();

  const handleFileUpload = (type, e) => {
    if (!isXlsxLoaded || !window.XLSX) return;
    const file = e.target.files[0]; if (!file) return;
    
    if (type === 'A') setImportStatus(prev => ({ ...prev, isProcessingA: true }));
    else if (type === 'B') setImportStatus(prev => ({ ...prev, isProcessingB: true }));
    else setImportStatus(prev => ({ ...prev, isProcessingC: true }));

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = window.XLSX.read(evt.target.result, { type: 'binary' });
        
        if (type === 'A') {
          const all = [];
          wb.SheetNames.forEach(name => {
            const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 });
            if (rows.length > 0) {
              const hIdx = Math.max(0, rows.findIndex(r => Array.isArray(r) && r.some(c => String(c).match(/門牌|地址/))));
              const headers = rows[hIdx] || [];
              rows.slice(hIdx + 1).forEach((r, ri) => {
                const obj = { sourceStation: name, _uid: `${name}-${ri}-${generateUUID()}` };
                headers.forEach((h, i) => { 
                  if (h) {
                    const val = r[i];
                    obj[String(h).trim()] = val === undefined ? '' : val;
                  }
                });
                all.push(obj);
              });
            }
          });
          setFlattenedAddressData(all); 
          setSheetNames(wb.SheetNames);
          
          if (user && db) {
             const chunks = chunkArray(all, 500);
             await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'address_master'), {
               chunkCount: chunks.length,
               sheets: wb.SheetNames,
               updatedAt: serverTimestamp(),
               totalRecords: all.length,
               originalFileName: file.name
             });
             const uploadPromises = chunks.map((chunk, i) => 
                setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', `address_master_chunk_${i}`), { list: chunk })
             );
             await Promise.all(uploadPromises);
             setImportStatus(prev => ({ ...prev, isProcessingA: false, fileNameA: file.name }));
          } else {
             setImportStatus(prev => ({ ...prev, isProcessingA: false, fileNameA: file.name }));
             showMessage("已完成匯入 (僅限本次作業)", 'success');
          }
        } else if (type === 'B') {
          const parsedB = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }).slice(4).map(r => ({ 
            id: String(r[1] || '').trim(), 
            name: String(r[2] || '').trim(), 
            unit: '式', 
            price: Number(r[6]) || 0 
          })).filter(i => i.name);
          setFileBData(parsedB);
          if (user && db) {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'price_master'), { list: parsedB, updatedAt: serverTimestamp() });
            setImportStatus(prev => ({ ...prev, isProcessingB: false, hasImportedB: true }));
          } else {
            setImportStatus(prev => ({ ...prev, isProcessingB: false, hasImportedB: true }));
            showMessage("已完成匯入 (僅限本次作業)", 'success');
          }
        } else if (type === 'C') {
          // [歷史案件匯入修復與優化版]
          const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
          
          // 標準化日期解析引擎：處理西元、民國、序號與補零
          const cleanDateAndExtractNote = (val) => {
            if (!val) return { date: '', note: '' };
            let s = String(val).trim();
            
            // 1. 處理 Excel 序號 (純數字)
            if (/^\d{5}(\.\d+)?$/.test(s)) {
              try {
                const dateObj = window.XLSX.SSF.parse_date_code(Number(s));
                const y = String(dateObj.y).padStart(4, '0');
                const m = String(dateObj.m).padStart(2, '0');
                const d = String(dateObj.d).padStart(2, '0');
                return { date: `${y}-${m}-${d}`, note: '' };
              } catch (e) { return { date: '', note: s }; }
            }

            // 2. 匹配日期組件 (支援點、橫線、斜線)
            const dateMatch = s.match(/(\d{2,4})[-/.](\d{1,2})[-/.](\d{1,2})/);
            if (dateMatch) {
              let y = parseInt(dateMatch[1]);
              const m = dateMatch[2].padStart(2, '0');
              const d = dateMatch[3].padStart(2, '0');
              
              // 智慧年份判斷
              if (String(dateMatch[1]).length === 3 || y < 111) { // 假設 111 以下為民國年
                y += 1911;
              } else if (String(dateMatch[1]).length === 2) { // 2 位數西元 (如 22)
                y += 2000;
              }

              const dateStr = `${String(y).padStart(4, '0')}-${m}-${d}`;
              const note = s.replace(dateMatch[0], '').trim();
              return { date: dateStr, note };
            }
            return { date: '', note: s };
          };

          const casesToUpload = rows.map(r => {
            // 標題清洗：強力移除所有換行符與空白字元
            const sr = {};
            Object.keys(r).forEach(k => {
              const cleanKey = String(k).replace(/[\n\r\s\u00A0\u3000]+/g, '');
              sr[cleanKey] = r[k];
            });

            const caseNoteList = [];
            const dateFields = [
              { key: 'JDM提報日期', label: '提報日' },
              { key: '提報送件日期', label: '送件' },
              { key: '奉核日', label: '奉核' },
              { key: '結報日期', label: '結報日' },
              { key: '結報送件日期', label: '送件' },
              { key: '收入發票日期', label: '發票日' }
            ];
            
            const cleanedDates = {};
            dateFields.forEach(df => {
              // fallback: 嘗試尋找不含 "JDM" 前綴的欄位
              const val = sr[df.key] || sr[df.key.replace('JDM', '')];
              const { date, note } = cleanDateAndExtractNote(val);
              cleanedDates[df.key] = date;
              if (note) caseNoteList.push(`${df.label}: ${note}`);
            });

            // 廠商與金額邏輯
            let billingVendor = String(sr['請款廠商'] || '').trim();
            let incomeVoucher = '';
            if (billingVendor.includes('晟晁')) {
              const numMatch = billingVendor.match(/\d+/);
              if (numMatch) {
                incomeVoucher = numMatch[0];
                billingVendor = '晟晁';
              }
            }

            let rawCostVendor = String(sr['維修廠商'] || '').trim();
            let costAmountInclusive = Number(sr['費用金額']) || 0;

            if (!billingVendor.includes('晟晁') && !rawCostVendor && billingVendor !== '') {
              rawCostVendor = billingVendor;
              costAmountInclusive = Number(sr['收入金額(稅後)']) || 0;
            }

            let costVendorClean = rawCostVendor;
            let costVoucher = '';
            const costNumMatch = rawCostVendor.match(/\d+/);
            if (costNumMatch) {
              costVoucher = costNumMatch[0];
              costVendorClean = rawCostVendor.replace(costNumMatch[0], '').trim();
            }

            // 反推未稅價
            const preTaxPrice = Math.round(costAmountInclusive / 1.05);

            // 滿意度
            const satisfactionOptions = ['非常滿意', '滿意', '尚可', '需改進', '不滿意'];
            let sLevel = '';
            let sScore = null;
            satisfactionOptions.forEach(l => {
              if (sr[l] !== undefined && sr[l] !== null && sr[l] !== '') {
                sLevel = l === '尚可' ? '普通' : l === '需改進' ? '尚須改進' : l;
                sScore = Number(sr[l]);
              }
            });

            const reportDateVal = cleanedDates['JDM提報日期'];

            return {
              station: String(sr['站點'] || '').trim(),
              address: String(sr['建物門牌地址'] || '').trim(),
              tenant: String(sr['承租人'] || '').trim(),
              phone: String(sr['聯絡電話'] || '').trim(),
              repairType: String(sr['契約內/外'] || '').includes('外') ? '2.2' : '2.1',
              quoteTitle: String(sr['報價單標題'] || '').trim(),
              siteDescription: String(sr['現場狀況'] || '').trim(),
              totalAmount: costAmountInclusive, // 這裡應該是收入金額
              reportDate: reportDateVal, // 寫入根層級 reportDate
              satisfactionLevel: sLevel,
              satisfactionScore: sScore,
              isSubLease: ['備註', '欄1', '欄2'].some(k => String(sr[k] || '').includes('包租')),
              jdmControl: {
                caseNumber: String(sr['JDM系統案號'] || '').trim(),
                reportDate: reportDateVal, // 寫入進度物件內的 reportDate
                reportSubmitDate: cleanedDates['提報送件日期'],
                approvalDate: cleanedDates['奉核日'],
                closeDate: cleanedDates['結報日期'],
                closeSubmitDate: cleanedDates['結報送件日期'],
                status: cleanedDates['結報日期'] ? '結報' : reportDateVal ? '提報' : '',
                remarks: caseNoteList.join('; '),
                checklist: []
              },
              costItems: [{
                id: generateUUID(),
                contractor: costVendorClean,
                costAmount: costAmountInclusive,
                voucherNumber: costVoucher,
                remarks: String(sr['費用備註'] || '').trim(),
                billingDate: '',
                workTask: String(sr['報價單標題'] || '').trim(),
                invoiceNumber: ''
              }],
              incomeItems: [{
                id: generateUUID(),
                source: billingVendor,
                incomeAmount: Number(sr['收入金額(稅後)']) || 0,
                incomeVoucherNumber: incomeVoucher,
                receiveDate: cleanedDates['收入發票日期'] || '',
                receiptNumber: String(sr['收入發票號碼'] || '').trim()
              }],
              repairItems: [{
                uid: generateUUID(),
                name: String(sr['報價單標題'] || '').trim(),
                price: preTaxPrice,
                quantity: 1,
                unit: '式',
                isManual: true
              }],
              updatedAt: serverTimestamp(),
              createdBy: user?.uid || 'system'
            };
          });

          if (user && db) {
            const uploadPromises = casesToUpload.map(data => 
              addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'repair_cases'), data)
            );
            await Promise.all(uploadPromises);
            setImportStatus(prev => ({ ...prev, isProcessingC: false }));
            showMessage(`成功匯入 ${casesToUpload.length} 筆歷史案件 (日期清洗已修正)`, 'success');
          } else {
            setImportStatus(prev => ({ ...prev, isProcessingC: false }));
            showMessage("未登入，無法執行匯入", "error");
          }
        }
      } catch (err) { 
        console.error(err);
        setImportStatus(prev => ({ ...prev, isProcessingA: false, isProcessingB: false, isProcessingC: false }));
        showMessage("檔案處理失敗", "error"); 
      } 
    };
    reader.readAsBinaryString(file); e.target.value = '';
  };

  const handleSaveToCloud = async () => {
    if (!user || !db) return;
    const needsRemarks = (['抽換', '退件'].includes(formData.jdmControl.status));
    if (needsRemarks && !formData.jdmControl.remarks.trim()) { showMessage("狀態為抽換或退件時，必須填寫案件備註", "error"); return; }
    const needsCaseNumber = (['提報', '結報'].includes(formData.jdmControl.status));
    if (needsCaseNumber && !formData.jdmControl.caseNumber.trim()) { showMessage("狀態為提報或結報時，JDM 系統案號必填", "error"); return; }
    if (jdmErrors.length > 0 && !formData.jdmControl.remarks.trim()) { showMessage("偵測到資料邏輯異常，必須於備註說明原因", "error"); return; }
    setIsSaving(true);
    try {
      const data = { ...formData, totalAmount: calculationSummary.final, updatedAt: serverTimestamp(), createdBy: user.uid };
      if (currentDocId) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'repair_cases', currentDocId), data);
      else { const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'repair_cases'), data); setCurrentDocId(docRef.id); }
      showMessage("案件儲存成功", "success");
    } catch (e) { showMessage("儲存失敗", "error"); } finally { setIsSaving(false); }
  };

  const toggleManualMode = () => {
    if (isManualMode) { setFormData(prev => ({ ...prev, station: '', address: '', tenant: '', phone: '', isSubLease: false })); setSearchSheet(''); setSearchAddress(''); showMessage("已關閉手動模式並清空欄位", "success"); }
    else { showMessage("已切換至手動填寫模式", "success"); }
    setIsManualMode(!isManualMode);
  };

  const handleEditCaseInternal = useCallback((item) => {
    const sanitizedCase = { 
      ...item, 
      satisfactionScore: item.satisfactionScore !== null ? Number(item.satisfactionScore) : null,
      jdmControl: { ...item.jdmControl, checklist: Array.isArray(item.jdmControl?.checklist) ? item.jdmControl.checklist : [] },
      costItems: (item.costItems || []).map(ci => ({ ...ci, voucherNumber: ci.voucherNumber || '', remarks: ci.remarks || '' })),
      incomeItems: (item.incomeItems || []).map(ii => ({ ...ii, incomeVoucherNumber: ii.incomeVoucherNumber || '', remarks: ii.remarks || '' }))
    };
    setFormData({ ...getInitialFormState(), ...sanitizedCase });
    setCurrentDocId(item.id);
    setIsManualMode(false);
    setActiveView('editor'); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleDeleteTrigger = useCallback((id) => { setPendingDeleteId(id); setIsDeleteModalOpen(true); }, []);

  const executeDelete = async () => {
    if (!pendingDeleteId || !db) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'repair_cases', pendingDeleteId));
      if (pendingDeleteId === currentDocId) { setFormData(getInitialFormState()); setCurrentDocId(null); }
      showMessage("案件已刪除", "success");
    } catch (e) { showMessage("刪除失敗", "error"); } finally { setIsDeleteModalOpen(false); setPendingDeleteId(null); }
  };

  const handleLogout = async () => {
    if (auth) {
      try {
        await signOut(auth);
        showMessage("已登出", "success");
      } catch (e) {
        showMessage("登出失敗", "error");
        console.error("Logout error:", e);
      }
    }
  };

  // --- Effects ---

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; script.async = true;
    script.onload = () => setIsXlsxLoaded(true); document.body.appendChild(script);
    if (!firebaseConfig.apiKey) { setConfigError(true); return; }
    const initAuth = async () => { 
      if (!auth) return;
      // No automatic anonymous or custom token sign-in; user must explicitly log in.
      // onAuthStateChanged will detect user status after explicit login.
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, setUser);
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    if (!user || !db || !auth.currentUser) return;
    const loadMasterData = async () => {
      setImportStatus(prev => ({ ...prev, isProcessingA: true, isProcessingB: true }));
      try {
        const addressPath = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'address_master');
        const addrDoc = await getDoc(addressPath);
        if (addrDoc.exists()) {
          const data = addrDoc.data();
          let combinedList = [];
          if (data.chunkCount && data.chunkCount > 0) {
             const promises = [];
             for (let i = 0; i < data.chunkCount; i++) { promises.push(getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', `address_master_chunk_${i}`))); }
             const chunkDocs = await Promise.all(promises);
             chunkDocs.forEach(c => { if (c.exists()) combinedList = combinedList.concat(c.data().list || []); });
          } else { combinedList = data.list || []; }
          setFlattenedAddressData(combinedList); setSheetNames(data.sheets || []);
          setImportStatus(prev => ({ ...prev, isProcessingA: false, fileNameA: data.originalFileName || '雲端資料庫' }));
        } else { setImportStatus(prev => ({ ...prev, isProcessingA: false })); }
        const pricePath = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'price_master');
        const priceDoc = await getDoc(pricePath);
        if (priceDoc.exists()) { setFileBData(priceDoc.data().list || []); setImportStatus(prev => ({ ...prev, isProcessingB: false, hasImportedB: true })); } 
        else { setImportStatus(prev => ({ ...prev, isProcessingB: false })); }
      } catch (e) { console.error("Master data 讀取失敗:", e); setImportStatus(prev => ({ ...prev, isProcessingA: false, isProcessingB: false })); }
    };
    loadMasterData();
  }, [user, db]);

  useEffect(() => {
    if (!user || !db || !hasActivatedDashboard) return;
    
    setQueryError(null);
    setIsLoadingDashboard(true);
    
    try {
      let casesRef = collection(db, 'artifacts', appId, 'public', 'data', 'repair_cases');
      let q = query(casesRef); // Base query

      // Apply server-side filtering for status.
      if (dashboardFilter.status && dashboardFilter.status !== '全部') { // If status is selected AND not '全部'
          if (dashboardFilter.status === '未完成案件') { // Updated name
              q = query(q, where('jdmControl.status', 'in', ['', '提報', '抽換', '退件']));
          } else if (dashboardFilter.status === '待提報') {
              q = query(q, where('jdmControl.status', '==', ''));
          } else {
              q = query(q, where('jdmControl.status', '==', dashboardFilter.status));
          }
      }

      // Step 2: Implement server-side filtering for stations.
      if (dashboardFilter.stations.length > 0) {
        if (dashboardFilter.stations.length > 10) {
          // Firestore 'in' query has a limit of 10. Throw an error for the user.
          throw new Error("Firestore 'in' 查詢一次最多只能篩選 10 個站點。請減少選擇的站點數量。");
        }
        q = query(q, where('station', 'in', dashboardFilter.stations));
      }
      
      const unsub = onSnapshot(q, (snap) => {
        setAllCases(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setIsLoadingDashboard(false);
      }, (error) => {
        console.error("Firestore onSnapshot 錯誤:", error);
        setQueryError("讀取資料庫時發生未知錯誤，請檢查 Firebase 設定與權限。");
        setIsLoadingDashboard(false);
        setAllCases([]);
      });
      
      return unsub;

    } catch (e) {
      console.error("查詢建立錯誤:", e);
      setQueryError(e.message);
      setIsLoadingDashboard(false);
      setAllCases([]);
    }
  }, [user, db, hasActivatedDashboard, dashboardFilter]);

  useEffect(() => { const t = setTimeout(() => setDebouncedSearchAddress(searchAddress), 300); return () => clearTimeout(t); }, [searchAddress]);

  useEffect(() => {
    const handleClickOutside = (e) => { 
      if (stationDropdownRef.current && !stationDropdownRef.current.contains(e.target)) setIsStationDropdownOpen(false);
      if (specialSearchRef.current && !specialSearchRef.current.contains(e.target)) setIsSpecialSearchOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isSyncEnabled) return;
    setFormData(prev => {
      const items = [...prev.incomeItems];
      if (items.length > 0) {
        items[0] = { ...items[0], subtotal: calculationSummary.subtotal, serviceFee: calculationSummary.serviceFee, tax: calculationSummary.tax, incomeAmount: calculationSummary.final };
        return { ...prev, incomeItems: items };
      }
      return prev;
    });
  }, [calculationSummary, isSyncEnabled]);

  useEffect(() => {
    if (isCostSidebarOpen) { document.body.style.overflow = 'hidden'; } 
    else { document.body.style.overflow = 'auto'; }
    return () => { document.body.style.overflow = 'auto'; };
  }, [isCostSidebarOpen]);

  if (configError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-rose-50 text-rose-700 p-4">
        <AlertCircle size={48} />
        <h1 className="text-2xl font-black mt-4">設定檔錯誤</h1>
        <p className="mt-2 font-bold text-center">Firebase 環境變數 (VITE_FIREBASE_CONFIG) 缺失或格式錯誤。</p>
        <p className="mt-1 text-sm text-center">請檢查您的 `.env` 檔案或伺服器環境變數設定。</p>
      </div>
    );
  }

  if (!auth) { // Firebase not initialized or auth object is null
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-600 p-4">
        <Loader2 size={48} className="animate-spin" />
        <h1 className="text-2xl font-black mt-4">正在初始化 Firebase...</h1>
        <p className="mt-2 font-bold text-center">請確認您的 Firebase 設定正確。</p>
      </div>
    );
  }

  if (!user) { // No user is logged in
    return <LoginScreen auth={auth} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-800 font-sans pb-32" onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY }) }>
      
      <style>{`
        input[type="date"], input[type="month"] { position: relative; }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="month"]::-webkit-calendar-picker-indicator {
          position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: auto; height: auto; color: transparent; background: transparent; cursor: pointer; margin: 0; padding: 0; opacity: 0;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>

      {floatingTip.show && (
        <div className="fixed z-[999999] pointer-events-none px-4 py-2 bg-slate-900/90 backdrop-blur text-white text-xs font-black rounded-2xl shadow-2xl border border-white/10 animate-in fade-in duration-150 flex items-center gap-2 whitespace-nowrap" style={{ left: mousePos.x + 15, top: mousePos.y + 15 }}>
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>{String(floatingTip.text)}
        </div>
      )}

      {statusConfirm.show && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setStatusConfirm({show:false, target:'', message:''})}></div>
          <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full relative z-10 text-center space-y-4 border animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-blue-50 text-blue-500 rounded-full w-fit mx-auto"><AlertCircle size={40} /></div>
            <h3 className="text-xl font-black text-slate-900">變更狀態為「{String(statusConfirm.target)}」？</h3>
            <p className="text-sm text-slate-600 font-bold">{String(statusConfirm.message)}</p>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setStatusConfirm({show:false, target:'', message:''})} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-sm transition-colors hover:bg-slate-200">取消</button>
              <button onClick={executeStatusChange} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-sm shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95">確認變更</button>
            </div>
          </div>
        </div>
      )}

      {isResetModalOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsResetModalOpen(false)}></div>
          <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full relative z-10 text-center space-y-4 border">
            <div className="p-4 bg-orange-50 text-orange-500 rounded-full w-fit mx-auto"><AlertTriangle size={40} /></div>
            <h3 className="text-xl font-black text-slate-900">確定要建立新案件嗎？</h3>
            <p className="text-sm text-slate-600 font-bold">目前輸入的所有資料將會被清空。</p>
            <div className="flex gap-3 mt-4"><button onClick={() => setIsResetModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-sm">取消</button><button onClick={executeReset} className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-black text-sm shadow-lg shadow-orange-200">確認重設</button></div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsDeleteModalOpen(false)}></div>
          <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full relative z-10 text-center space-y-4 border">
            <div className="p-4 bg-rose-50 text-rose-500 rounded-full w-fit mx-auto"><Trash2 size={40} /></div>
            <h3 className="text-xl font-black text-slate-900">永久刪除此案件？</h3>
            <p className="text-sm text-slate-600 font-bold">刪除後資料將無法恢復。</p>
            <div className="flex gap-3 mt-4"><button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-sm">返回</button><button onClick={executeDelete} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-black text-sm shadow-lg shadow-rose-200">永久刪除</button></div>
          </div>
        </div>
      )}

      <button onClick={() => setIsCostSidebarOpen(true)} className="fixed right-0 top-1/2 -translate-y-1/2 z-[60] bg-slate-900 text-white p-2 md:p-4 rounded-l-2xl shadow-2xl flex flex-col items-center gap-2 md:gap-3 group hover:pr-6 transition-all active:scale-95 border border-slate-800 border-r-0">
        <div className="bg-rose-500 p-1.5 md:p-2 rounded-lg group-hover:scale-110 shadow-lg shadow-rose-500/20 transition-transform"><DollarSign size={16} /></div>
        <div className="[writing-mode:vertical-lr] font-black text-[10px] md:text-xs tracking-[0.1em] md:tracking-[0.2em] py-1 md:py-2 border-t border-slate-700 whitespace-nowrap uppercase">內部收支登記</div>
        <ChevronLeft size={14} className="opacity-40 md:opacity-100" />
      </button>

      <div 
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] transition-opacity duration-300 ${isCostSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setIsCostSidebarOpen(false)}
      ></div>
      <div 
        className={`fixed top-0 right-0 h-full w-full md:w-[650px] bg-white z-[101] shadow-2xl flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isCostSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4"><div className="bg-rose-600 p-2.5 rounded-xl"><DollarSign size={24} /></div><div><h2 className="font-black text-base uppercase tracking-widest whitespace-nowrap">內部收支登記</h2><p className="text-xs text-slate-400 font-bold whitespace-nowrap">僅供內部對帳與行政紀錄使用</p></div></div>
          <button onClick={() => setIsCostSidebarOpen(false)} className="p-2 hover:bg-slate-800 rounded-xl transition-colors"><X size={24} /></button>
        </div>
        <div className="flex bg-slate-100 p-1.5 m-4 rounded-xl border border-slate-200">
          <button onClick={() => setActiveTab('expense')} className={`flex-1 py-3 rounded-lg text-sm font-black flex items-center justify-center gap-2 ${activeTab === 'expense' ? 'bg-white text-rose-600 shadow-sm border border-rose-100' : 'text-slate-400'}`}>費用</button>
          <button onClick={() => setActiveTab('income')} className={`flex-1 py-3 rounded-lg text-sm font-black flex items-center justify-center gap-2 ${activeTab === 'income' ? 'bg-white text-emerald-600 shadow-sm border border-emerald-100' : 'text-slate-400'}`}>收入</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4 custom-scrollbar">
          {activeTab === 'expense' ? (
            <div className="space-y-3 pb-24">
              {formData.costItems.map((item, idx) => (
                <div key={item.id} className="relative bg-white p-4 rounded-2xl border border-slate-200 shadow-sm group">
                  <div className="absolute left-0 top-0 bottom-0 w-2 bg-rose-500 rounded-l-2xl"></div>
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase whitespace-nowrap shrink-0 ml-1">維修廠商</label><input type="text" className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl`} value={item.contractor} onChange={(e) => { const n = [...formData.costItems]; n[idx].contractor = e.target.value; setFormData({...formData, costItems: n}); }} /></div>
                      <div className="space-y-1 relative"><label className="text-[10px] font-black text-slate-500 uppercase whitespace-nowrap shrink-0 ml-1">發票日期</label><input type="date" className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl`} value={item.billingDate} onChange={(e) => { const n = [...formData.costItems]; n[idx].billingDate = e.target.value; setFormData({...formData, costItems: n}); }} /><button onClick={() => setFormData({...formData, costItems: formData.costItems.filter(ci => ci.id !== item.id)})} className="absolute -top-1 -right-1 p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase whitespace-nowrap shrink-0 ml-1">請款內容</label><input type="text" className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl`} value={item.workTask} onChange={(e) => { const n = [...formData.costItems]; n[idx].workTask = e.target.value; setFormData({...formData, workTask: n}); }} /></div>
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase whitespace-nowrap shrink-0 ml-1">發票 / 收據號碼</label><input type="text" className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl`} value={item.invoiceNumber} onChange={(e) => { const n = [...formData.costItems]; n[idx].invoiceNumber = e.target.value; setFormData({...formData, invoiceNumber: n}); }} /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase whitespace-nowrap shrink-0 ml-1">費用單號碼</label><input type="text" className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl`} value={item.voucherNumber} onChange={(e) => { const n = [...formData.costItems]; n[idx].voucherNumber = e.target.value; setFormData({...formData, voucherNumber: n}); }} /></div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase whitespace-nowrap shrink-0 ml-1">費用金額</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-rose-500 font-black text-xs">$</span>
                          <input type="number" min="0" onWheel={(e) => e.target.blur()} className={`w-full pl-7 pr-3 py-2 text-sm rounded-xl text-right font-black bg-rose-50/30 border border-rose-200 text-rose-700 outline-none transition-all focus:border-rose-400 focus:ring-2 focus:ring-rose-100`} value={item.costAmount} onChange={(e) => { const val = e.target.value; const n = [...formData.costItems]; n[idx].costAmount = val === "" ? "" : Math.max(0, Number(val)); setFormData({...formData, costItems: n}); }} />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase whitespace-nowrap shrink-0 ml-1">備註</label>
                      <AutoResizeTextarea value={item.remarks} onChange={(e) => { const n = [...formData.costItems]; n[idx].remarks = e.target.value; setFormData({...formData, costItems: n}); }} className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl !py-2 max-h-[100px] overflow-y-auto custom-scrollbar`} placeholder="輸入費用相關說明" />
                    </div>
                  </div>
                </div>
              ))} 
              <button onClick={() => setFormData({...formData, costItems: [...formData.costItems, { id: generateUUID(), contractor: '', workTask: '', invoiceNumber: '', billingDate: '', costAmount: '', voucherNumber: '', remarks: '' }]})} className="group w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 font-bold text-sm flex justify-center items-center gap-2 hover:border-rose-400 hover:text-rose-500 transition-all"><Plus size={18} /> 新增費用項目</button>
            </div>
          ) : (
            <div className="space-y-3 pb-24">
              {formData.incomeItems.map((item, idx) => (
                <div key={item.id} className="relative bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="absolute left-0 top-0 bottom-0 w-2 bg-emerald-500 rounded-l-2xl"></div>
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 space-y-1"><div className="flex justify-between items-center"><label className="text-[10px] font-black text-slate-500 uppercase whitespace-nowrap shrink-0 ml-1">請款廠商</label> {idx === 0 && <button onClick={() => setIsSyncEnabled(!isSyncEnabled)} className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 rounded border flex items-center gap-1 transition-all hover:bg-slate-200 shrink-0">{isSyncEnabled ? <Link2 size={9}/> : <Link2Off size={9}/>}{isSyncEnabled ? "金額連動中" : "手動編輯"}</button>}</div><input type="text" className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl`} value={item.source} onChange={(e) => { const n = [...formData.incomeItems]; n[idx].source = e.target.value; setFormData({...formData, incomeItems: n}); }} /></div>
                      <div className="space-y-1 relative"><label className="text-[10px] font-black text-slate-500 uppercase whitespace-nowrap shrink-0 ml-1">發票日期</label><input type="date" className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl`} value={item.receiveDate} onChange={(e) => { const n = [...formData.incomeItems]; n[idx].receiveDate = e.target.value; setFormData({...formData, incomeItems: n}); }} /><button onClick={() => setFormData({...formData, incomeItems: formData.incomeItems.filter(ii => ii.id !== item.id)})} className="absolute -top-1 -right-1 p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase whitespace-nowrap shrink-0 ml-1">契約類型</label><div className={`w-full border border-slate-200 bg-slate-50 text-slate-700 font-bold px-3 py-2 text-sm rounded-xl`}>{formData.repairType === '2.1' ? "契約內" : "契約外"}</div></div>
                      <div className="md:col-span-1 space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase whitespace-nowrap shrink-0 ml-1">發票號碼</label><input type="text" className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl`} value={item.receiptNumber} onChange={(e) => { const n = [...formData.incomeItems]; n[idx].receiptNumber = e.target.value; setFormData({...formData, incomeItems: n}); }} /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase whitespace-nowrap shrink-0 ml-1">收入單號碼</label><input type="text" className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl`} value={item.incomeVoucherNumber} onChange={(e) => { const n = [...formData.incomeItems]; n[idx].incomeVoucherNumber = e.target.value; setFormData({...formData, incomeItems: n}); }} /></div>
                      <div className="md:col-span-1 space-y-1">
                        <label className="text-[10px] font-black text-emerald-600 uppercase whitespace-nowrap shrink-0 ml-1">收入金額(稅後)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-emerald-500 font-black text-xs">$</span>
                          <input type="number" min="0" onWheel={(e) => e.target.blur()} readOnly={idx === 0 && isSyncEnabled} className={`w-full pl-7 pr-3 py-2 text-sm rounded-xl text-right font-black transition-all ${ (idx === 0 && isSyncEnabled) ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-white text-emerald-700 border-emerald-400 shadow-sm focus:ring-2 focus:ring-emerald-100' }`} value={item.incomeAmount} onChange={(e) => { const val = Math.max(0, Number(e.target.value)); const n = [...formData.incomeItems]; n[idx].incomeAmount = val; if (idx === 0) setIsSyncEnabled(false); setFormData({...formData, incomeItems: n}); }} />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase whitespace-nowrap shrink-0 ml-1">備註</label><AutoResizeTextarea value={item.remarks} onChange={(e) => { const n = [...formData.incomeItems]; n[idx].remarks = e.target.value; setFormData({...formData, incomeItems: n}); }} className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl !py-2 max-h-[100px] overflow-y-auto custom-scrollbar`} placeholder="輸入收入相關說明" /></div>
                  </div>
                </div>
              ))} 
              <button onClick={() => setFormData({...formData, incomeItems: [...formData.incomeItems, { id: generateUUID(), source: '晟晁', receiptNumber: '', receiveDate: '', subtotal: 0, serviceFee: 0, tax: 0, incomeAmount: 0, incomeVoucherNumber: '', remarks: '' }]})} className="group w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 font-bold text-sm flex justify-center items-center gap-2 hover:border-emerald-400 hover:text-emerald-500 transition-all"><Plus size={18} /> 新增收入項目</button>
            </div>
          )}
        </div>
        
        <div className="p-6 bg-white border-t flex flex-col gap-3 shadow-[0_-10px_30px_-5px_rgba(0,0,0,0.06)] shrink-0">
          <div className="flex justify-between items-center border-b border-slate-50 pb-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">本案收益</span>
              <span className="text-[9px] font-bold text-slate-300 mt-0.5">(總收入 - 總費用)</span>
            </div>
            <span className={`text-2xl font-black font-mono tracking-tighter ${financialStats.netProfit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
              {financialStats.netProfit >= 0 ? '+' : ''}${financialStats.netProfit.toLocaleString()}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
              {activeTab === 'expense' ? '費用合計' : '收入合計'}
            </span>
            <span className={`text-3xl font-black font-mono tracking-tighter ${activeTab === 'expense' ? 'text-rose-600' : 'text-emerald-600'}`}>
              ${(activeTab === 'expense' ? financialStats.totalCosts : formData.incomeItems.reduce((sum, item) => sum + (Number(item.incomeAmount) || 0), 0)).toLocaleString()}
            </span>
          </div>
          
          <button onClick={handleSaveToCloud} disabled={isSaving} className="w-full mt-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all hover:bg-slate-800 active:scale-95 shadow-lg shadow-slate-200">
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} 立即儲存並同步雲端
          </button>
        </div>
      </div>

      <div className={`mx-auto mb-6 transition-all duration-300 ${activeView === 'dashboard' ? 'max-w-[1600px]' : 'max-w-5xl'}`}>
        <div className="bg-slate-900 rounded-3xl p-1.5 flex shadow-2xl shadow-slate-200">
          <button onClick={() => setActiveView('editor')} className={`flex-1 py-3 px-6 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-3 ${activeView === 'editor' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-white'}`}>
            <div className={`p-1.5 rounded-lg ${activeView === 'editor' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}><FileText size={16} /></div>
            {currentDocId ? '編輯維修單' : '建立新維修單'}
          </button>
          <button onClick={() => { setActiveView('dashboard'); setHasActivatedDashboard(true); }} className={`flex-1 py-3 px-6 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-3 ${activeView === 'dashboard' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-white'}`}>
            <div className={`p-1.5 rounded-lg ${activeView === 'dashboard' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-500'}`}><LayoutDashboard size={16} /></div>
            案件管理中心
          </button>
        </div>
      </div>

      <div className={`mx-auto space-y-6 transition-all duration-300 ${activeView === 'dashboard' ? 'max-w-[1600px]' : 'max-w-5xl'}`}>
        {activeView === 'editor' ? (
          <>
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-4 shrink-0">
                <div className={`p-3 rounded-2xl shadow-lg ${currentDocId ? 'bg-purple-600' : 'bg-blue-600'}`}><Database className="text-white" size={24} /></div>
                <div className="flex flex-col">
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">{currentDocId ? '編輯現有案件' : '建立新維修單'}</h1>
                  <div className="flex flex-col mt-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${user ? 'bg-emerald-500 animate-pulse' : configError ? 'bg-rose-500' : 'bg-orange-400 animate-bounce'}`}></span>
                      <span className={`text-[11px] font-black uppercase tracking-wider ${configError ? 'text-rose-600 animate-pulse' : 'text-slate-500'}`}>
                        {configError ? '環境變數缺失' : !user ? '正在驗證連線中...' : '雲端同步啟動中'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 flex flex-wrap justify-end items-center gap-3 w-full">
                <div className="flex flex-col items-center gap-1">
                  <label className={`flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl cursor-pointer hover:bg-indigo-100 transition font-bold text-sm border border-indigo-200 shadow-sm whitespace-nowrap shrink-0 min-w-[130px] ${importStatus.isProcessingA ? 'opacity-50 pointer-events-none' : ''}`}> 
                    {importStatus.isProcessingA ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} 匯入代管清冊
                    <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => handleFileUpload('A', e)} disabled={importStatus.isProcessingA} />
                  </label>
                  {importStatus.fileNameA && !importStatus.isProcessingA && <span className="text-[10px] font-black text-emerald-600 flex items-center gap-1"><CheckCircle size={10} /> 已載入 {importStatus.fileNameA}</span>}
                </div>
                <div className="flex flex-col items-center gap-1">
                  <label className={`flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl cursor-pointer hover:bg-emerald-100 transition font-bold text-sm border border-emerald-200 shadow-sm whitespace-nowrap shrink-0 min-w-[130px] ${importStatus.isProcessingB ? 'opacity-50 pointer-events-none' : ''}`}> 
                    {importStatus.isProcessingB ? <Loader2 size={14} className="animate-spin" /> : <ClipboardList size={14} />} 匯入價目表
                    <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => handleFileUpload('B', e)} disabled={importStatus.isProcessingB} />
                  </label>
                  {importStatus.hasImportedB && !importStatus.isProcessingB && <span className="text-[10px] font-black text-emerald-600 flex items-center gap-1"><CheckCircle size={10} /> 已同步雲端價目表</span>}
                </div>
                <div className="flex items-center gap-3 ml-2 border-l-2 pl-3 self-start">
                  <button onClick={handleResetClick} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all whitespace-nowrap shrink-0"><Plus size={14} /> 建立新案件</button>
                  <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all whitespace-nowrap shrink-0"><User size={14} /> 登出</button>
                  <button onClick={handleSaveToCloud} disabled={isSaving || configError} className={`flex items-center gap-2 px-8 py-2 text-white rounded-xl font-black text-sm transition shadow-lg active:scale-95 whitespace-nowrap shrink-0 ${currentDocId ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'} ${configError ? 'opacity-50 cursor-not-allowed' : ''}`}>{isSaving ? <Clock className="animate-spin" size={16} /> : <Save size={16} />} {isSaving ? '儲存中' : '儲存案件'}</button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-6 border-b pb-2">
                <h2 className="text-base font-black text-blue-700 uppercase tracking-widest whitespace-nowrap shrink-0">1. 報修人資料</h2>
                {flattenedAddressData.length === 0 && !importStatus.isProcessingA && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-lg border border-amber-200 text-xs font-bold animate-pulse">
                    <Info size={14} /> 尚未載入代管清冊，請執行匯入以同步資料
                  </div>
                )}
              </div>
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="lg:w-1/3 space-y-4">
                  <div className="space-y-1.5"><label className="text-xs font-black text-slate-500 flex items-center gap-2 uppercase whitespace-nowrap shrink-0"><Search size={12} /> 站點搜尋</label><div className="relative"><Search size={14} className="absolute left-3.5 top-3 text-slate-300" /><input type="text" className={`w-full pl-10 ${EDITABLE_INPUT_STYLE}`} value={searchSheet} onChange={(e) => setSearchSheet(e.target.value)} placeholder="站點名稱" />{searchSheet && sheetNames.filter(n => n.includes(searchSheet)).length > 0 && (<div className="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar">{sheetNames.filter(n => n.includes(searchSheet)).map((n, i) => (<div key={i} className="p-3 hover:bg-blue-50 cursor-pointer text-sm font-bold transition-colors border-b last:border-none" onClick={() => { setFormData({...formData, station: n}); setSearchSheet(''); }}>{n}</div>))}</div>)}</div></div>
                  <div className="space-y-1.5"><label className="text-xs font-black text-slate-500 flex items-center gap-2 uppercase whitespace-nowrap shrink-0"><User size={12} /> 地址 / 承租人搜尋</label><div className="relative"><Search size={14} className="absolute left-3.5 top-3 text-slate-300" /><input type="text" className={`w-full pl-10 ${EDITABLE_INPUT_STYLE}`} value={searchAddress} onChange={(e) => setSearchAddress(e.target.value)} placeholder="關鍵字搜尋" />{addressResults.length > 0 && (<div className="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">{addressResults.map((r) => (<div key={r._uid} className="p-3 hover:bg-indigo-50 border-b last:border-none flex justify-between items-center cursor-pointer transition-colors" onClick={() => { 
                    const isSub = ['備註', '欄1', '欄2'].some(key => String(r[key] || '').includes('包租'));
                    setFormData({ ...formData, station: r.sourceStation, address: r['建物門牌'] || r['門牌'] || '', tenant: r['承租人'] || r['姓名'] || '', phone: r['連絡電話'] || r['聯絡電話'] || r['電話'] || r['手機'] || '', isSubLease: isSub }); 
                    setSearchAddress(''); 
                  }}><div className="flex-1 text-base font-bold">{String(r['建物門牌'] || r['門牌'] || '')}</div><MapPin size={14} className="text-slate-300 ml-2 shrink-0" /></div>))}</div>)}</div></div>
                  <div className="space-y-2"><button onClick={() => { setSearchSheet(''); setSearchAddress(''); setFormData({ ...formData, station: '', address: '', tenant: '', phone: '', isSubLease: false }); }} className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 hover:text-slate-700 transition font-black text-xs uppercase border border-slate-200 whitespace-nowrap shrink-0"><RotateCcw size={12} /> 清除搜尋條件</button><button onClick={toggleManualMode} className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all font-black text-xs uppercase border ${isManualMode ? 'bg-amber-500 text-white border-amber-600 shadow-lg shadow-amber-200' : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'} whitespace-nowrap shrink-0`}>{isManualMode ? <CheckCircle size={14} /> : <Edit3 size={14} />}{isManualMode ? '手動模式已開啟' : '手動填寫 (限車位)'}</button></div>
                </div>
                <div className="lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoCard icon={Building2} label="目前選定站點" value={formData.station} colorClass="bg-blue-50/50 border-blue-100 text-blue-600" onCopy={copyToClipboard} />
                  <div className="bg-emerald-50/50 border-emerald-100 rounded-2xl border flex flex-col divide-y divide-emerald-100 shadow-sm overflow-hidden">
                    <div className={`p-4 transition-all ${isManualMode ? 'bg-white' : ''}`}>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block">
                          承租人姓名 {formData.isSubLease && <span className="text-rose-600 ml-1 font-black animate-pulse">(包租契約)</span>}
                        </label>
                        {formData.tenant && (
                          <button type="button" onClick={(e) => copyToClipboard(formData.tenant, e)} className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black transition-all hover:bg-blue-100 whitespace-nowrap border border-blue-100">
                            <Copy size={10} /> 複製
                          </button>
                        )}
                      </div>
                      {isManualMode ? (
                        <input className={`w-full ${EDITABLE_INPUT_STYLE} !py-1.5 !px-3 rounded-lg`} value={formData.tenant} onChange={(e) => updateFormField('tenant', e.target.value)} placeholder="輸入承租人" />
                      ) : (
                        <div className="text-sm font-black text-emerald-600 truncate">{formData.tenant || '--'}</div>
                      )}
                    </div>
                    <div className={`p-4 transition-all ${isManualMode ? 'bg-white' : ''}`}>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block">聯絡電話</label>
                        {formData.phone && (
                          <button type="button" onClick={(e) => copyToClipboard(formData.phone, e)} className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black transition-all hover:bg-blue-100 whitespace-nowrap border border-blue-100">
                            <Copy size={10} /> 複製
                          </button>
                        )}
                      </div>
                      {isManualMode ? (
                        <input className={`w-full ${EDITABLE_INPUT_STYLE} !py-1.5 !px-3 rounded-lg`} value={formData.phone} onChange={(e) => updateFormField('phone', e.target.value)} placeholder="輸入電話" />
                      ) : (
                        <div className="text-sm font-black text-emerald-600 truncate">{formData.phone || '--'}</div>
                      )}
                    </div>
                  </div>
                  <div className={`sm:col-span-2 rounded-2xl p-4 border transition-all ${isManualMode ? 'bg-white border-amber-200 ring-2 ring-amber-100 shadow-md' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-3">
                        <MapPin size={16} className={isManualMode ? 'text-amber-500' : 'text-slate-400'} />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">建物門牌地址</span>
                      </div>
                      {formData.address && (
                        <button type="button" onClick={(e) => copyToClipboard(formData.address, e)} className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black transition-all hover:bg-blue-100 whitespace-nowrap border border-blue-100">
                          <Copy size={10} /> 複製
                        </button>
                      )}
                    </div>
                    {isManualMode ? (
                      <AutoResizeTextarea value={formData.address} onChange={(e) => updateFormField('address', e.target.value)} className="w-full !border-none !shadow-none !bg-transparent !p-0 font-black text-slate-700 text-sm focus:ring-0" placeholder="在此手動輸入詳細地址 (支援多行)" />
                    ) : (
                      <div className="text-sm font-black text-slate-700 leading-tight break-all">
                        {formData.address || '--'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-6 border-b pb-2 shrink-0 overflow-hidden">
                <div className="flex items-center gap-4">
                  <h2 className="text-base font-black text-blue-800 uppercase tracking-widest whitespace-nowrap shrink-0">2. 修繕項目與費用</h2>
                  {fileBData.length === 0 && !importStatus.isProcessingB && formData.repairType === '2.1' && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-lg border border-amber-200 text-xs font-bold animate-pulse">
                      <Info size={14} /> 偵測到環境 ID 已更換，請點擊右上角重新執行「匯入」以同步價目表
                    </div>
                  )}
                </div>
                <div className="group relative" onMouseEnter={() => formData.repairItems.length > 0 && setFloatingTip({ show: true, text: "已有項目，鎖定編輯" })} onMouseLeave={() => setFloatingTip({ show: false, text: "" })}><select className={`text-xs p-2.5 border rounded-xl font-black whitespace-nowrap transition-all ${formData.repairItems.length > 0 ? 'text-slate-500 bg-slate-50 pointer-events-none cursor-default' : 'text-blue-700 bg-white cursor-pointer shadow-sm hover:border-blue-400'}`} value={formData.repairType} onChange={(e) => updateFormField('repairType', e.target.value)}><option value="2.1">契約內</option><option value="2.2">契約外</option></select></div>
              </div>
              <div className="space-y-4 mb-6">
                <div className="space-y-1.5"><div className="flex justify-between items-center"><label className="text-xs font-black text-slate-500 uppercase whitespace-nowrap shrink-0">報價單標題</label>{formData.quoteTitle && (<button type="button" onClick={(e) => copyToClipboard(formData.quoteTitle, e)} className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-black transition-all hover:bg-blue-100 whitespace-nowrap border border-blue-100"><Copy size={12} /> 複製</button>)}</div><input type="text" className={`w-full ${EDITABLE_INPUT_STYLE}`} value={formData.quoteTitle} onChange={(e) => updateFormField('quoteTitle', e.target.value)} placeholder="報價標題" /></div>
              {formData.repairType === '2.1' ? (<div className="space-y-1.5"><label className="text-xs font-black text-slate-500 uppercase whitespace-nowrap shrink-0">搜尋項次或項目</label><div className="relative"><Search size={16} className="absolute left-3.5 top-3.5 text-slate-500" /><input type="text" className={`w-full pl-10 pr-4 py-3 rounded-xl border ${EDITABLE_INPUT_STYLE}`} value={searchB} onChange={(e) => setSearchB(e.target.value)} placeholder="搜尋項次或項目" />{searchB && (<div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-xl max-h-56 overflow-y-auto custom-scrollbar">{fileBData.filter(b => b.id.toLowerCase().includes(searchB.toLowerCase()) || b.name.includes(searchB)).map((b, i) => (<div key={i} className="p-3 hover:bg-blue-50 border-b last:border-none flex justify-between items-center cursor-pointer transition-colors" onClick={() => { setFormData(p => ({ ...p, repairItems: [...p.repairItems, { uid: generateUUID(), ...b, quantity: 1, isManual: false }] })); setSearchB(''); }}><div className="flex flex-col text-sm font-black"><span>{b.id}</span><span>{b.name}</span></div><span className="text-xs font-black text-emerald-600 shrink-0 ml-3">${b.price.toLocaleString()}</span></div>))}</div>)}</div></div>) : (<button onClick={() => setFormData(p => ({ ...p, repairItems: [...p.repairItems, { uid: generateUUID(), id: '', name: '', unit: '', price: '', quantity: 1, isManual: true }] }))} className="w-full py-3 border-2 border-dashed border-blue-400 rounded-2xl font-black text-sm text-blue-600 bg-blue-50/30 flex justify-center items-center gap-2 transition-all hover:bg-blue-50 whitespace-nowrap"><Plus size={16} /> 新增自定義項目</button>)}
              </div>
              <div className="overflow-x-auto border rounded-2xl shadow-sm custom-scrollbar"><table className="w-full text-sm border-collapse table-fixed"><thead className="bg-slate-50 text-xs text-slate-500 font-black uppercase border-b"><tr><th className="p-4 w-28 text-center whitespace-nowrap shrink-0">項次</th><th className="p-4 text-left whitespace-nowrap shrink-0">項目</th><th className="p-4 w-20 text-center whitespace-nowrap shrink-0">單位</th><th className="p-4 w-32 text-right whitespace-nowrap shrink-0">單價</th><th className="p-4 w-24 text-center whitespace-nowrap shrink-0">數量</th><th className="p-4 w-32 text-right whitespace-nowrap shrink-0">小計</th><th className="p-4 w-12 whitespace-nowrap shrink-0"></th></tr></thead><tbody className="divide-y divide-slate-100 bg-white">
                {formData.repairItems.length === 0 ? (<tr><td colSpan="7" className="p-16 text-center text-slate-300 font-black italic uppercase tracking-widest">目前尚未加入修繕內容</td></tr>) : (formData.repairItems.map((item, idx) => (
                  <tr key={item.uid} className="hover:bg-blue-50/20 group transition-colors">
                    <td className="p-3 text-center font-mono text-sm text-slate-500 truncate">{item.isManual ? (idx + 1) : item.id}</td>
                    <td className="p-3">{item.isManual ? (<div className="relative group/copy flex items-center gap-1.5"><input className={`w-full ${EDITABLE_INPUT_STYLE} !px-3 !py-1.5 !text-sm`} value={item.name} onChange={(e) => { const n = [...formData.repairItems]; n[idx].name = e.target.value; setFormData({...formData, repairItems: n}); }} /><button onClick={(e) => copyToClipboard(item.name, e)} className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover/copy:opacity-100 shrink-0" title="複製項目名稱"><Copy size={12} /></button></div>) : (<div className="font-black text-slate-700 truncate px-2 text-sm">{String(item.name)}</div>)}
                    </td>
                    <td className="p-3 text-center"><input className={`w-full text-center border rounded-lg py-1 ${item.isManual ? EDITABLE_INPUT_STYLE : 'bg-slate-50 border-none font-bold'}`} value={item.unit} readOnly={!item.isManual} onChange={(e) => { const n = [...formData.repairItems]; n[idx].unit = e.target.value; setFormData({...formData, repairItems: n}); }} /></td>
                    <td className="p-3"><input type="number" onWheel={(e) => e.target.blur()} className={`w-full py-1 rounded-lg text-right font-mono border ${item.isManual ? EDITABLE_INPUT_STYLE : 'bg-slate-50 border-none text-slate-500'}`} value={item.price} readOnly={!item.isManual} onChange={(e) => { const v = e.target.value; const n = [...formData.repairItems]; n[idx].price = v === "" ? "" : Math.max(0, Number(v)); setFormData({...formData, repairItems: n}); }} /></td>
                    <td className="p-3 text-center"><input type="number" onWheel={(e) => e.target.blur()} className={`w-full py-1 rounded-lg text-center font-black border ${EDITABLE_INPUT_STYLE}`} value={item.quantity} onChange={(e) => { const v = e.target.value; const n = [...formData.repairItems]; n[idx].quantity = v === "" ? "" : Math.max(0, Number(v)); setFormData({...formData, repairItems: n}); }} /></td>
                    <td className="p-3 text-right font-black text-blue-600 font-mono text-base">${((Number(item.price) || 0) * (Number(item.quantity) || 0)).toLocaleString()}</td>
                    <td className="p-3 text-center"><button onClick={() => setFormData({...formData, repairItems: formData.repairItems.filter((_, i) => i !== idx)})} className="p-2 text-slate-300 hover:text-rose-500 transition-colors rounded-xl"><Trash2 size={16} /></button></td>
                  </tr>
                )))} 
              </tbody></table><div className="bg-slate-50 p-2 text-[11px] font-black text-slate-400 text-center uppercase border-t tracking-widest border-slate-100 whitespace-nowrap">過濾結果：共 {dashboardResults.length} 筆案件</div></div>
              <div className="flex justify-end mt-4 pt-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 shadow-inner"><div className="space-y-3 w-64 text-right"><div className="flex justify-between text-sm font-black text-slate-600 uppercase tracking-tight whitespace-nowrap"><span className="shrink-0 mr-4">小計 (未稅)</span><span className="text-slate-700 font-mono font-black">${calculationSummary.subtotal.toLocaleString()}</span></div>{formData.repairType === '2.1' && (<div className="flex justify-between text-sm font-black text-slate-600 uppercase tracking-tight whitespace-nowrap"><span className="shrink-0 mr-4">服務費 (5%)</span><span className="font-mono font-black">${calculationSummary.serviceFee.toLocaleString()}</span></div>)}
              <div className="flex justify-between text-sm font-black text-slate-600 uppercase tracking-tight whitespace-nowrap"><span className="shrink-0 mr-4">稅金 (5%)</span><span className="text-slate-700 font-mono font-black">${calculationSummary.tax.toLocaleString()}</span></div><div className="h-px bg-slate-200 my-2"></div><div className="flex justify-between items-center text-2xl font-black text-blue-700 font-mono tracking-tighter whitespace-nowrap"><span className="text-xs text-blue-800 uppercase tracking-widest shrink-0 mr-4">總價(稅後)</span>${calculationSummary.final.toLocaleString()}</div></div></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-2 shrink-0"><h2 className="text-base font-black text-blue-800 uppercase tracking-widest whitespace-nowrap shrink-0">3. 提報</h2><div className="flex items-center gap-2 text-xs font-black text-slate-500 whitespace-nowrap shrink-0">報修日期 <input type="date" className={`px-2 py-1.5 rounded-xl border ${formData.reportDate ? HIGHLIGHT_INPUT_STYLE : EDITABLE_INPUT_STYLE} !text-xs cursor-pointer`} value={formData.reportDate} onChange={(e) => updateFormField('reportDate', e.target.value)} /></div></div>
                <div className="space-y-4">
                  <div className="space-y-1.5"><div className="flex justify-between items-center"><label className="text-xs font-black text-slate-500 uppercase whitespace-nowrap shrink-0">現場現況</label>{formData.siteDescription && (<button onClick={(e) => copyToClipboard(formData.siteDescription, e)} className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-black transition-all hover:bg-blue-100 whitespace-nowrap border border-blue-100"><Copy size={12} /> 複製</button>)}</div><AutoResizeTextarea value={formData.siteDescription} onChange={(e) => updateFormField('siteDescription', e.target.value)} className="w-full p-4 rounded-2xl bg-white" rows={3} /></div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center"><label className="text-xs font-black text-slate-500 uppercase whitespace-nowrap shrink-0">施工說明一</label>{formData.constructionDesc1 && (<button onClick={(e) => copyToClipboard(formData.constructionDesc1, e)} className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-black transition-all hover:bg-blue-100 whitespace-nowrap border border-blue-100"><Copy size={12} /> 複製</button>)}</div>
                    <AutoResizeTextarea value={formData.constructionDesc1} onChange={(e) => updateFormField('constructionDesc1', e.target.value)} className="w-full p-4 rounded-2xl bg-white" placeholder="輸入檢測結論與建議處理方式" />
                    <div className="flex justify-between items-center mt-4 mb-1"><label className="text-xs font-black text-slate-500 uppercase whitespace-nowrap shrink-0">施工說明二</label><div className="flex items-center gap-3"><QuickPhraseMenu onSelect={(p) => updateFormField('constructionDesc2', p)} type="report" />{formData.constructionDesc2 && (<button onClick={(e) => copyToClipboard(formData.constructionDesc2, e)} className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-black transition-all hover:bg-blue-100 whitespace-nowrap border border-blue-100"><Copy size={12} /> 複製</button>)}</div></div><AutoResizeTextarea value={formData.constructionDesc2} onChange={(e) => updateFormField('constructionDesc2', e.target.value)} className="w-full p-4 rounded-2xl bg-white" placeholder="說明提報所檢附之文件" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-2 shrink-0"><h2 className="text-base font-black text-emerald-800 uppercase tracking-widest whitespace-nowrap shrink-0">4. 結報</h2><div className="flex items-center gap-2 text-xs font-black text-slate-500 whitespace-nowrap shrink-0">完工日期 <input type="date" className={`px-2 py-1.5 rounded-xl border ${formData.completionDate ? HIGHLIGHT_INPUT_STYLE : EDITABLE_INPUT_STYLE} !text-xs cursor-pointer`} value={formData.completionDate} onChange={(e) => updateFormField('completionDate', e.target.value)} /></div></div>
                <div className="space-y-4">
                  <div className="space-y-1.5"><div className="flex justify-between items-center"><label className="text-xs font-black text-slate-500 uppercase whitespace-nowrap shrink-0">完工說明一</label>{formData.completionDesc1 && (<button onClick={(e) => copyToClipboard(formData.completionDesc1, e)} className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-black transition-all hover:bg-blue-100 whitespace-nowrap border border-blue-100"><Copy size={12} /> 複製</button>)}</div><AutoResizeTextarea value={formData.completionDesc1} onChange={(e) => updateFormField('completionDesc1', e.target.value)} className="w-full p-4 rounded-2xl bg-white" placeholder="修繕最終成果" />
                    <div className="flex justify-between items-center mt-4 mb-1"><label className="text-xs font-black text-slate-500 uppercase whitespace-nowrap shrink-0">完工說明二</label><div className="flex items-center gap-3"><QuickPhraseMenu onSelect={(p) => updateFormField('completionDesc2', p)} type="complete" />{formData.completionDesc2 && (<button onClick={(e) => copyToClipboard(formData.completionDesc2, e)} className="flex items-center gap-3 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-black transition-all hover:bg-blue-100 whitespace-nowrap border border-blue-100"><Copy size={12} /> 複製</button>)}</div></div><AutoResizeTextarea value={formData.completionDesc2} onChange={(e) => updateFormField('completionDesc2', e.target.value)} className="w-full p-4 rounded-2xl bg-white" placeholder="說明結報所檢附之文件" /></div>
                  <div className="pt-4 border-t-2 border-slate-50">
                    <div className="flex items-center justify-between mb-4">
                      <label className="text-xs font-black text-slate-600 uppercase tracking-widest whitespace-nowrap shrink-0">客戶滿意度調查</label>
                      {formData.satisfactionScore !== null && (
                        <div className="px-3 py-1 bg-slate-900 text-white rounded-xl text-xs font-black animate-in fade-in zoom-in-95 whitespace-nowrap">
                          得分：{formData.satisfactionScore} 分
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">{SATISFACTION_LEVELS.map((level) => { const isSelected = formData.satisfactionLevel === level.label; return (<label key={level.label} onClick={(e) => { e.preventDefault(); setFormData(prev => ({ ...prev, satisfactionLevel: isSelected ? '' : level.label, satisfactionScore: isSelected ? null : level.score })); }} className={`relative cursor-pointer transition-all p-3 rounded-2xl border flex flex-col items-center justify-center gap-2 h-20 ${isSelected ? `${level.borderColor} ${level.bgColor} ring-2 ring-offset-1` : 'border-slate-100 bg-white hover:border-slate-200 shadow-sm'}`}><input type="radio" className="sr-only" checked={isSelected} readOnly /><div className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${isSelected ? `${level.color} border-white scale-125 shadow-sm` : 'border-slate-300'}`}></div><div className={`text-[11px] font-black text-center leadership-tight ${isSelected ? level.textColor : 'text-slate-500'}`}>{String(level.label)}</div></label>); })}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
              <div className="flex items-center justify-between border-b pb-3 shrink-0 overflow-hidden"><h2 className="text-base font-black text-slate-900 uppercase tracking-widest whitespace-nowrap shrink-0 flex items-center gap-3">5. JDM 報修進度</h2></div>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-6">
                  <div className="bg-slate-50/80 p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between mb-4 border-b border-slate-200 pb-2 gap-2"><span className="text-xs font-black text-slate-500 uppercase tracking-widest whitespace-nowrap shrink-0">JDM 報修進度</span>{jdmErrors.length > 0 && (<div className="flex items-center gap-2 px-3 py-1 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 animate-in fade-in zoom-in-95 duration-200 max-w-full [word-break:break-word]"><AlertTriangle size={12} className="shrink-0" /><div className="text-[10px] font-black leading-tight">{jdmErrors[0]} {jdmErrors.length > 1 && `(等 ${jdmErrors.length} 項異常)`}</div></div>)}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">{[{l:'提報',f1:'reportDate',f2:'reportSubmitDate',c:'bg-blue-500',tc:'text-blue-600'},{l:'奉核',f1:'approvalDate',c:'bg-purple-500',tc:'text-purple-600'},{l:'結報',f1:'closeDate',f2:'closeSubmitDate',c:'bg-emerald-500',tc:'text-emerald-600'}].map((s,i)=>(<div key={i} className="space-y-3"><div className="flex items-center gap-2 mb-1"><div className={`w-2 h-2 rounded-full ${s.c}`}></div><span className={`text-sm font-black ${s.tc} whitespace-nowrap shrink-0`}>{s.l}階段</span></div><div className="space-y-3"><div className="flex flex-col min-[1400px]:flex-row min-[1400px]:items-center justify-between gap-1.5 min-[1400px]:gap-3"><label className="text-xs font-black text-slate-600 shrink-0 min-[1400px]:w-12 whitespace-nowrap">{s.l}日</label><input type="date" className={`px-2 py-1.5 rounded-xl text-xs flex-1 border transition-all cursor-pointer hover:bg-slate-50 active:scale-[0.98] ${getJdmFieldError(s.f1) ? 'ring-2 ring-rose-500/50 border-rose-500 bg-rose-50/30' : EDITABLE_INPUT_STYLE} !px-2`} value={formData.jdmControl[s.f1]} onChange={(e) => updateJdmField(s.f1, e.target.value)} /></div>{s.f2 && (<div className="flex flex-col min-[1400px]:flex-row min-[1400px]:items-center justify-between gap-1.5 min-[1400px]:gap-3"><label className="text-xs font-black text-slate-600 shrink-0 min-[1400px]:w-12 whitespace-nowrap">送件日</label><input type="date" className={`px-2 py-1.5 rounded-xl text-xs flex-1 border transition-all cursor-pointer hover:bg-slate-50 active:scale-[0.98] ${getJdmFieldError(s.f2) ? 'ring-2 ring-rose-500/50 border-rose-500 bg-rose-50/30' : EDITABLE_INPUT_STYLE} !px-2`} value={formData.jdmControl[s.f2]} onChange={(e) => updateJdmField(s.f2, e.target.value)} /></div>)}</div></div>))}</div>
                  </div>
                  <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm"><div className="flex items-center justify-between mb-4 gap-2"><span className="text-xs font-black text-slate-500 uppercase tracking-widest whitespace-nowrap shrink-0">待補資料</span><div className={`px-3 py-1 rounded-xl text-[10px] font-black whitespace-nowrap shrink-0 ${(formData.jdmControl.checklist || []).length > 0 ? 'bg-orange-50 text-orange-600 animate-pulse border border-orange-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>待補資料 {(formData.jdmControl.checklist || []).length} 項</div></div><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{JDM_CHECKLIST_ITEMS.map((it) => { const is = (formData.jdmControl.checklist || []).includes(it.id); return (<button key={it.id} onClick={() => toggleJdmCheckItem(it.id)} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${is ? 'bg-orange-50 border-orange-200 text-orange-700 shadow-sm' : 'bg-slate-50/50 border-slate-100 text-slate-500 hover:border-slate-700'}`}><div className={`w-4.5 h-4.5 rounded flex items-center justify-center transition-all shrink-0 ${is ? 'bg-orange-500 text-white' : 'bg-white border'}`}>{is && <AlertCircle size={12} />}</div><span className="text-sm font-black whitespace-nowrap truncate">{String(it.label)}</span></button>); })}</div></div>
                </div>
                <div className="lg:col-span-4 bg-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-6">
                  <div><label className="text-xs font-black text-slate-400 uppercase flex items-center gap-3 tracking-widest whitespace-nowrap shrink-0"><Hash size={14} className="text-blue-400" /> JDM 系統案號</label><input type="text" className={`w-full px-4 py-2.5 text-sm rounded-xl bg-slate-800 text-white mt-1.5 outline-none focus:border-blue-500 font-mono font-black transition-all border ${getJdmFieldError('caseNumber') ? 'ring-2 ring-rose-500 border-rose-500' : 'border-slate-700'}`} value={formData.jdmControl.caseNumber} onChange={(e) => updateJdmField('caseNumber', e.target.value)} /></div>
                  <div className="space-y-3"><label className="text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap shrink-0">目前狀態</label><div className="grid grid-cols-2 gap-3">{['提報', '結報', '抽換', '退件'].map((s) => { const is = formData.jdmControl.status === s; return (<label key={s} onClick={(e) => { e.preventDefault(); handleStatusClick(s); }} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${is ? 'border-blue-500 bg-blue-500/10 text-blue-400 shadow-lg' : 'border-slate-800 bg-slate-800/50 text-slate-500 hover:border-slate-700'}`}><input type="radio" className="sr-only" checked={is} readOnly /><div className={`w-2.5 h-2.5 rounded-full shrink-0 ${is ? 'bg-blue-500 animate-pulse' : 'bg-slate-700'}`}></div><span className="text-sm font-black whitespace-nowrap">{String(s)}</span></label>); })}</div></div>
                  <div className="space-y-3"><div className="flex justify-between items-center"><label className="text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap shrink-0">案件備註</label>{(['退件', '抽換'].includes(formData.jdmControl.status) || jdmErrors.length > 0) && (<div className="px-2 py-0.5 bg-rose-500/20 text-rose-400 text-[10px] font-black rounded border border-rose-500/30 animate-pulse uppercase whitespace-nowrap shrink-0">{jdmErrors.length > 0 ? "資料異常必填" : "變更原因必填"}</div>)}
                  </div><div className="relative"><AutoResizeTextarea value={formData.jdmControl.remarks} onChange={(e) => updateJdmField('remarks', e.target.value)} className={`w-full p-4 rounded-2xl text-sm bg-slate-800 border-slate-700 text-white transition-all focus:border-blue-400 ${(['退件', '抽換'].includes(formData.jdmControl.status) || jdmErrors.length > 0) && !formData.jdmControl.remarks.trim() ? 'ring-2 ring-rose-500/50 border-rose-500' : ''}`} placeholder={(jdmErrors.length > 0 || ['退件', '抽換'].includes(formData.jdmControl.status)) ? "請說明異常或變更原因 (必填)" : "請輸入案件備註 或退補原因"} /></div></div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col gap-5">
              <div className="flex flex-col xl:flex-row gap-4 items-stretch xl:items-center">
                <div className="flex-1 relative min-w-0"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input type="text" placeholder="搜尋門牌、承租人、案號、項目或標題..." className={`w-full pl-12 pr-6 py-3.5 rounded-2xl border font-bold text-sm ${EDITABLE_INPUT_STYLE}`} value={dashboardFilter.search} onChange={(e) => setDashboardFilter({...dashboardFilter, search: e.target.value})} /></div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                  <div className="relative shrink-0" ref={stationDropdownRef}>
                    <button onClick={() => setIsStationDropdownOpen(!isStationDropdownOpen)} className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-black text-sm border bg-white min-w-[140px] sm:min-w-[160px] transition-all hover:border-blue-400 shadow-sm ${dashboardFilter.stations.length > 0 ? 'border-blue-500 text-blue-600 bg-blue-50/30' : 'border-slate-300 text-slate-700'}`}><Building2 size={16} className="shrink-0" /><span className="flex-1 text-left whitespace-nowrap truncate">{dashboardFilter.stations.length === 0 ? '所有站點' : dashboardFilter.stations.length === 1 ? `${String(dashboardFilter.stations[0])}` : `已選 ${dashboardFilter.stations.length}`}</span><ChevronDown size={14} className={`transition-transform duration-200 shrink-0 ${isStationDropdownOpen ? 'rotate-180' : ''}`} /></button>
                    {isStationDropdownOpen && (<div className="absolute left-0 mt-2 w-72 bg-white border border-slate-200 rounded-[20px] shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-100 p-3"><div className="flex items-center justify-between p-2 border-b mb-2"><span className="text-xs font-black text-slate-500 uppercase tracking-widest whitespace-nowrap shrink-0">站點篩選</span><div className="flex gap-3"><button onClick={() => setDashboardFilter({...dashboardFilter, stations: availableStations})} className="text-xs font-black text-blue-600 hover:underline whitespace-nowrap">全選</button><button onClick={() => setDashboardFilter({...dashboardFilter, stations: []})} className="text-xs font-black text-slate-500 hover:underline whitespace-nowrap">清除</button></div></div><div className="max-h-80 overflow-y-auto space-y-1 custom-scrollbar">{availableStations.map(st => { const isChecked = dashboardFilter.stations.includes(st); return (<button key={st} onClick={() => { const s = dashboardFilter.stations.includes(st) ? dashboardFilter.stations.filter(x=>x!==st) : [...dashboardFilter.stations, st]; setDashboardFilter({...dashboardFilter, stations: s}); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${isChecked ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}><div className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-all shrink-0 ${isChecked ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>{isChecked && <Check size={12} className="text-white" strokeWidth={4} />}</div><span className="truncate text-left flex-1 text-xs">{String(st)}</span></button>); })}</div></div>)}
                  </div>
                  <div className="relative group shrink-0"><div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Filter size={16} /></div><select className={`pl-10 pr-6 py-3 rounded-2xl font-black text-sm border min-w-[160px] sm:min-w-[200px] ${EDITABLE_INPUT_STYLE}`} value={dashboardFilter.status} onChange={(e) => setDashboardFilter({...dashboardFilter, status: e.target.value})}>
<option>未完成案件</option><option>全部</option><option disabled className="bg-slate-100 text-slate-400">───── 常規狀態 ─────</option><option>待提報</option><option>提報</option><option>抽換</option><option>退件</option><option>結報</option></select></div>
                  <div className="relative shrink-0" ref={specialSearchRef}>
                    <button onClick={() => setIsSpecialSearchOpen(!isSpecialSearchOpen)} className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-black text-sm border transition-all hover:bg-slate-50 shadow-sm ${dashboardFilter.reportMonth || dashboardFilter.closeMonth || dashboardFilter.specialFormula ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-300 text-slate-700'}`}><Settings2 size={16} /> 特殊搜尋</button>
                    {isSpecialSearchOpen && (
                      <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-[28px] shadow-2xl z-[110] animate-in fade-in zoom-in-95 duration-200 p-6 space-y-6">
                        <div className="flex items-center justify-between border-b pb-3"><span className="text-xs font-black text-slate-500 uppercase tracking-widest">月份篩選設定</span><button onClick={() => setDashboardFilter({...dashboardFilter, reportMonth: '', closeMonth: '', specialFormula: ''})} className="text-[10px] font-black text-blue-600 hover:underline">清空條件</button></div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5"><Calendar size={10}/> JDM提報月份</label><input type="month" className={`w-full ${EDITABLE_INPUT_STYLE} !px-2 !py-2 !text-[11px] rounded-xl`} value={dashboardFilter.reportMonth} onChange={(e) => setDashboardFilter({...dashboardFilter, reportMonth: e.target.value})} /></div>
                          <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5"><CheckCircle size={10}/> JDM結報月份</label><input type="month" className={`w-full ${EDITABLE_INPUT_STYLE} !px-2 !py-2 !text-[11px] rounded-xl`} value={dashboardFilter.closeMonth} onChange={(e) => setDashboardFilter({...dashboardFilter, closeMonth: e.target.value})} /></div>
                        </div>
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between"><span className="text-xs font-black text-slate-500 uppercase tracking-widest">快速篩選公式</span>{dashboardFilter.specialFormula && <button onClick={()=>setDashboardFilter({...dashboardFilter, specialFormula: ''})} className="text-[10px] font-black text-slate-300 hover:text-rose-500">清除公式</button>}</div>
                          <div className="grid grid-cols-2 gap-2">
                            {['本期已完工', '前期已完工', '本期待追蹤', '前期待追蹤'].map(f => (
                              <button key={f} onClick={() => { if (!dashboardFilter.reportMonth || !dashboardFilter.closeMonth) { showMessage("請先選擇提報月份與結報月份", "error"); return; } setDashboardFilter({...dashboardFilter, specialFormula: dashboardFilter.specialFormula === f ? '' : f}); }} className={`px-3 py-2.5 text-[11px] font-black rounded-xl border transition-all text-center leading-tight ${dashboardFilter.specialFormula === f ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-300'}`}>{String(f)}</button>
                            ))}
                            <button onClick={() => { if (!dashboardFilter.reportMonth || !dashboardFilter.closeMonth) { showMessage("請先選擇提報月份與結報月份", "error"); return; } setDashboardFilter({...dashboardFilter, specialFormula: dashboardFilter.specialFormula === '約內已完工' ? '' : '約內已完工'}); }} className={`px-3 py-2.5 text-[11px] font-black rounded-xl border transition-all text-center leading-tight ${dashboardFilter.specialFormula === '約內已完工' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-300'}`}>約內已完工</button>
                            <button onClick={() => { if (!dashboardFilter.reportMonth || !dashboardFilter.closeMonth) { showMessage("請先選擇提報月份與結報月份", "error"); return; } setDashboardFilter({...dashboardFilter, specialFormula: dashboardFilter.specialFormula === '內控管理' ? '' : '內控管理'}); }} className={`px-3 py-2.5 text-[11px] font-black rounded-xl border transition-all text-center leading-tight ${dashboardFilter.specialFormula === '內控管理' ? 'bg-amber-600 text-white border-amber-600 shadow-md' : 'bg-amber-50 text-amber-700 border-amber-100 hover:border-amber-300'}`}>內控管理</button>
                          </div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100"><p className="text-[10px] text-slate-500 font-bold text-center leading-relaxed">過濾結果：共 {dashboardResults.length} 筆案件</p></div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center xl:ml-auto shrink-0 group">
                    <div className="flex flex-col items-center gap-1 mr-3 border-r pr-3">
                      <label className={`flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-xl cursor-pointer hover:bg-slate-700 transition font-black text-xs shadow-lg ${importStatus.isProcessingC ? 'opacity-50 pointer-events-none' : ''}`}> 
                        {importStatus.isProcessingC ? <Loader2 size={14} className="animate-spin" /> : <History size={14} />} 匯入歷史案件
                        <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={(e) => handleFileUpload('C', e)} disabled={importStatus.isProcessingC} />
                      </label>
                    </div>
                    <div className="relative shrink-0"><div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><FileText size={14} /></div><select className="pl-9 pr-6 py-3 rounded-l-2xl font-black text-sm border border-emerald-200 border-r-0 bg-emerald-50/30 text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-100 transition-all min-w-[140px] sm:min-w-[150px] appearance-none" value={exportMode} onChange={(e) => setExportMode(e.target.value)}><option value="待追蹤事項">待追蹤事項</option><option value="工作提報單">工作提報單</option><option value="滿意度調查">滿意度調查</option><option value="內控管理">內控管理</option></select><div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-400"><ChevronDown size={14} /></div></div><button onClick={handleExportExcel} className="flex items-center gap-2 px-6 py-3 rounded-r-2xl font-black text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-lg active:scale-95 whitespace-nowrap border border-emerald-600 border-l-emerald-500/30"><Download size={16} /> 匯出</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[450px] flex flex-col">
              {queryError ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-rose-50 text-rose-700">
                    <AlertCircle size={48} />
                    <h3 className="text-xl font-black mt-4">資料庫查詢失敗</h3>
                    <p className="mt-2 font-bold max-w-lg">{queryError}</p>
                </div>
              ) : !hasActivatedDashboard ? (
                <div className="flex-1 flex flex-col items-center justify-center p-20 text-center space-y-6"><Search size={64} className="text-slate-100" /><div className="space-y-2"><h3 className="text-xl font-black text-slate-900 whitespace-nowrap">請執行搜尋或選擇過濾條件</h3><p className="text-sm text-slate-500 font-bold max-w-sm mx-auto">選取狀態、站點、月份或關鍵字後，系統將調閱資料</p></div></div>
              ) : (
                <div className="overflow-x-auto custom-scrollbar"><table className="w-full text-left border-collapse table-fixed min-w-[1200px]"><thead className="bg-slate-50 border-b border-slate-100"><tr><th className="w-28 p-2 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap text-center">進度狀態</th><th className="w-28 p-2 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap text-center">提報日期</th><th className="w-40 p-2 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">案號 / 站點</th><th className="w-60 p-2 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">承租人 / 門牌</th><th className="w-52 p-2 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">維修概述</th><th className="w-28 p-2 text-[11px] font-black text-slate-500 uppercase tracking-widest text-right whitespace-nowrap">費用合計</th><th className="w-auto p-2 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">待補資料詳情</th><th className="w-28 p-2 text-[11px] font-black text-slate-500 uppercase tracking-widest text-center whitespace-nowrap">操作</th></tr></thead><tbody className="divide-y divide-slate-100">{dashboardResults.length === 0 ? (<tr><td colSpan="8" className="p-32 text-center text-slate-300 font-black italic text-base">查無符合目前條件之案件</td></tr>) : (dashboardResults.slice(0, displayLimit).map((it) => (<MemoizedRepairRow key={it.id} item={it} onEdit={handleEditCaseInternal} onDelete={handleDeleteTrigger} />)))}</tbody></table>
                  {dashboardResults.length > displayLimit && (
                    <div className="p-4 text-center border-t border-slate-100">
                      <button 
                        onClick={() => setDisplayLimit(prev => prev + 100)}
                        className="px-6 py-3 bg-slate-100 text-slate-700 font-black text-sm rounded-xl hover:bg-slate-200 transition-all"
                      >
                        顯示更多 (目前 {displayLimit} / {dashboardResults.length})
                      </button>
                    </div>
                  )}
                <div className="bg-slate-50 p-2 text-[11px] font-black text-slate-400 text-center uppercase border-t tracking-widest border-slate-100 whitespace-nowrap">過濾結果：共 {dashboardResults.length} 筆案件</div></div>
              )}
            </div>
          </div>
        )}
      </div>

      {copyTip.show && (<div className="fixed z-[99999] pointer-events-none px-3 py-1.5 bg-slate-900 text-white text-xs font-black rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-150" style={{ left: copyTip.x, top: copyTip.y - 30, transform: 'translateX(-50%)' }}><CheckCircle size={12} className="text-emerald-400" /> 已複製到剪貼簿！</div>)}
      
      {message.text && (
        <div className={`fixed top-12 left-1/2 -translate-x-1/2 z-[110000] flex items-center gap-3 px-8 py-5 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border-2 animate-in slide-in-from-top-10 duration-500 ${message.type === 'success' ? 'bg-white border-emerald-500 text-emerald-800' : 'bg-white border-rose-500 text-rose-800'}`}>
          {message.type === 'success' ? <CheckCircle size={24} className="text-emerald-500" /> : <AlertCircle size={24} className="text-rose-500" />}
          <span className="font-black text-base whitespace-nowrap">{String(message.text)}</span>
        </div>
      )}
    </div>
  );
};

export default App;
