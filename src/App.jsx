import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithCustomToken, 
  signInWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  onSnapshot, 
  query, 
  addDoc, 
  serverTimestamp, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
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
  History,
  Lock,
  Mail,
  Eye,
  EyeOff,
  LogOut
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
 * Firebase 初始化配置
 */
const getFirebaseConfig = () => {
  // 1. 優先嘗試讀取 Google 開發環境注入的配置
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    return JSON.parse(__firebase_config);
  }
  // 2. 次之讀取 Vercel 或本地環境變數
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
// 防呆初始化：如果 config 是空的，app 會是 undefined
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
    isSubLease: false, // 標記是否為包租契約
    repairItems: [],
    costItems: [{ id: generateUUID(), contractor: '', workTask: '', invoiceNumber: '', billingDate: '', costAmount: '', voucherNumber: '', remarks: '' }],
    incomeItems: [{ id: generateUUID(), source: '晟晁', receiptNumber: '', receiveDate: '', subtotal: 0, serviceFee: 0, tax: 0, incomeAmount: 0, incomeVoucherNumber: '', remarks: '' }],
    quoteTitle: '', 
    siteDescription: '收到承租人報修，請我方派員查看。', 
    constructionDesc1: '經廠商檢測，。', // 預設文字
    constructionDesc2: '',
    completionDate: '', 
    completionDesc1: '廠商將OOO更新，測試功能正常，完成修繕。', // 預設文字
    completionDesc2: '', 
    totalAmount: 0, 
    satisfactionLevel: '', 
    satisfactionScore: null,
    jdmControl: { caseNumber: '', reportDate: '', reportSubmitDate: '', approvalDate: '', closeDate: '', closeSubmitDate: '', checklist: [], status: '', remarks: '' }
  };
}

const EDITABLE_INPUT_STYLE = "border-slate-300 bg-white hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm outline-none font-bold text-sm px-4 py-2.5";
const HIGHLIGHT_INPUT_STYLE = "bg-amber-50 border-amber-400 text-amber-900 shadow-inner focus:ring-2 focus:ring-amber-200 transition-all outline-none font-black text-sm px-4 py-2.5";
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
  const checklist = Array.isArray(item.jdmControl?.checklist) ? [...item.jdmControl.checklist] : [];
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

// --- 主應用組件 ---

const App = () => {
  // 1. State Definitions
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
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

  // 登入狀態與診斷
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginErrorDetail, setLoginErrorDetail] = useState('');

  const [importStatus, setImportStatus] = useState({
    isProcessingA: false,
    isProcessingB: false,
    isProcessingC: false,
    fileNameA: '',
    hasImportedB: false
  });

  const [isManualMode, setIsManualMode] = useState(false);

  // 完整的 Dashboard 篩選器狀態 (100% 還原)
  const [dashboardFilter, setDashboardFilter] = useState({ 
    search: '', 
    status: '全部', 
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
      { key: 'reportSubmitDate', label: '送件日' }, // 更名：提報送件日 -> 送件日
      { key: 'approvalDate', label: '奉核日' },
      { key: 'closeDate', label: '結報日' },
      { key: 'closeSubmitDate', label: '送件日' } // 更名：結報送件日 -> 送件日
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
    if (dashboardFilter.stations.length > 0) filtered = filtered.filter(c => dashboardFilter.stations.includes(c.station));
    if (dashboardFilter.status !== '全部') {
      if (dashboardFilter.status === '待提報') filtered = filtered.filter(c => !c.jdmControl?.status);
      else if (dashboardFilter.status === '未完成案件 (全部)') filtered = filtered.filter(c => c.jdmControl?.status !== '結報');
      else filtered = filtered.filter(c => c.jdmControl?.status === dashboardFilter.status);
    }
    
    // 特殊公式篩選邏輯 (100% 還原)
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
    
    // 自動化檢核邏輯
    if (targetStatus === '提報') {
      setStatusConfirm({ show: true, target: targetStatus, message: `變更為提報後，系統將自動從待補清單移除「維修前照片」與「報價單」。` });
    } else if (targetStatus === '結報') {
      setStatusConfirm({ show: true, target: targetStatus, message: `變更為結報後，系統將自動清空所有待補資料項。` });
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

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) { showMessage("請輸入帳號與密碼", "error"); return; }
    setIsLoggingIn(true);
    setLoginErrorDetail(''); 
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      showMessage("登入成功", "success");
    } catch (err) {
      setLoginErrorDetail(err.code);
      let msg = "登入失敗";
      if (err.code === 'auth/unauthorized-domain') msg = "網域未授權";
      else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') msg = "帳號或密碼錯誤";
      showMessage(msg, "error");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const getLoginErrorMessage = (code) => {
    switch (code) {
      case 'auth/unauthorized-domain': return '偵測到未經授權的來源網域。請前往 Firebase Console > Auth > Settings 將 Vercel 網址加入「授權網域」白名單中。';
      case 'auth/operation-not-allowed': return 'Firebase 尚未開啟 Email 登入功能。請在設定中啟用 Email/Password 登入方法。';
      case 'auth/user-not-found': return '帳號不存在，請確認 Email 是否正確。';
      case 'auth/wrong-password': return '密碼錯誤，請重新輸入。';
      case 'auth/invalid-credential': return '憑證無效，請檢查帳號密碼。';
      case 'auth/too-many-requests': return '嘗試次數過多，系統已暫時鎖定該帳號。請稍後再試。';
      case 'auth/network-request-failed': return '網路連線異常，請檢查連線狀態。';
      default: return '發生未知的驗證錯誤，請檢查系統配置。';
    }
  };

  const handleLogout = async () => {
    try { await signOut(auth); setFormData(getInitialFormState()); setCurrentDocId(null); showMessage("已登出系統", "success"); } catch (e) {}
  };

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
                headers.forEach((h, i) => { if (h) obj[String(h).trim()] = r[i] === undefined ? '' : r[i]; });
                all.push(obj);
              });
            }
          });
          setFlattenedAddressData(all); setSheetNames(wb.SheetNames);
          if (user && db) {
             const chunks = chunkArray(all, 500);
             await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'address_master'), { chunkCount: chunks.length, sheets: wb.SheetNames, updatedAt: serverTimestamp() });
             await Promise.all(chunks.map((chunk, i) => setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', `address_master_chunk_${i}`), { list: chunk })));
          }
          setImportStatus(prev => ({ ...prev, isProcessingA: false, fileNameA: file.name }));
        } else if (type === 'B') {
          const parsedB = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }).slice(4).map(r => ({ id: String(r[1] || '').trim(), name: String(r[2] || '').trim(), unit: '式', price: Number(r[6]) || 0 })).filter(i => i.name);
          setFileBData(parsedB);
          if (user && db) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'price_master'), { list: parsedB, updatedAt: serverTimestamp() });
          setImportStatus(prev => ({ ...prev, isProcessingB: false, hasImportedB: true }));
        } else if (type === 'C') {
          const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
          // 日期解析引擎
          const cleanDate = (val) => {
            if (!val) return { date: '', note: '' };
            let s = String(val).trim();
            if (/^\d{5}(\.\d+)?$/.test(s)) {
              const dO = window.XLSX.SSF.parse_date_code(Number(s));
              return { date: `${String(dO.y).padStart(4,'0')}-${String(dO.m).padStart(2,'0')}-${String(dO.d).padStart(2,'0')}`, note: '' };
            }
            const match = s.match(/(\d{2,4})[-/.](\d{1,2})[-/.](\d{1,2})/);
            if (match) {
              let y = parseInt(match[1]);
              if (match[1].length === 3 || y < 111) y += 1911; else if (match[1].length === 2) y += 2000;
              return { date: `${String(y).padStart(4,'0')}-${String(match[2]).padStart(2,'0')}-${String(match[3]).padStart(2,'0')}`, note: s.replace(match[0], '').trim() };
            }
            return { date: '', note: s };
          };

          const cases = rows.map(r => {
            const sr = {}; Object.keys(r).forEach(k => sr[String(k).replace(/[\n\r\s\u00A0\u3000]+/g, '')] = r[k]);
            const caseNoteList = [];
            const dates = {};
            [{k:'JDM提報日期',l:'提報'},{k:'提報送件日期',l:'送件'},{k:'奉核日',l:'奉核'},{k:'結報日期',l:'結報'},{k:'結報送件日期',l:'送件'},{k:'收入發票日期',l:'發票日'}].forEach(f => {
               const {date, note} = cleanDate(sr[f.k] || sr[f.k.replace('JDM','')]);
               dates[f.k] = date; if (note) caseNoteList.push(`${f.l}: ${note}`);
            });
            // 廠商與金額邏輯
            let billingV = String(sr['請款廠商']||'').trim(); let incVoucher = '';
            if (billingV.includes('晟晁')) { const m = billingV.match(/\d+/); if(m){ incVoucher=m[0]; billingV='晟晁'; } }
            let costV = String(sr['維修廠商']||'').trim(); 
            let costAmt = Number(sr['費用金額'])||0; 
            const incAmt = Number(sr['收入金額(稅後)'])||0;
            if(!billingV.includes('晟晁') && !costV && billingV!==''){ costV=billingV; costAmt=incAmt; }
            let costVoucher = ''; const cM = costV.match(/\d+/);
            if(cM){ costVoucher=cM[0]; costV=costV.replace(cM[0],'').replace(/\s+/g,' ').trim(); }
            const preTax = Math.round(incAmt/1.05);

            // 滿意度
            let sL='', sS=null;
            ['非常滿意','滿意','尚可','需改進','不滿意'].forEach(l=>{ if(sr[l]!==undefined&&sr[l]!==null&&sr[l]!==''){ sL=l==='尚可'?'普通':l==='需改進'?'尚須改進':l; sS=Number(sr[l]); }});

            return {
              ...getInitialFormState(),
              station: String(sr['站點']||'').trim(), address: String(sr['建物門牌地址']||'').trim(),
              tenant: String(sr['承租人']||'').trim(), phone: String(sr['聯絡電話']||'').trim(),
              repairType: String(sr['契約內/外']||'').includes('外')?'2.2':'2.1',
              quoteTitle: String(sr['報價單標題']||'').trim(), siteDescription: String(sr['現場狀況']||'').trim(),
              totalAmount: incAmt, satisfactionLevel: sL, satisfactionScore: sS,
              isSubLease: ['備註','欄1','欄2'].some(k=>String(sr[k]||'').includes('包租')),
              jdmControl: {
                caseNumber: String(sr['JDM系統案號']||'').trim(), reportDate: dates['JDM提報日期'],
                reportSubmitDate: dates['提報送件日期'], approvalDate: dates['奉核日'],
                closeDate: dates['結報日期'], closeSubmitDate: dates['結報送件日期'],
                status: dates['結報日期']?'結報':dates['JDM提報日期']?'提報':'',
                remarks: caseNoteList.join('; '), checklist: []
              },
              costItems: [{ id: generateUUID(), contractor: costV, costAmount: costAmt, voucherNumber: costVoucher, remarks: String(sr['費用備註']||'').trim(), billingDate: '', workTask: String(sr['報價單標題']||'').trim(), invoiceNumber: '' }],
              incomeItems: [{ id: generateUUID(), source: billingV, incomeAmount: incAmt, incomeVoucherNumber: incVoucher, receiveDate: dates['收入發票日期']||'', receiptNumber: String(sr['收入發票號碼']||'').trim(), remarks: '' }],
              repairItems: [{ uid: generateUUID(), name: String(sr['報價單標題']||'').trim(), price: preTax, quantity: 1, unit: '式', isManual: true }],
              updatedAt: serverTimestamp(), createdBy: user?.uid || 'system'
            };
          });

          if (user && db) await Promise.all(cases.map(data => addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'repair_cases'), data)));
          setImportStatus(prev => ({ ...prev, isProcessingC: false }));
          showMessage(`成功匯入 ${cases.length} 筆案件`, 'success');
        }
      } catch (err) { setImportStatus(prev => ({ ...prev, isProcessingA: false, isProcessingB: false, isProcessingC: false })); showMessage("匯入失敗", "error"); }
    };
    reader.readAsBinaryString(file); e.target.value = '';
  };

  const handleSaveToCloud = async () => {
    if (!user || !db) return;
    
    // 恢復「抽換」與「退件」必填備註邏輯
    const status = formData.jdmControl.status;
    if ((status === '抽換' || status === '退件') && !formData.jdmControl.remarks.trim()) {
      showMessage(`狀態為「${status}」時，必須填寫案件備註以記錄原因。`, "error");
      return;
    }
    
    setIsSaving(true);
    try {
      const data = { ...formData, totalAmount: calculationSummary.final, updatedAt: serverTimestamp(), createdBy: user.uid };
      if (currentDocId) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'repair_cases', currentDocId), data);
      else { const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'repair_cases'), data); setCurrentDocId(docRef.id); }
      showMessage("案件儲存成功", "success");
    } catch (e) { showMessage("儲存失敗", "error"); } finally { setIsSaving(false); }
  };

  const handleExportExcel = () => {
    if (!window.XLSX) return;
    const fmt = (d) => String(d||'').replace(/-/g,'/');
    const exportData = dashboardResults.map((item, index) => {
       const combinedDesc = `${String(item.siteDescription || '').trim()} ${String(item.constructionDesc1 || '').trim()}`.trim();
       if (exportMode === '待追蹤事項') return { "項次": index + 1, "案號": String(item.jdmControl?.caseNumber || ''), "站別": String(item.station || ''), "地址": String(item.address || ''), "報修日期": fmt(item.jdmControl?.reportDate), "故障問題描述": combinedDesc };
       else if (exportMode === '工作提報單') return { "案號": String(item.jdmControl?.caseNumber || ''), "站別": String(item.station || ''), "地址": String(item.address || ''), "故障描述": combinedDesc, "報修日": fmt(item.jdmControl?.reportDate), "完工日": fmt(item.jdmControl?.closeDate) };
       else if (exportMode === '滿意度調查') return { "JDM系統案號": String(item.jdmControl?.caseNumber || ''), "捷運站點": String(item.station || ''), "門牌": String(item.address || ''), "施工說明": combinedDesc, "滿意度分級": String(item.satisfactionLevel || '--'), "滿意度分數": item.satisfactionScore, "類別": item.repairType === '2.1' ? "契約內" : "契約外" };
       else if (exportMode === '內控管理') {
          // 內控邏輯 (100% 還原)
          const totalCost = (item.costItems || []).reduce((sum, ci) => sum + (Number(ci.costAmount) || 0), 0);
          const costVendor = (item.costItems || []).map(ci => ci.contractor).join(', ');
          const costInv = (item.costItems || []).map(ci => ci.invoiceNumber).join(', ');
          const totalInc = (item.incomeItems || []).reduce((sum, ii) => sum + (Number(ii.incomeAmount) || 0), 0);
          const incSource = (item.incomeItems || []).map(ii => ii.source).join(', ');
          const incInv = (item.incomeItems || []).map(ii => ii.receiptNumber).join(', ');
          return { "案號": String(item.jdmControl?.caseNumber || ''), "地址": String(item.address || ''), "費用合計": totalCost, "維修廠商": costVendor, "費用發票": costInv, "收入合計": totalInc, "請款廠商": incSource, "收入發票": incInv };
       }
       return null;
    }).filter(Boolean);
    const ws = window.XLSX.utils.json_to_sheet(exportData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, exportMode);
    window.XLSX.writeFile(wb, `${exportMode}_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const executeReset = () => { setFormData(getInitialFormState()); setCurrentDocId(null); setIsResetModalOpen(false); setIsManualMode(false); setActiveView('editor'); window.scrollTo({ top: 0, behavior: 'smooth' }); showMessage("已重設案件", "success"); };
  const handleResetClick = () => (currentDocId || isFormDirty) ? setIsResetModalOpen(true) : executeReset();

  const handleEditCaseInternal = useCallback((item) => {
    const sanitizedCase = { 
      ...item, 
      costItems: (item.costItems || []).map(ci => ({ ...ci, voucherNumber: ci.voucherNumber || '', remarks: ci.remarks || '' })),
      incomeItems: (item.incomeItems || []).map(ii => ({ ...ii, incomeVoucherNumber: ii.incomeVoucherNumber || '', remarks: ii.remarks || '' }))
    };
    setFormData({ ...getInitialFormState(), ...sanitizedCase });
    setCurrentDocId(item.id); setActiveView('editor'); window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleDeleteTrigger = useCallback((id) => { setPendingDeleteId(id); setIsDeleteModalOpen(true); }, []);
  const executeDelete = async () => {
    if (!pendingDeleteId || !db) return;
    try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'repair_cases', pendingDeleteId)); if (pendingDeleteId === currentDocId) executeReset(); showMessage("案件已刪除", "success"); } 
    catch (e) { showMessage("刪除失敗", "error"); } finally { setIsDeleteModalOpen(false); setPendingDeleteId(null); }
  };

  useEffect(() => {
    if (!document.querySelector('meta[name="robots"]')) {
      const meta = document.createElement('meta'); meta.name = 'robots'; meta.content = 'noindex'; document.head.appendChild(meta);
    }
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; script.async = true;
    script.onload = () => setIsXlsxLoaded(true); document.body.appendChild(script);
    
    // 白屏修復：確保 auth 存在才監聽 (Resilience)
    if (auth) {
        const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setIsAuthReady(true); });
        return () => unsub();
    } else {
        setConfigError(true);
        setIsAuthReady(true);
    }
  }, []);

  // --- 登入畫面 ---
  if (!isAuthReady) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={48} /></div>;
  
  // 錯誤畫面：如果環境變數缺失 (白屏防護)
  if (configError) return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full p-8 bg-white/10 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl">
              <AlertTriangle className="text-rose-500 mx-auto mb-4" size={48} />
              <h1 className="text-2xl font-black text-white mb-2">系統配置錯誤</h1>
              <p className="text-slate-400 text-sm font-bold">無法讀取 Firebase 環境變數。請檢查 Vercel 後台設定是否正確。</p>
          </div>
      </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 selection:bg-blue-500 selection:text-white">
      <div className="max-w-md w-full animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center mb-8">
          <div className="inline-flex p-4 bg-blue-600 rounded-3xl shadow-2xl mb-4"><Database className="text-white" size={32} /></div>
          <h1 className="text-3xl font-black text-white tracking-tight">捷運修繕管理系統</h1>
          <p className="text-slate-400 mt-2 font-bold">請輸入管理員帳號登入</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">帳號 (Email)</label>
              <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input type="email" className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-white/5 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-blue-500/50" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required /></div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">密碼</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input type={showPassword ? "text" : "password"} className="w-full pl-12 pr-12 py-4 bg-slate-800/50 border border-white/5 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-blue-500/50" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </div>

            <div className="space-y-4">
               <button type="submit" disabled={isLoggingIn} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg flex items-center justify-center gap-3 transition-all hover:bg-blue-500 active:scale-95 disabled:opacity-50">
                 {isLoggingIn ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />} {isLoggingIn ? "驗證中..." : "安全登入"}
               </button>
               {loginErrorDetail && (
                 <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl animate-in slide-in-from-top-2">
                   <div className="flex gap-3">
                     <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                     <div className="space-y-1">
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">診斷代碼: {loginErrorDetail}</p>
                        <p className="text-[11px] font-bold text-rose-100 leading-relaxed">{getLoginErrorMessage(loginErrorDetail)}</p>
                     </div>
                   </div>
                 </div>
               )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-800 font-sans pb-32" onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}>
      
      {/* 側邊收支登記 (欄位100%還原) */}
      <div className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] transition-opacity ${isCostSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsCostSidebarOpen(false)}></div>
      <div className={`fixed top-0 right-0 h-full w-full md:w-[650px] bg-white z-[101] shadow-2xl flex flex-col transition-transform duration-500 ${isCostSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4"><div className="bg-rose-600 p-2.5 rounded-xl"><DollarSign size={24} /></div><h2 className="font-black text-base uppercase tracking-widest">內部收支登記</h2></div>
          <button onClick={() => setIsCostSidebarOpen(false)} className="p-2 hover:bg-slate-800 rounded-xl"><X size={24} /></button>
        </div>
        <div className="flex bg-slate-100 p-1.5 m-4 rounded-xl">
          <button onClick={() => setActiveTab('expense')} className={`flex-1 py-3 rounded-lg text-sm font-black ${activeTab === 'expense' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>費用</button>
          <button onClick={() => setActiveTab('income')} className={`flex-1 py-3 rounded-lg text-sm font-black ${activeTab === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>收入</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4 custom-scrollbar">
          {activeTab === 'expense' ? (
            <div className="space-y-4 pb-24">
              {formData.costItems.map((item, idx) => (
                <div key={item.id} className="relative bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-rose-500 rounded-l-2xl"></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400">維修廠商</label><input className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl`} value={item.contractor} onChange={(e) => { const n = [...formData.costItems]; n[idx].contractor = e.target.value; setFormData({...formData, costItems: n}); }} /></div>
                    <div className="space-y-1 relative"><label className="text-[10px] font-black text-slate-400">發票日期</label><input type="date" className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl`} value={item.billingDate} onChange={(e) => { const n = [...formData.costItems]; n[idx].billingDate = e.target.value; setFormData({...formData, costItems: n}); }} /><button onClick={() => setFormData({...formData, costItems: formData.costItems.filter(ci => ci.id !== item.id)})} className="absolute -top-1 -right-1 p-2 text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400">請款內容</label><input className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl`} value={item.workTask} onChange={(e) => { const n = [...formData.costItems]; n[idx].workTask = e.target.value; setFormData({...formData, costItems: n}); }} /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400">發票 / 收據號碼</label><input className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl`} value={item.invoiceNumber} onChange={(e) => { const n = [...formData.costItems]; n[idx].invoiceNumber = e.target.value; setFormData({...formData, costItems: n}); }} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400">費用單號碼</label><input className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl`} value={item.voucherNumber} onChange={(e) => { const n = [...formData.costItems]; n[idx].voucherNumber = e.target.value; setFormData({...formData, costItems: n}); }} /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-rose-500">費用金額(含稅)</label><input type="number" className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl font-black text-rose-600`} value={item.costAmount} onChange={(e) => { const n = [...formData.costItems]; n[idx].costAmount = e.target.value; setFormData({...formData, costItems: n}); }} /></div>
                  </div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-400">備註</label><AutoResizeTextarea className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl`} value={item.remarks} onChange={(e) => { const n = [...formData.costItems]; n[idx].remarks = e.target.value; setFormData({...formData, costItems: n}); }} /></div>
                </div>
              ))}
              <button onClick={() => setFormData({...formData, costItems: [...formData.costItems, { id: generateUUID(), contractor: '', workTask: '', invoiceNumber: '', billingDate: '', costAmount: '', voucherNumber: '', remarks: '' }]})} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold hover:border-rose-400 transition-all">+ 新增費用明細</button>
            </div>
          ) : (
            <div className="space-y-4 pb-24">
              {formData.incomeItems.map((item, idx) => (
                <div key={item.id} className="relative bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500 rounded-l-2xl"></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400">請款廠商</label><input className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl`} value={item.source} onChange={(e) => { const n = [...formData.incomeItems]; n[idx].source = e.target.value; setFormData({...formData, incomeItems: n}); }} /></div>
                    <div className="space-y-1 relative"><label className="text-[10px] font-black text-slate-400">發票日期</label><input type="date" className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl`} value={item.receiveDate} onChange={(e) => { const n = [...formData.incomeItems]; n[idx].receiveDate = e.target.value; setFormData({...formData, incomeItems: n}); }} /><button onClick={() => setFormData({...formData, incomeItems: formData.incomeItems.filter(ii => ii.id !== item.id)})} className="absolute -top-1 -right-1 p-2 text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400">契約類型</label><div className="px-3 py-2 bg-slate-50 border rounded-xl text-[10px] font-bold text-slate-500 uppercase">{formData.repairType === '2.1' ? '契約內' : '契約外'}</div></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400">發票號碼</label><input className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl`} value={item.receiptNumber} onChange={(e) => { const n = [...formData.incomeItems]; n[idx].receiptNumber = e.target.value; setFormData({...formData, receiptNumber: n}); }} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400">收入單號碼</label><input className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl`} value={item.incomeVoucherNumber} onChange={(e) => { const n = [...formData.incomeItems]; n[idx].incomeVoucherNumber = e.target.value; setFormData({...formData, incomeVoucherNumber: n}); }} /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-emerald-600">收入金額(稅後)</label><input type="number" className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl font-black text-emerald-700`} value={item.incomeAmount} onChange={(e) => { const n = [...formData.incomeItems]; n[idx].incomeAmount = e.target.value; setFormData({...formData, incomeItems: n}); }} /></div>
                  </div>
                  <div className="space-y-1"><label className="text-[10px] font-black text-slate-400">備註</label><AutoResizeTextarea className={`w-full ${SIDEBAR_INPUT_STYLE} rounded-xl`} value={item.remarks} onChange={(e) => { const n = [...formData.incomeItems]; n[idx].remarks = e.target.value; setFormData({...formData, incomeItems: n}); }} /></div>
                </div>
              ))}
              <button onClick={() => setFormData({...formData, incomeItems: [...formData.incomeItems, { id: generateUUID(), source: '晟晁', receiptNumber: '', receiveDate: '', incomeAmount: 0, incomeVoucherNumber: '', remarks: '' }]})} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold hover:border-emerald-400 transition-all">+ 新增收入細目</button>
            </div>
          )}
        </div>
        <div className="p-6 bg-white border-t flex flex-col gap-3 shrink-0 shadow-inner">
          <div className="flex justify-between border-b pb-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">本案收益預估</span>
            <span className={`text-xl font-black font-mono ${financialStats.netProfit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>${financialStats.netProfit.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{activeTab === 'expense' ? '費用合計' : '收入合計'}</span>
            <span className={`text-2xl font-black font-mono ${activeTab === 'expense' ? 'text-rose-600' : 'text-emerald-600'}`}>${(activeTab === 'expense' ? financialStats.totalCosts : financialStats.totalIncome).toLocaleString()}</span>
          </div>
          <button onClick={handleSaveToCloud} disabled={isSaving} className="w-full mt-1 bg-slate-900 text-white py-4 rounded-2xl font-black shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95">
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} 立即儲存並同步雲端
          </button>
        </div>
      </div>

      {/* 導覽與主體介面 */}
      <div className={`mx-auto mb-6 transition-all duration-300 ${activeView === 'dashboard' ? 'max-w-[1600px]' : 'max-w-5xl'}`}>
        <div className="bg-slate-900 rounded-3xl p-1.5 flex shadow-2xl shadow-slate-200 relative">
          <button onClick={() => setActiveView('editor')} className={`flex-1 py-3 px-6 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-3 ${activeView === 'editor' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-white'}`}>
            <FileText size={16} /> {currentDocId ? '編輯修繕單' : '建立新修繕單'}
          </button>
          <button onClick={() => { setActiveView('dashboard'); setHasActivatedDashboard(true); }} className={`flex-1 py-3 px-6 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-3 ${activeView === 'dashboard' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-white'}`}>
            <LayoutDashboard size={16} /> 案件管理中心
          </button>
          <button onClick={handleLogout} className="absolute -right-16 top-1/2 -translate-y-1/2 p-4 bg-slate-800 text-slate-400 rounded-2xl hover:text-rose-400 group" title="登出系統">
            <LogOut size={20} className="group-hover:rotate-180 transition-transform duration-500" />
          </button>
        </div>
      </div>

      <div className={`mx-auto space-y-6 transition-all duration-300 ${activeView === 'dashboard' ? 'max-w-[1600px]' : 'max-w-5xl'}`}>
        {activeView === 'editor' ? (
          <>
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-4 shrink-0">
                <div className={`p-3 rounded-2xl shadow-lg bg-blue-600`}><Database className="text-white" size={24} /></div>
                <div className="flex flex-col">
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">{currentDocId ? '編輯現有案件' : '建立新修繕單'}</h1>
                  <span className="text-[11px] font-black text-slate-500">已登入：{user.email}</span>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-3 w-full">
                <label className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl cursor-pointer hover:bg-indigo-100 font-bold text-sm border border-indigo-200">
                  <Upload size={14} /> 匯入代管清冊 <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => handleFileUpload('A', e)} />
                </label>
                <label className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl cursor-pointer hover:bg-emerald-100 font-bold text-sm border border-emerald-200">
                  <ClipboardList size={14} /> 匯入價目表 <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => handleFileUpload('B', e)} />
                </label>
                <div className="flex items-center gap-3 border-l pl-3 ml-1">
                   <button onClick={handleResetClick} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs"><Plus size={14} className="inline mr-1"/>新案件</button>
                   <button onClick={handleSaveToCloud} disabled={isSaving} className={`px-8 py-2 text-white rounded-xl font-black text-sm transition shadow-lg ${currentDocId ? 'bg-purple-600' : 'bg-blue-600'}`}>{isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} 儲存案件</button>
                </div>
              </div>
            </div>

            {/* 1. 報修人資料區 */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
              <h2 className="text-base font-black text-blue-700 uppercase tracking-widest border-b pb-2">1. 報修人資料</h2>
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="lg:w-1/3 space-y-4">
                  <div className="space-y-1.5"><label className="text-xs font-black text-slate-500 flex items-center gap-2"><Search size={12} /> 站點搜尋</label><input type="text" className={`w-full ${EDITABLE_INPUT_STYLE}`} value={searchSheet} onChange={(e) => setSearchSheet(e.target.value)} placeholder="站點關鍵字" /></div>
                  <div className="space-y-1.5 relative"><label className="text-xs font-black text-slate-500 flex items-center gap-2"><User size={12} /> 地址 / 承租人搜尋</label><input type="text" className={`w-full ${EDITABLE_INPUT_STYLE}`} value={searchAddress} onChange={(e) => setSearchAddress(e.target.value)} placeholder="關鍵字" />
                    {addressResults.length > 0 && (<div className="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-2xl max-h-60 overflow-y-auto">{addressResults.map(r => (<div key={r._uid} className="p-3 hover:bg-blue-50 border-b cursor-pointer text-sm font-bold" onClick={() => { setFormData({ ...formData, station: r.sourceStation, address: r['建物門牌'] || r['門牌'] || '', tenant: r['承租人'] || r['姓名'] || '', phone: r['連絡電話'] || r['聯絡電話'] || '', isSubLease: ['備註', '欄1', '欄2'].some(k => String(r[k] || '').includes('包租')) }); setSearchAddress(''); }}>{String(r['建物門牌'] || r['門牌'] || '')}</div>))}</div>)}
                  </div>
                  <button onClick={toggleManualMode} className={`w-full py-2.5 rounded-xl font-black text-xs border transition-all ${isManualMode ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-amber-600 border-amber-200'}`}>{isManualMode ? '手動模式已開啟' : '切換手動填寫'}</button>
                </div>
                <div className="lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <InfoCard icon={Building2} label="目前站點" value={formData.station} colorClass="bg-blue-50 border-blue-100 text-blue-600" onCopy={copyToClipboard} />
                   <div className="bg-emerald-50 border-emerald-100 rounded-2xl border flex flex-col divide-y divide-emerald-100 overflow-hidden shadow-sm">
                      <div className="p-4"><label className="text-xs font-black text-slate-500 block mb-1">承租人姓名 {formData.isSubLease && <span className="text-rose-600 font-black animate-pulse ml-1">(包租契約)</span>}</label>
                        {isManualMode ? <input className={`w-full ${EDITABLE_INPUT_STYLE} !py-1 rounded-lg`} value={formData.tenant} onChange={(e) => updateFormField('tenant', e.target.value)} /> : <div className="text-sm font-black text-emerald-600 truncate">{formData.tenant || '--'}</div>}
                      </div>
                      <div className="p-4"><label className="text-xs font-black text-slate-500 block mb-1">聯絡電話</label>
                        {isManualMode ? <input className={`w-full ${EDITABLE_INPUT_STYLE} !py-1 rounded-lg`} value={formData.phone} onChange={(e) => updateFormField('phone', e.target.value)} /> : <div className="text-sm font-black text-emerald-600 truncate">{formData.phone || '--'}</div>}
                      </div>
                   </div>
                   <div className="sm:col-span-2 p-4 bg-slate-50 border rounded-2xl">
                     <label className="text-xs font-black text-slate-500 block mb-1">建物門牌地址</label>
                     {isManualMode ? <AutoResizeTextarea value={formData.address} onChange={(e) => updateFormField('address', e.target.value)} className="w-full !border-none !bg-transparent font-black text-sm p-0" /> : <div className="text-sm font-black text-slate-700 leading-tight break-all">{formData.address || '--'}</div>}
                   </div>
                </div>
              </div>
            </div>

            {/* 2. 修繕項目與費用 */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
               <div className="flex justify-between items-center border-b pb-2"><h2 className="text-base font-black text-blue-800 uppercase tracking-widest">2. 修繕項目與費用</h2>
               <select className={`text-xs p-2 border rounded-xl font-black ${formData.repairItems.length > 0 ? 'bg-slate-100' : 'bg-white'}`} value={formData.repairType} onChange={(e) => updateFormField('repairType', e.target.value)} disabled={formData.repairItems.length > 0}><option value="2.1">契約內</option><option value="2.2">契約外</option></select></div>
               <div className="space-y-4">
                 <div className="space-y-1.5"><label className="text-xs font-black text-slate-500">報價單標題</label><input className={`w-full ${EDITABLE_INPUT_STYLE}`} value={formData.quoteTitle} onChange={(e) => updateFormField('quoteTitle', e.target.value)} placeholder="報價單主標題" /></div>
                 {formData.repairType === '2.1' ? (
                   <div className="relative"><input className={`w-full ${EDITABLE_INPUT_STYLE}`} value={searchB} onChange={(e) => setSearchB(e.target.value)} placeholder="搜尋價目表項次或名稱" />
                     {searchB && (<div className="absolute z-10 w-full mt-1 bg-white border rounded-xl shadow-2xl max-h-56 overflow-y-auto">{fileBData.filter(b => b.name.includes(searchB) || b.id.includes(searchB)).map((b, i) => (<div key={i} className="p-3 hover:bg-blue-50 border-b flex justify-between cursor-pointer" onClick={() => { setFormData(p => ({ ...p, repairItems: [...p.repairItems, { uid: generateUUID(), ...b, quantity: 1, isManual: false }] })); setSearchB(''); }}><div className="flex flex-col"><span className="text-xs font-mono text-slate-400">{b.id}</span><span className="text-sm font-black">{b.name}</span></div><span className="text-xs font-black text-emerald-600">${b.price.toLocaleString()}</span></div>))}</div>)}
                   </div>
                 ) : (
                   <button onClick={() => setFormData(p => ({ ...p, repairItems: [...p.repairItems, { uid: generateUUID(), id: '', name: '', unit: '式', price: '', quantity: 1, isManual: true }] }))} className="w-full py-3 border-2 border-dashed border-blue-400 rounded-2xl font-black text-sm text-blue-600 bg-blue-50/30">+ 新增自定義修繕項</button>
                 )}
               </div>
               <div className="overflow-x-auto border rounded-2xl shadow-sm"><table className="w-full text-sm border-collapse table-fixed">
                 <thead className="bg-slate-50 border-b text-xs text-slate-500 font-black"><tr><th className="p-4 w-28 text-center">項次</th><th className="p-4 text-left">項目</th><th className="p-4 w-20 text-center">單位</th><th className="p-4 w-32 text-right">單價</th><th className="p-4 w-24 text-center">數量</th><th className="p-4 w-32 text-right">小計</th><th className="p-4 w-12"></th></tr></thead>
                 <tbody className="divide-y divide-slate-100 bg-white">
                   {formData.repairItems.length === 0 ? (<tr><td colSpan="7" className="p-16 text-center text-slate-300 font-black italic">尚無修繕細項，請由上方搜尋或新增項目</td></tr>) : formData.repairItems.map((item, idx) => (
                     <tr key={item.uid} className="hover:bg-blue-50/20">
                       <td className="p-3 text-center text-slate-500 font-mono text-xs">{item.isManual ? (idx+1) : item.id}</td>
                       <td className="p-3">{item.isManual ? <input className={`w-full ${EDITABLE_INPUT_STYLE} !py-1 rounded-lg`} value={item.name} onChange={(e) => { const n = [...formData.repairItems]; n[idx].name = e.target.value; setFormData({...formData, repairItems: n}); }} /> : <div className="font-black px-2 truncate">{item.name}</div>}</td>
                       <td className="p-3 text-center"><input className="w-full text-center outline-none bg-transparent" value={item.unit} onChange={(e) => { const n = [...formData.repairItems]; n[idx].unit = e.target.value; setFormData({...formData, repairItems: n}); }} /></td>
                       <td className="p-3 text-right"><input type="number" className="w-full text-right outline-none bg-transparent font-mono" value={item.price} onChange={(e) => { const n = [...formData.repairItems]; n[idx].price = e.target.value; setFormData({...formData, repairItems: n}); }} /></td>
                       <td className="p-3 text-center"><input type="number" className="w-full text-center font-black outline-none bg-transparent" value={item.quantity} onChange={(e) => { const n = [...formData.repairItems]; n[idx].quantity = e.target.value; setFormData({...formData, repairItems: n}); }} /></td>
                       <td className="p-3 text-right font-black text-blue-600 font-mono">${((Number(item.price)||0)*(Number(item.quantity)||0)).toLocaleString()}</td>
                       <td className="p-3 text-center"><button onClick={() => setFormData({...formData, repairItems: formData.repairItems.filter((_, i) => i !== idx)})} className="text-slate-300 hover:text-rose-500"><Trash2 size={16}/></button></td>
                     </tr>
                   ))}
                 </tbody>
               </table></div>
               <div className="flex justify-end pt-4"><div className="w-64 space-y-1 text-right text-sm font-black text-slate-500">
                 <div className="flex justify-between"><span>小計 (未稅)</span><span className="font-mono">${calculationSummary.subtotal.toLocaleString()}</span></div>
                 {formData.repairType === '2.1' && <div className="flex justify-between"><span>服務費 (5%)</span><span className="font-mono">${calculationSummary.serviceFee.toLocaleString()}</span></div>}
                 <div className="flex justify-between"><span>稅金 (5%)</span><span className="font-mono">${calculationSummary.tax.toLocaleString()}</span></div>
                 <div className="h-px bg-slate-200 my-2"></div>
                 <div className="flex justify-between text-blue-700 text-xl font-mono"><span>總價(稅後)</span><span>${calculationSummary.final.toLocaleString()}</span></div>
               </div></div>
            </div>

            {/* 3. 提報 */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
              <h2 className="text-base font-black text-blue-800 border-b pb-2">3. 提報</h2>
              <div className="space-y-4">
                <div className="space-y-1.5"><div className="flex justify-between items-center"><label className="text-xs font-black text-slate-500">現場現況</label><button onClick={(e) => copyToClipboard(formData.siteDescription, e)} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black border border-blue-100 hover:bg-blue-100 transition-all">複製</button></div><AutoResizeTextarea value={formData.siteDescription} onChange={(e) => updateFormField('siteDescription', e.target.value)} className="w-full p-4 rounded-2xl bg-white" rows={3} /></div>
                <div className="space-y-1.5"><label className="text-xs font-black text-slate-500">施工說明一 (原因/方式)</label><AutoResizeTextarea value={formData.constructionDesc1} onChange={(e) => updateFormField('constructionDesc1', e.target.value)} className="w-full p-4 rounded-2xl bg-white" /></div>
                <div className="space-y-1.5"><label className="text-xs font-black text-slate-500 flex items-center gap-2">施工說明二 (提報文件) <QuickPhraseMenu onSelect={(p) => updateFormField('constructionDesc2', p)} type="report" /></label><AutoResizeTextarea value={formData.constructionDesc2} onChange={(e) => updateFormField('constructionDesc2', e.target.value)} className="w-full p-4 rounded-2xl bg-white" /></div>
              </div>
            </div>

            {/* 4. 結報 */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
              <h2 className="text-base font-black text-emerald-800 border-b pb-2">4. 結報</h2>
              <div className="space-y-4">
                <div className="space-y-1.5"><label className="text-xs font-black text-slate-500">完工說明一 (成果)</label><AutoResizeTextarea value={formData.completionDesc1} onChange={(e) => updateFormField('completionDesc1', e.target.value)} className="w-full p-4 rounded-2xl bg-white" /></div>
                <div className="space-y-1.5"><label className="text-xs font-black text-slate-500 flex items-center gap-2">完工說明二 (結報文件) <QuickPhraseMenu onSelect={(p) => updateFormField('completionDesc2', p)} type="complete" /></label><AutoResizeTextarea value={formData.completionDesc2} onChange={(e) => updateFormField('completionDesc2', e.target.value)} className="w-full p-4 rounded-2xl bg-white" /></div>
                <div className="pt-4 border-t border-slate-50">
                  <label className="text-xs font-black text-slate-600 block mb-4">客戶滿意度調查</label>
                  <div className="grid grid-cols-3 gap-3">{SATISFACTION_LEVELS.map(level => (
                    <label key={level.label} onClick={(e) => { e.preventDefault(); const isS = formData.satisfactionLevel === level.label; setFormData(p => ({ ...p, satisfactionLevel: isS ? '' : level.label, satisfactionScore: isS ? null : level.score })); }} className={`cursor-pointer p-3 rounded-2xl border flex flex-col items-center justify-center gap-2 h-20 transition-all ${formData.satisfactionLevel === level.label ? `${level.borderColor} ${level.bgColor} ring-2` : 'bg-white border-slate-100 hover:border-slate-300'}`}><div className={`w-3.5 h-3.5 rounded-full border-2 ${formData.satisfactionLevel === level.label ? level.color : 'border-slate-300'}`}></div><div className="text-[11px] font-black text-center">{level.label}</div></label>
                  ))}</div>
                </div>
              </div>
            </div>

            {/* 5. JDM 報修進度 (置底) */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
              <h2 className="text-base font-black text-slate-900 uppercase tracking-widest border-b pb-3">5. JDM 報修進度</h2>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 bg-slate-50/80 p-5 rounded-3xl border border-slate-100 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">{[{l:'提報',f1:'reportDate',f2:'reportSubmitDate',c:'bg-blue-500'},{l:'奉核',f1:'approvalDate',c:'bg-purple-500'},{l:'結報',f1:'closeDate',f2:'closeSubmitDate',c:'bg-emerald-500'}].map((s,i)=>(<div key={i} className="space-y-3"><div className="flex items-center gap-2 mb-1"><div className={`w-2 h-2 rounded-full ${s.c}`}></div><span className="text-sm font-black text-slate-700">{s.l}階段</span></div><div className="space-y-3"><input type="date" className={`${EDITABLE_INPUT_STYLE} w-full rounded-xl`} value={formData.jdmControl[s.f1]} onChange={(e) => updateJdmField(s.f1, e.target.value)} />{s.f2 && <input type="date" className={`${EDITABLE_INPUT_STYLE} w-full rounded-xl`} value={formData.jdmControl[s.f2]} onChange={(e) => updateJdmField(s.f2, e.target.value)} />}</div></div>))}</div>
                  {jdmErrors.length > 0 && <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-600 font-black text-xs animate-pulse"><AlertTriangle size={14}/> {jdmErrors[0]}</div>}
                </div>
                <div className="lg:col-span-4 bg-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-6">
                   <div><label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1.5 flex items-center gap-2"><Hash size={14} className="text-blue-400" /> JDM 系統案號</label><input type="text" className="w-full px-4 py-3 rounded-xl bg-slate-800 text-white border border-slate-700 outline-none focus:border-blue-500 font-mono font-black" value={formData.jdmControl.caseNumber} onChange={(e) => updateJdmField('caseNumber', e.target.value)} /></div>
                   <div className="space-y-3"><label className="text-xs font-black text-slate-400 uppercase tracking-widest">目前進度狀態</label>
                     <div className="grid grid-cols-2 gap-3">{['提報', '結報', '抽換', '退件'].map(s => (<label key={s} onClick={() => handleStatusClick(s)} className={`p-3 rounded-xl border-2 cursor-pointer transition-all text-center font-black text-sm ${formData.jdmControl.status === s ? 'border-blue-500 bg-blue-500/10 text-blue-400 shadow-lg' : 'border-slate-800 text-slate-500 hover:border-slate-700'}`}>{s}</label>))}</div>
                   </div>
                   <div className="space-y-2"><div className="flex justify-between items-center"><label className="text-xs font-black text-slate-400 uppercase tracking-widest">案件備註 (抽換/退件必填)</label>{((formData.jdmControl.status === '抽換' || formData.jdmControl.status === '退件')) && <span className="text-rose-400 text-[10px] font-black animate-pulse uppercase">必填欄位</span>}</div>
                      <AutoResizeTextarea value={formData.jdmControl.remarks} onChange={(e) => updateJdmField('remarks', e.target.value)} className={`w-full p-4 rounded-2xl bg-slate-800 text-white text-sm focus:border-blue-500 transition-all ${((formData.jdmControl.status === '抽換' || formData.jdmControl.status === '退件') && !formData.jdmControl.remarks.trim()) ? 'ring-2 ring-rose-500/50 border-rose-500' : 'border-slate-700'}`} placeholder="說明異常、抽換或被退件之詳細原因..." />
                   </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* 案件管理中心視圖 (已完整還原搜尋模組) */
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col gap-5">
              <div className="flex flex-col xl:flex-row gap-4 items-center">
                <div className="flex-1 relative w-full"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input type="text" placeholder="搜尋姓名、地址、JDM 案號、修繕標題..." className={`w-full pl-12 pr-6 py-3.5 rounded-2xl border font-bold text-sm ${EDITABLE_INPUT_STYLE}`} value={dashboardFilter.search} onChange={(e) => setDashboardFilter({...dashboardFilter, search: e.target.value})} /></div>
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  {/* 站點篩選器 */}
                  <div className="relative" ref={stationDropdownRef}>
                    <button onClick={() => setIsStationDropdownOpen(!isStationDropdownOpen)} className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-black text-sm border bg-white min-w-[160px] transition-all hover:border-blue-400 shadow-sm ${dashboardFilter.stations.length > 0 ? 'border-blue-500 text-blue-600 bg-blue-50/30' : 'border-slate-300'}`}><Building2 size={16} /><span className="truncate">{dashboardFilter.stations.length === 0 ? '所有站點' : `已選 ${dashboardFilter.stations.length} 個站點`}</span><ChevronDown size={14}/></button>
                    {isStationDropdownOpen && (<div className="absolute left-0 mt-2 w-72 bg-white border border-slate-200 rounded-3xl shadow-2xl z-[100] p-4 max-h-80 overflow-y-auto custom-scrollbar space-y-1">{availableStations.map(st => (<button key={st} onClick={() => setDashboardFilter(p => ({...p, stations: p.stations.includes(st)?p.stations.filter(x=>x!==st):[...p.stations,st]}))} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${dashboardFilter.stations.includes(st)?'bg-blue-50 text-blue-700':'text-slate-700 hover:bg-slate-50'}`}><div className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-all ${dashboardFilter.stations.includes(st)?'bg-blue-600 border-blue-600':'bg-white border-slate-300'}`}>{dashboardFilter.stations.includes(st) && <Check size={12} className="text-white" />}</div><span className="truncate text-left flex-1">{st}</span></button>))}</div>)}
                  </div>
                  {/* 狀態篩選器 */}
                  <div className="relative"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16}/><select className={`pl-10 pr-6 py-3 rounded-2xl font-black text-sm border min-w-[160px] ${EDITABLE_INPUT_STYLE}`} value={dashboardFilter.status} onChange={(e) => setDashboardFilter({...dashboardFilter, status: e.target.value})}><option>全部</option><option>未完成案件 (全部)</option><option disabled>─────</option><option>待提報</option><option>提報</option><option>抽換</option><option>退件</option><option>結報</option></select></div>
                  {/* 特殊搜尋按鈕 (還原公式邏輯) */}
                  <div className="relative" ref={specialSearchRef}>
                    <button onClick={() => setIsSpecialSearchOpen(!isSpecialSearchOpen)} className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-black text-sm border transition-all hover:bg-slate-50 ${dashboardFilter.reportMonth || dashboardFilter.specialFormula ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-300'}`}><Settings2 size={16} /> 進階篩選</button>
                    {isSpecialSearchOpen && (
                      <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-[28px] shadow-2xl z-[110] p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">JDM 提報月份</label><input type="month" className={`w-full ${EDITABLE_INPUT_STYLE} !py-2 !text-xs rounded-xl`} value={dashboardFilter.reportMonth} onChange={(e) => setDashboardFilter({...dashboardFilter, reportMonth: e.target.value})} /></div>
                           <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">JDM 結報月份</label><input type="month" className={`w-full ${EDITABLE_INPUT_STYLE} !py-2 !text-xs rounded-xl`} value={dashboardFilter.closeMonth} onChange={(e) => setDashboardFilter({...dashboardFilter, closeMonth: e.target.value})} /></div>
                        </div>
                        <div className="space-y-3 pt-2 border-t">
                           <label className="text-xs font-black text-slate-400 uppercase tracking-widest">快速篩選公式</label>
                           <div className="grid grid-cols-2 gap-2">{['本期已完工', '前期已完工', '本期待追蹤', '前期待追蹤', '約內已完工', '內控管理'].map(f => (<button key={f} onClick={() => setDashboardFilter(p => ({...p, specialFormula: p.specialFormula === f ? '' : f}))} className={`px-2 py-2.5 text-[10px] font-black rounded-xl border transition-all ${dashboardFilter.specialFormula === f ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:border-blue-300'}`}>{f}</button>))}</div>
                        </div>
                        <button onClick={() => setDashboardFilter({...dashboardFilter, reportMonth:'', closeMonth:'', specialFormula:''})} className="w-full py-2 text-xs font-bold text-rose-500 hover:underline">清除篩選條件</button>
                      </div>
                    )}
                  </div>
                  {/* 歷史匯入與匯出 */}
                  <div className="flex items-center gap-2 border-l pl-3 ml-1">
                    <label className={`flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-white rounded-xl cursor-pointer hover:bg-slate-700 transition font-black text-xs shadow-lg ${importStatus.isProcessingC ? 'opacity-50 pointer-events-none' : ''}`}><History size={14}/> 歷史匯入<input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={(e) => handleFileUpload('C', e)} /></label>
                    <div className="relative group">
                      <select className="absolute opacity-0 inset-0 cursor-pointer w-full" value={exportMode} onChange={(e) => setExportMode(e.target.value)}><option>待追蹤事項</option><option>工作提報單</option><option>滿意度調查</option><option>內控管理</option></select>
                      <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-3 rounded-xl font-black text-xs bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600 shadow-lg"><Download size={14} /> 匯出</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
              {!isDashboardSearchActive ? (
                <div className="flex-1 flex flex-col items-center justify-center p-20 text-center space-y-4"><Search size={64} className="text-slate-100" /><h3 className="text-xl font-black text-slate-900">請設定搜尋關鍵字以調閱雲端資料庫</h3><p className="text-slate-400 font-bold max-w-xs">輸入承租人、門牌、案號或選取篩選條件後，系統將自動連動 Firestore 顯示資料。</p></div>
              ) : (
                <div className="overflow-x-auto custom-scrollbar"><table className="w-full text-left border-collapse table-fixed min-w-[1200px]"><thead className="bg-slate-50 border-b border-slate-100"><tr className="text-slate-500 font-black text-[11px] uppercase tracking-widest"><th className="w-28 p-4 text-center">狀態</th><th className="w-28 p-4 text-center">提報日</th><th className="w-40 p-4">案號 / 站點</th><th className="w-60 p-4">承租人 / 地址</th><th className="w-52 p-4">維修概述</th><th className="w-28 p-4 text-right">合計金額</th><th className="w-auto p-4">待補細節</th><th className="w-28 p-4 text-center">操作</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{dashboardResults.length === 0 ? (<tr><td colSpan="8" className="p-32 text-center text-slate-300 font-black italic">查無符合目前條件之案件，請重試。</td></tr>) : dashboardResults.map(it => (<MemoizedRepairRow key={it.id} item={it} onEdit={handleEditCaseInternal} onDelete={handleDeleteTrigger} />))}</tbody></table><div className="bg-slate-50 p-3 text-[10px] font-black text-slate-400 text-center uppercase tracking-widest">過濾結果：共 {dashboardResults.length} 筆案件</div></div>
              )}
            </div>
          </div>
        )}
      </div>

      {message.text && (
        <div className={`fixed top-12 left-1/2 -translate-x-1/2 z-[110000] flex items-center gap-3 px-8 py-5 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border-2 animate-in slide-in-from-top-10 duration-500 ${message.type === 'success' ? 'bg-white border-emerald-500 text-emerald-800' : 'bg-white border-rose-500 text-rose-800'}`}>
          {message.type === 'success' ? <CheckCircle size={24} className="text-emerald-500" /> : <AlertCircle size={24} className="text-rose-500" />}<span className="font-black text-base whitespace-nowrap">{message.text}</span>
        </div>
      )}

      {copyTip.show && (
        <div className="fixed z-[99999] pointer-events-none px-3 py-1.5 bg-slate-900 text-white text-xs font-black rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in duration-150" style={{ left: copyTip.x, top: copyTip.y - 30, transform: 'translateX(-50%)' }}>
          <CheckCircle size={12} className="text-emerald-400" /> 已複製到剪貼簿！
        </div>
      )}
    </div>
  );
};

export default App;
