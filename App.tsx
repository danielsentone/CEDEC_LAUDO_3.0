import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
// @ts-ignore
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker path for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs`;

import { 
  BuildingTypology, 
  DamageClassification, 
  Engineer, 
  LaudoForm, 
  ZoneType,
  Protocolo,
  IndicacaoFiscalParts,
  LaudoHistory,
  PropertyData
} from './types';
import { 
  PARANA_CITIES, 
  INITIAL_ENGINEERS, 
  DAMAGE_LOGIC, 
  BRAZIL_STATES,
  PARECER_TEXTS,
  PARECER_COMERCIAL
} from './constants';
import { RIO_BONITO_DATA } from './data/rioBonitoData';
// Import logos from the assets directory
import { BRASAO_PR_LOGO, DEFESA_CIVIL_PR_LOGO } from './assets/logos';
import { MapPicker, MapPickerHandle, DownloadState } from './components/MapPicker';
import { DamageInput } from './components/DamageInput';
import { CityAutocomplete } from './components/CityAutocomplete';
import { generateLaudoPDF, getLaudoFilename } from './services/pdfService';
import { supabase } from './services/supabase';
import { FileText, Save, MapPin, User, AlertTriangle, Building, Shield, Trash2, Edit, Lock, CheckCircle, XCircle, Trees, Eye, X, Download, Image as ImageIcon, Upload, Link as LinkIcon, Settings, CloudUpload, Check, Loader2, ClipboardList, DownloadCloud, Plus, LogIn, Key, LogOut, Zap, List, FilePlus, ArrowLeft, Phone, Users, ShieldCheck, ChevronDown, ChevronUp, Database, Columns, ExternalLink } from 'lucide-react';

// Helper to get Local Date in YYYY-MM-DD format
const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper for CPF Mask
const formatCPF = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers
        .replace(/^(\d{2})(\d)/g, '($1) $2')
        .replace(/(\d)(\d{4})$/, '$1-$2')
        .substring(0, 15);
}

// Helper for Protocolo Mask (11.111.111-1)
const formatProtocolo = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  return numbers
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
    .substring(0, 12);
};

// Helper: Title Case Português
const toTitleCase = (str: any) => {
  if (!str || typeof str !== 'string') return '';
  const exceptions = ['de', 'da', 'do', 'dos', 'das', 'e', 'em', 'para', 'com', 'por'];
  const romanNumerals = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx'];
  
  return str.toLowerCase().split(/\s+/).map((word, index) => {
    if (!word) return '';
    const cleanWord = word.replace(/[^a-zA-Z0-9]/g, ''); // Check raw word for roman numeral match
    if (romanNumerals.includes(cleanWord)) return word.toUpperCase();
    if (index > 0 && exceptions.includes(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
};

/**
 * Máscara Indicação Fiscal: NN.NN.NNN.TTTT.TTTT.NNN
 */
const formatIndicacaoFiscal = (value: string) => {
  const raw = value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase();
  let filtered = '';
  for (let i = 0; i < raw.length; i++) {
    if (filtered.length >= 18) break;
    const char = raw[i];
    const idx = filtered.length;
    const isN = (idx <= 6 || idx >= 15);
    if (isN) {
      if (/[\d-]/.test(char)) filtered += char;
    } else {
      filtered += char;
    }
  }

  return filtered
    .replace(/^([a-zA-Z0-9-]{2})([a-zA-Z0-9-])/, '$1.$2')
    .replace(/^([a-zA-Z0-9-]{2})\.([a-zA-Z0-9-]{2})([a-zA-Z0-9-])/, '$1.$2.$3')
    .replace(/^([a-zA-Z0-9-]{2})\.([a-zA-Z0-9-]{2})\.([a-zA-Z0-9-]{3})([a-zA-Z0-9-])/, '$1.$2.$3.$4')
    .replace(/^([a-zA-Z0-9-]{2})\.([a-zA-Z0-9-]{2})\.([a-zA-Z0-9-]{3})\.([a-zA-Z0-9-]{4})([a-zA-Z0-9-])/, '$1.$2.$3.$4.$5')
    .replace(/^([a-zA-Z0-9-]{2})\.([a-zA-Z0-9-]{2})\.([a-zA-Z0-9-]{3})\.([a-zA-Z0-9-]{4})\.([a-zA-Z0-9-]{4})([a-zA-Z0-9-])/, '$1.$2.$3.$4.$5.$6')
    .substring(0, 23);
};

const parseIndicacaoFiscal = (value: string) => {
    const raw = value.replace(/[^a-zA-Z0-9-]/g, '');
    if (raw.length >= 18) {
        return {
            setor: raw.substring(0, 2),
            quadra: raw.substring(2, 4),
            lote: raw.substring(4, 7),
            sublote: raw.substring(7, 11),
            unidade: raw.substring(11, 15),
            digito: raw.substring(15, 18)
        };
    }
    return undefined;
};

const validateCPF = (cpf: string) => {
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
  let sum = 0, remainder;
  for (let i = 1; i <= 9; i++) sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  remainder = (sum * 10) % 11;
  if ((remainder === 10) || (remainder === 11)) remainder = 0;
  if (remainder !== parseInt(cpf.substring(9, 10))) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  remainder = (sum * 10) % 11;
  if ((remainder === 10) || (remainder === 11)) remainder = 0;
  if (remainder !== parseInt(cpf.substring(10, 11))) return false;
  return true;
};

const processAndTrimImage = (file: File | Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) { resolve(img.src); return; }
          canvas.width = img.width; canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0, found = false;
          for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
              const i = (y * canvas.width + x) * 4;
              if (data[i+3] > 10 && (data[i] < 240 || data[i+1] < 240 || data[i+2] < 240)) {
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
                found = true;
              }
            }
          }
          if (!found) { resolve(img.src); return; }
          const width = maxX - minX + 1, height = maxY - minY + 1;
          const cutCanvas = document.createElement('canvas');
          cutCanvas.width = width; cutCanvas.height = height;
          const cutCtx = cutCanvas.getContext('2d');
          if(!cutCtx) { resolve(img.src); return; }
          cutCtx.drawImage(canvas, minX, minY, width, height, 0, 0, width, height);
          resolve(cutCanvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
};

const downloadAndProcessImage = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const blob = await response.blob();
        return await processAndTrimImage(blob);
    } catch (error) {
        return url;
    }
};

// --- LOGIN UTILS ---
const getDefaultPassword = (name: string) => {
  if (!name) return '#.1234';
  const firstName = name.trim().split(' ')[0];
  return `#.${firstName}`;
};

// --- TYPES FOR VIEW STATE ---
type ViewState = 'landing' | 'login' | 'protocolList' | 'protocolForm' | 'laudoForm' | 'manageUsers' | 'managePropertyData';

// Componente de botão de exclusão com confirmação inline
const DeleteConfirmButton = ({ onDelete }: { onDelete: () => void }) => {
    return (
        <button 
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded transition-all duration-200 text-red-500 hover:bg-red-50 hover:text-red-700"
            title="Excluir registro"
        >
            <Trash2 size={14} />
        </button>
    );
};

const HistoryButton = ({ 
  protocol, 
  history, 
  isUserAdmin, 
  currentEngineerId,
  onStartLaudo, 
  onDeleteHistory,
  onPreviewHistory
}: {
  protocol: Protocolo;
  history: LaudoHistory[];
  isUserAdmin: boolean;
  currentEngineerId: string;
  onStartLaudo: (p: Protocolo) => void;
  onDeleteHistory: (id: string) => void;
  onPreviewHistory: (url: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, showBelow: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateCoords = () => {
    if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const popupWidth = Math.min(280, window.innerWidth - 20);
        const viewportWidth = window.innerWidth;

        // Determine horizontal position
        let leftPos = rect.left + scrollX;
        
        // If popup goes off-screen to the right, align it to the right edge of the button
        if (rect.left + popupWidth > viewportWidth - 10) {
            leftPos = (rect.right + scrollX) - popupWidth;
        }

        // Ensure it doesn't go off-screen to the left either
        if (leftPos < 10) leftPos = 10;

        // Determine if it should be above or below
        // If there's not enough space above (approx 250px), show below
        const spaceAbove = rect.top;
        const showBelow = spaceAbove < 250;

        setCoords({
            top: showBelow ? rect.bottom + scrollY + 8 : rect.top + scrollY - 8, 
            left: leftPos,
            showBelow
        });
    }
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    updateCoords();
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 1000); // 1 second delay
  };

  const handleClickHistory = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      updateCoords();
      setIsOpen(prev => !prev);
  };

  const handleClickDelete = (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Clear timeout to prevent closing while dialog is open
      if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
      }

      if (window.confirm("Tem certeza que deseja excluir este registro do histórico?")) {
          onDeleteHistory(id);
      }
  };

  const hasHistory = history.length > 0;

  return (
    <>
      <div className="flex items-center shadow-sm rounded overflow-hidden">
         <button 
            type="button" 
            onClick={() => onStartLaudo(protocol)} 
            className={`px-3 py-1.5 text-xs font-bold uppercase flex items-center gap-1 transition-colors ${hasHistory ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
        >
            <FileText size={14}/> Laudo
        </button>
        
        {hasHistory && (
            <button
                ref={buttonRef}
                type="button"
                onClick={handleClickHistory}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="bg-green-700 text-white px-2 py-1.5 text-[10px] font-bold hover:bg-green-800 transition-colors border-l border-green-800 flex items-center justify-center min-w-[24px]"
                title="Ver Histórico (Clique para fixar)"
            >
                {history.length}
            </button>
        )}
      </div>

      {hasHistory && isOpen && createPortal(
          <>
              {/* Mobile Backdrop */}
              <div className="fixed inset-0 z-[9998] md:hidden bg-black/5" onClick={() => setIsOpen(false)} />
              
              <div 
                  className="absolute bg-white rounded-lg shadow-2xl border border-gray-200 p-3 z-[9999] animate-in fade-in zoom-in-95 duration-200"
                  style={{ 
                      top: coords.top, 
                      left: coords.left,
                      transform: coords.showBelow ? 'none' : 'translateY(-100%)', 
                      width: '280px',
                      maxWidth: 'calc(100vw - 20px)'
                  }}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
              >
              <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 border-b pb-1 flex justify-between items-center">
                  Histórico de Emissão
                  <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={14}/></button>
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {history.map(h => (
                                      <div key={h.id} className="text-xs flex justify-between items-center gap-2 mb-2 border-b border-gray-100 pb-2 last:border-0 last:mb-0 last:pb-0 hover:bg-gray-50 p-2 rounded group/item">
                                          <div className="flex-1">
                                              <div className="font-bold text-blue-900">
                                                  {(() => {
                                                      const parts = h.engineer_name.trim().split(/\s+/);
                                                      return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : h.engineer_name;
                                                  })()}
                                              </div>
                                              <div className="text-[10px] text-gray-500">
                                                  {new Date(h.created_at).toLocaleString('pt-BR')}
                                              </div>
                                          </div>
                                          <div className="flex items-center gap-1">
                                              {h.pdf_url && (
                                                  <>
                                                      <a 
                                                          href={h.pdf_url} 
                                                          target="_blank" 
                                                          rel="noopener noreferrer" 
                                                          className="bg-green-50 text-green-600 hover:bg-green-600 hover:text-white p-1.5 rounded transition-all flex items-center gap-1 font-bold border border-green-200"
                                                          title="Baixar PDF"
                                                          onClick={(e) => e.stopPropagation()}
                                                      >
                                                          <Download size={14} /> <span className="text-[10px]">PDF</span>
                                                      </a>
                                                  </>
                                              )}
                                              <DeleteConfirmButton onDelete={() => onDeleteHistory(h.id)} />
                                          </div>
                                      </div>
                                  ))}
              </div>
          </div>
          </>,
          document.body
      )}
    </>
  );
};

// Custom PDF Viewer Component for better Mobile/iOS experience
const PDFViewer = ({ url }: { url: string }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [pdfInstance, setPdfInstance] = useState<any>(null);

  useEffect(() => {
    const loadPDF = async () => {
      setLoading(true);
      try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        setPdfInstance(pdf);
        setNumPages(pdf.numPages);
        
        // Generate thumbnails
        const thumbUrls: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.2 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: context!, viewport }).promise;
          thumbUrls.push(canvas.toDataURL());
        }
        setThumbnails(thumbUrls);
        renderPage(pdf, 1);
      } catch (error) {
        console.error('Error loading PDF:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPDF();
  }, [url]);

  const renderPage = async (pdf: any, pageNum: number) => {
    if (!pdf) return;
    try {
        const page = await pdf.getPage(pageNum);
        const containerWidth = window.innerWidth < 640 ? window.innerWidth - 40 : 800;
        const viewportOrig = page.getViewport({ scale: 1 });
        const scale = containerWidth / viewportOrig.width;
        const viewport = page.getViewport({ scale });
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: context, viewport }).promise;
        setCurrentPage(pageNum);
    } catch (err) {
        console.error("Error rendering page:", err);
    }
  };

  const goToPage = (pageNum: number) => {
    if (pdfInstance) {
      renderPage(pdfInstance, pageNum);
      // Scroll main view to top
      const mainView = document.getElementById('pdf-main-view');
      if (mainView) mainView.scrollTop = 0;
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Menu / Thumbnails */}
        <div className="w-20 sm:w-44 bg-gray-800 border-r border-gray-700 overflow-y-auto p-2 flex flex-col gap-3 scrollbar-hide">
          <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-1 text-center">Páginas</h4>
          {thumbnails.map((thumb, idx) => (
            <button 
              key={idx} 
              onClick={() => goToPage(idx + 1)}
              className={`relative border-2 rounded-lg transition-all overflow-hidden group ${currentPage === idx + 1 ? 'border-blue-500 ring-2 ring-blue-500/20 scale-95' : 'border-transparent opacity-60 hover:opacity-100'}`}
            >
              <img src={thumb} alt={`Pág ${idx + 1}`} className="w-full h-auto" />
              <div className={`absolute inset-0 flex items-center justify-center bg-blue-500/10 transition-opacity ${currentPage === idx + 1 ? 'opacity-100' : 'opacity-0'}`}>
                 <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg">{idx + 1}</span>
              </div>
              {! (currentPage === idx + 1) && (
                <span className="absolute bottom-1 right-1 bg-black/60 text-[9px] px-1 rounded text-white">{idx + 1}</span>
              )}
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        <div id="pdf-main-view" className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center items-start bg-gray-950">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Loader2 className="animate-spin text-blue-500" size={48} />
              <p className="text-gray-400 text-sm font-medium animate-pulse">Carregando páginas...</p>
            </div>
          ) : (
            <div className="shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-white rounded-sm overflow-hidden transition-transform duration-300">
              <canvas ref={canvasRef} className="max-w-full h-auto" />
            </div>
          )}
        </div>
      </div>
      
      {/* Footer Controls */}
      <div className="bg-gray-800 p-3 border-t border-gray-700 flex justify-between items-center px-4 sm:px-8 shrink-0">
        <div className="flex items-center gap-2 sm:gap-6">
           <button 
            disabled={currentPage <= 1 || loading} 
            onClick={() => goToPage(currentPage - 1)}
            className="p-2 hover:bg-gray-700 rounded-full disabled:opacity-20 transition-colors"
            title="Página Anterior"
           >
             <ChevronUp size={20} className="-rotate-90 sm:rotate-0" />
           </button>
           <div className="flex flex-col items-center">
             <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Página</span>
             <span className="text-sm font-mono font-bold">{currentPage} <span className="text-gray-500">/</span> {numPages}</span>
           </div>
           <button 
            disabled={currentPage >= numPages || loading} 
            onClick={() => goToPage(currentPage + 1)}
            className="p-2 hover:bg-gray-700 rounded-full disabled:opacity-20 transition-colors"
            title="Próxima Página"
           >
             <ChevronDown size={20} className="-rotate-90 sm:rotate-0" />
           </button>
        </div>
        
        <div className="flex items-center gap-2">
           <a 
             href={url} 
             download="laudo-tecnico.pdf" 
             className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase flex items-center gap-2 transition-all shadow-lg active:scale-95"
           >
             <Download size={14} /> <span className="hidden sm:inline">Baixar PDF</span>
           </a>
        </div>
      </div>
    </div>
  );
};

export function App() {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // VIEW STATE
  const [currentView, setCurrentView] = useState<ViewState>('login');
  
  // LOGIN STATE
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginEngineerId, setLoginEngineerId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [engineerSearch, setEngineerSearch] = useState('');
  const [showEngineerList, setShowEngineerList] = useState(false);
  const engineerSelectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (engineerSelectRef.current && !engineerSelectRef.current.contains(event.target as Node)) {
        setShowEngineerList(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [engineerSelectRef]);
  
  // ADMIN STATE
  const [isAdminLoginMode, setIsAdminLoginMode] = useState(false);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [propertyData, setPropertyData] = useState<PropertyData[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importMunicipio, setImportMunicipio] = useState('');
  const [adminUsername, setAdminUsername] = useState('');

  // DATA STATE - Changed to fetch from Supabase
  const [protocols, setProtocols] = useState<Protocolo[]>([]);
  const [engineers, setEngineers] = useState<Engineer[]>(INITIAL_ENGINEERS); // Inicia com padrão, depois atualiza
  const [laudoHistory, setLaudoHistory] = useState<LaudoHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // FILTERS STATE
  const [filterCity, setFilterCity] = useState('');
  const [filterEngineer, setFilterEngineer] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterLaudoStatus, setFilterLaudoStatus] = useState<'all' | 'issued' | 'pending'>('all');
  const [filterProtocolNumber, setFilterProtocolNumber] = useState('');

  // COLUMN PERSISTENCE
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('protocolTableColumns');
    return saved ? JSON.parse(saved) : ['Data', 'Protocolo', 'Município', 'Requerente', 'Distribuído Para', 'Status'];
  });
  const [showColumnToggle, setShowColumnToggle] = useState(false);

  useEffect(() => {
    localStorage.setItem('protocolTableColumns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Fetch Data from Supabase
  useEffect(() => {
    const checkApiHealth = async () => {
        try {
            const response = await fetch('/api/health');
            if (response.ok) {
                const data = await response.json();
                console.log("[DIAGNOSTIC] API Health Check:", data);
            } else {
                console.warn("[DIAGNOSTIC] API Health Check failed with status:", response.status);
            }
        } catch (err) {
            console.error("[DIAGNOSTIC] API Health Check failed to connect:", err);
        }
    };
    checkApiHealth();

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch Protocols
            const { data: protocolsData, error: protocolsError } = await supabase
                .from('protocols')
                .select('*');
            
            if (protocolsError) {
                console.error('Erro ao buscar protocolos:', protocolsError);
                setLoginError("Erro de conexão com o banco de dados. Verifique as chaves do Supabase.");
            } else if (protocolsData) {
                setProtocols(protocolsData as Protocolo[]);
            }

            // Fetch Laudo History
            const { data: historyData, error: historyError } = await supabase
                .from('laudo_history')
                .select('*');

            if (historyError) console.error('Erro ao buscar histórico:', historyError);
            if (historyData) setLaudoHistory(historyData as LaudoHistory[]);

            // Fetch Engineers
            let engineersData = null;
            let engineersError = null;

            try {
                const response = await supabase
                    .from('engineers')
                    .select('id, name, crea, state, institution, isCustom, active')
                    .order('name', { ascending: true });
                engineersData = response.data;
                engineersError = response.error;
            } catch (e) {
                console.error("Supabase fetch exception:", e);
            }
            
            if (engineersError) {
                console.error('Erro ao buscar engenheiros:', engineersError);
                // Fallback to initial engineers if fetch fails
                setEngineers(INITIAL_ENGINEERS.map(e => ({ ...e, active: true })));
            } else if (engineersData && engineersData.length > 0) {
                const mappedEngineers = engineersData.map((e: any) => ({
                    ...e,
                    active: e.active !== false // Default to true if null or undefined
                }));
                setEngineers(mappedEngineers);
            } else {
                console.log("Tabela vazia. Populando engenheiros padrão...");
                const { error: insertError } = await supabase
                    .from('engineers')
                    .upsert(INITIAL_ENGINEERS.map(e => ({ ...e, active: true })));
                
                if (insertError) {
                    console.error("Erro ao popular tabela:", insertError);
                     // Fallback to initial engineers if insert fails
                     setEngineers(INITIAL_ENGINEERS.map(e => ({ ...e, active: true })));
                } else {
                     // If insert success, set state
                     setEngineers(INITIAL_ENGINEERS.map(e => ({ ...e, active: true })));
                }
            }
        } catch (err: any) {
            console.error('Erro geral ao buscar dados:', err);
            if (err.message === 'Failed to fetch') {
                setLoginError("Não foi possível conectar ao servidor (Failed to fetch). Verifique sua conexão ou se o Supabase está acessível.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    fetchData();
  }, []);

  // Global Key Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'TEXTAREA') return;
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- FORMS STATE ---
  const [protocolForm, setProtocolForm] = useState<Protocolo>({
      id: '',
      data: getLocalDate(),
      municipio: '',
      numeroProtocolo: '',
      requerente: '',
      cpf: '',
      telefone: '',
      zona: ZoneType.URBANO,
      indicacaoFiscal: '',
      inscricaoImobiliaria: '',
      matricula: '',
      nirfCib: '',
      incra: '',
      proprietario: '',
      endereco: '',
      bairro: '',
      cep: '',
      lat: NaN,
      lng: NaN,
      zoom: 14,
      descricaoNivelDestruicao: '',
      percentualDestruicao: '',
      engineerId: '',
      distributedToId: ''
  });

  const [formData, setFormData] = useState<LaudoForm>({
    municipio: '',
    data: getLocalDate(),
    protocolo: '',
    engineerId: '', 
    zona: ZoneType.URBANO,
    indicacaoFiscal: '',
    inscricaoImobiliaria: '',
    matricula: '',
    nirfCib: '',
    incra: '',
    proprietario: '',
    requerente: '',
    cpfRequerente: '',
    telefoneRequerente: '',
    endereco: '',
    bairro: '',
    cep: '',
    lat: NaN,
    lng: NaN,
    tipologia: '' as BuildingTypology, 
    tipologiaOutro: '',
    finalidade: [],
    danos: [],
    classificacao: '' as DamageClassification, 
    logoEsquerda: BRASAO_PR_LOGO,
    logoDireita: DEFESA_CIVIL_PR_LOGO,
    parecerFinal: '',
    descricaoNivelDestruicao: ''
  });

  // Map State (Shared)
  const [mapState, setMapState] = useState({
      lat: -25.4897,
      lng: -52.5283,
      zoom: 14
  });
  
  const [isSpecificLocation, setIsSpecificLocation] = useState(false);
  const mapPickerRef = useRef<MapPickerHandle>(null);
  const [downloadState, setDownloadState] = useState<DownloadState>({ isDownloading: false, isPreparing: false, progress: 0, total: 0, completed: false, error: false });
  const [autoFilled, setAutoFilled] = useState(false);

  const handleDownloadStateChange = useCallback((state: DownloadState) => {
    setDownloadState(state);
  }, []);

  // Pre-process images
  useEffect(() => {
    const processDefaults = async () => {
        let updates: Partial<LaudoForm> = {};
        let changed = false;
        if (BRASAO_PR_LOGO.startsWith('http')) {
            const processedLeft = await downloadAndProcessImage(BRASAO_PR_LOGO);
            if (processedLeft !== BRASAO_PR_LOGO) { updates.logoEsquerda = processedLeft; changed = true; }
        }
        if (DEFESA_CIVIL_PR_LOGO.startsWith('http')) {
            const processedRight = await downloadAndProcessImage(DEFESA_CIVIL_PR_LOGO);
            if (processedRight !== DEFESA_CIVIL_PR_LOGO) { updates.logoDireita = processedRight; changed = true; }
        }
        if (changed) setFormData(prev => ({ ...prev, ...updates }));
    };
    processDefaults();
  }, []);

  const [idLaudo, setIdLaudo] = useState(() => {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('laudo_seq');
        const next = stored ? parseInt(stored) + 1 : 1;
        localStorage.setItem('laudo_seq', next.toString());
        return next.toString();
    }
    return '1';
  });

  // UI Modals
  const [showEngineerModal, setShowEngineerModal] = useState(false);
  const [newEngineer, setNewEngineer] = useState<Partial<Engineer>>({ state: 'PR', institution: 'Voluntário' });
  const [editingEngineer, setEditingEngineer] = useState<Engineer | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showCustomization, setShowCustomization] = useState(false);
  const [protocolToDelete, setProtocolToDelete] = useState<string | null>(null);
  const [historyToDeleteId, setHistoryToDeleteId] = useState<string | null>(null);

  // Validation States
  const [cpfValid, setCpfValid] = useState<boolean | null>(null);
  const [cpfErrorMessage, setCpfErrorMessage] = useState<string>('');
  const [indicacaoFiscalValid, setIndicacaoFiscalValid] = useState<boolean | null>(null);
  const [protocoloValid, setProtocoloValid] = useState<boolean | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  const clearErrors = () => setFormErrors({});

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
  };

  useEffect(() => {
    if (Object.keys(formErrors).length === 0) return;
    
    const newErrors = { ...formErrors };
    let changed = false;

    if (currentView === 'protocolForm') {
      if (protocolForm.municipio && newErrors.municipio) { delete newErrors.municipio; changed = true; }
      if (protocolForm.data && newErrors.data) { delete newErrors.data; changed = true; }
      if (protocolForm.numeroProtocolo && newErrors.numeroProtocolo) { delete newErrors.numeroProtocolo; changed = true; }
      if (protocolForm.requerente && newErrors.requerente) { delete newErrors.requerente; changed = true; }
      if (protocolForm.cpf && newErrors.cpf) { delete newErrors.cpf; changed = true; }
      if (protocolForm.endereco && newErrors.endereco) { delete newErrors.endereco; changed = true; }
      if (!isNaN(protocolForm.lat) && !isNaN(protocolForm.lng) && newErrors.location) { delete newErrors.location; changed = true; }
      if (protocolForm.percentualDestruicao && newErrors.percentualDestruicao) { delete newErrors.percentualDestruicao; changed = true; }
      if (protocolForm.descricaoNivelDestruicao && newErrors.descricaoNivelDestruicao) { delete newErrors.descricaoNivelDestruicao; changed = true; }
      if (protocolForm.engineerId && newErrors.engineerId) { delete newErrors.engineerId; changed = true; }
    } else if (currentView === 'laudoForm') {
      if (formData.municipio && newErrors.municipio) { delete newErrors.municipio; changed = true; }
      if (formData.data && newErrors.data) { delete newErrors.data; changed = true; }
      if (formData.protocolo && newErrors.protocolo) { delete newErrors.protocolo; changed = true; }
      if (formData.requerente && newErrors.requerente) { delete newErrors.requerente; changed = true; }
      if (formData.cpfRequerente && newErrors.cpf) { delete newErrors.cpf; changed = true; }
      if (formData.endereco && newErrors.endereco) { delete newErrors.endereco; changed = true; }
      if (!isNaN(formData.lat) && !isNaN(formData.lng) && newErrors.location) { delete newErrors.location; changed = true; }
      if (formData.tipologia && newErrors.tipologia) { delete newErrors.tipologia; changed = true; }
      if (formData.tipologia === BuildingTypology.OUTRO && formData.tipologiaOutro && newErrors.tipologiaOutro) { delete newErrors.tipologiaOutro; changed = true; }
      if (formData.classificacao && newErrors.classificacao) { delete newErrors.classificacao; changed = true; }
      if (formData.engineerId && newErrors.engineerId) { delete newErrors.engineerId; changed = true; }
    }

    if (changed) {
      setFormErrors(newErrors);
    }
  }, [protocolForm, formData, currentView, formErrors]);

  const selectedEngineer = engineers.find(e => e.id === (currentView === 'laudoForm' ? formData.engineerId : (protocolForm.engineerId || loginEngineerId)));
  const loggedInEngineer = engineers.find(e => e.id === loginEngineerId);
  const damageStats = formData.classificacao ? DAMAGE_LOGIC[formData.classificacao] : { level: '---', percent: '---' };

  const inputClass = (hasError: boolean = false) => `w-full h-[42px] rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 py-2 px-3 border bg-white text-black transition-all disabled:bg-gray-100 disabled:text-gray-400 ${hasError ? 'border-red-500 ring-1 ring-red-500 bg-red-50' : ''}`;
  const labelClass = "block text-sm font-bold text-blue-900 mb-1";
  const LabelWithAsterisk = ({ children }: { children: React.ReactNode }) => (
      <label className={labelClass}>
          {children} <span className="text-red-500">*</span>
      </label>
  );

  // --- LOGIC FUNCTIONS ---

  const handleCityChange = (cityName: string) => {
    const city = PARANA_CITIES.find(c => c.name === cityName);
    if (city) {
      setMapState(prev => ({ ...prev, lat: city.lat, lng: city.lng, zoom: 14 }));
    }
    setIsSpecificLocation(false);
    
    // Update the relevant state based on view
    if (currentView === 'protocolForm') {
        setProtocolForm(prev => ({
            ...prev, 
            municipio: cityName, 
            lat: NaN, 
            lng: NaN, 
            indicacaoFiscal: '', 
            inscricaoImobiliaria: '',
            endereco: '',
            bairro: '',
            cep: '',
            matricula: ''
        }));
    } else {
        setFormData(prev => ({
            ...prev, 
            municipio: cityName, 
            lat: NaN, 
            lng: NaN, 
            indicacaoFiscal: '', 
            inscricaoImobiliaria: '',
            endereco: '',
            bairro: '',
            cep: '',
            matricula: ''
        }));
    }
    setIndicacaoFiscalValid(null);
    setAutoFilled(false);
  };

  const handleSearchPropertyData = async (type: 'indicacao' | 'inscricao', value: string, municipio: string) => {
      const formattedValue = value.trim();
      if (!formattedValue || !municipio) return;

      // 1. Try static data first (for backward compatibility/speed if it's the specific city)
      let found: any = null;
      if (municipio === 'Rio Bonito do Iguaçu') {
          found = RIO_BONITO_DATA.find(item => type === 'indicacao' ? item.indicacao === formattedValue : item.inscricao === formattedValue);
      }

      // 2. If not found in static data, try database
      if (!found) {
          try {
              const { data, error } = await supabase
                  .from('property_data')
                  .select('*')
                  .eq('municipio', municipio)
                  .eq(type === 'indicacao' ? 'indicacao_fiscal' : 'inscricao_municipal', formattedValue)
                  .maybeSingle();
              
              if (data) {
                  found = {
                      indicacao: data.indicacao_fiscal,
                      inscricao: data.inscricao_municipal,
                      logradouro: data.logradouro,
                      proprietario: data.proprietario
                  };
              }
          } catch (err) {
              console.error("Erro ao buscar dados cadastrais:", err);
          }
      }

      if (found) {
          const cleanAddress = toTitleCase(found.logradouro.replace(/^\d+\s+-\s+/, ''));
          const formattedProprietario = toTitleCase(found.proprietario);

          const updates = {
              proprietario: formattedProprietario,
              endereco: cleanAddress, 
              indicacaoFiscal: found.indicacao,
              inscricaoImobiliaria: found.inscricao,
              indicacaoFiscalParts: parseIndicacaoFiscal(found.indicacao)
          };

          if (currentView === 'protocolForm') {
              setProtocolForm(prev => ({ ...prev, ...updates }));
          } else {
              setFormData(prev => ({ ...prev, ...updates }));
          }
          
          setIndicacaoFiscalValid(true);
          setAutoFilled(true);
          setTimeout(() => setAutoFilled(false), 3000);
          if (mapPickerRef.current) mapPickerRef.current.searchAndCenter(cleanAddress);
      }
  };

  const handleClassificationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value as DamageClassification;
      const isComercial = formData.finalidade.includes('Comercial');
      const defaultParecer = isComercial ? PARECER_COMERCIAL : (PARECER_TEXTS[val] || '');
      setFormData(prev => ({ ...prev, classificacao: val, parecerFinal: defaultParecer }));
  };

  const handleIndicacaoFiscalChangeGeneric = (value: string, municipio: string, setFn: Function) => {
      const rawValue = value;
      if (municipio === 'Rio Bonito do Iguaçu') {
          const formatted = formatIndicacaoFiscal(rawValue);
          const parsedParts = parseIndicacaoFiscal(formatted);
          setFn((prev: any) => ({ ...prev, indicacaoFiscal: formatted, indicacaoFiscalParts: parsedParts }));
          if (formatted.length >= 18) handleSearchPropertyData('indicacao', formatted, municipio);
      } else {
          setFn((prev: any) => ({ ...prev, indicacaoFiscal: rawValue, indicacaoFiscalParts: undefined }));
      }
      setIndicacaoFiscalValid(null);
  };

  const handleInscricaoChangeGeneric = (value: string, municipio: string, setFn: Function) => {
      setFn((prev: any) => ({ ...prev, inscricaoImobiliaria: value }));
      handleSearchPropertyData('inscricao', value, municipio);
  };

  const handleIndicacaoFiscalBlurGeneric = (value: string, municipio: string) => {
    if (municipio === 'Rio Bonito do Iguaçu') {
        if (value.length > 0) setIndicacaoFiscalValid(value.replace(/\./g, '').length >= 18);
        else setIndicacaoFiscalValid(null);
    } else setIndicacaoFiscalValid(null);
  };

  const handleProtocoloChangeGeneric = (value: string, setFn: Function) => {
    const val = formatProtocolo(value);
    setFn((prev: any) => ({ ...prev, protocolo: val, numeroProtocolo: val }));
    setProtocoloValid(null);
  };

  const handleProtocoloBlurGeneric = (value: string) => {
      if (value.length > 0) setProtocoloValid(value.length >= 12); else setProtocoloValid(false);
  };

  const handleLocationSelect = useCallback((lat: number, lng: number, addressData?: any) => {
    setIsSpecificLocation(true);
    setMapState(prev => ({ ...prev, lat, lng }));
    
    const updates = {
        lat, lng,
        endereco: addressData?.road ? toTitleCase(`${addressData.road}, ${addressData.house_number || 'S/N'}`) : undefined,
        bairro: addressData?.suburb || addressData?.neighbourhood ? toTitleCase(addressData?.suburb || addressData?.neighbourhood) : undefined,
        cep: addressData?.postcode || undefined,
    };

    if (currentView === 'protocolForm') {
        setProtocolForm(prev => ({ 
            ...prev, 
            ...updates,
            endereco: updates.endereco || prev.endereco,
            bairro: updates.bairro || prev.bairro,
            cep: updates.cep || prev.cep
        }));
    } else if (currentView === 'laudoForm') {
        setFormData(prev => ({ 
            ...prev, 
            ...updates,
            endereco: updates.endereco || prev.endereco,
            bairro: updates.bairro || prev.bairro,
            cep: updates.cep || prev.cep
        }));
    }
  }, [currentView]);

  const handleCpfChangeGeneric = (value: string, setFn: Function, isProtocol: boolean) => {
      const val = formatCPF(value);
      if (isProtocol) {
        setFn((prev: any) => ({ ...prev, cpf: val }));
      } else {
        setFn((prev: any) => ({ ...prev, cpfRequerente: val }));
      }

      setCpfErrorMessage('');
      if (val.length === 14) {
          const isValid = validateCPF(val);
          setCpfValid(isValid);
          if (!isValid) setCpfErrorMessage('CPF Inválido');
      } else setCpfValid(null);
  };

  const handleCpfBlurGeneric = (value: string) => {
    if (value.length > 0 && value.length < 14) { setCpfValid(false); setCpfErrorMessage('CPF incompleto'); }
    else if (value.length === 0) { setCpfValid(null); setCpfErrorMessage(''); }
  };

  // --- ACTIONS ---

  const validateProtocolForm = () => {
      const errors: Record<string, boolean> = {};
      let isValid = true;

      if (!protocolForm.municipio) { errors.municipio = true; isValid = false; }
      if (!protocolForm.data) { errors.data = true; isValid = false; }
      if (!protocolForm.numeroProtocolo || protocolForm.numeroProtocolo.length < 12) { errors.numeroProtocolo = true; isValid = false; }
      if (!protocolForm.requerente) { errors.requerente = true; isValid = false; }
      if (!protocolForm.cpf) { errors.cpf = true; isValid = false; }
      if (!protocolForm.endereco) { errors.endereco = true; isValid = false; }
      if (isNaN(protocolForm.lat) || isNaN(protocolForm.lng)) { errors.location = true; isValid = false; }
      if (!protocolForm.percentualDestruicao) { errors.percentualDestruicao = true; isValid = false; }
      if (!protocolForm.descricaoNivelDestruicao) { errors.descricaoNivelDestruicao = true; isValid = false; }
      if (!protocolForm.engineerId) { errors.engineerId = true; isValid = false; }

      setFormErrors(errors);

      if (!isValid) {
          triggerToast("Por favor, preencha todos os campos obrigatórios marcados em vermelho.");
      }

      return isValid;
  };

  const saveProtocol = async () => {
      if (!validateProtocolForm()) return;
      setIsLoading(true);
      
      const newProtocol = { 
          id: protocolForm.id || crypto.randomUUID(),
          data: protocolForm.data,
          municipio: protocolForm.municipio,
          numeroProtocolo: protocolForm.numeroProtocolo,
          requerente: protocolForm.requerente,
          cpf: protocolForm.cpf,
          telefone: protocolForm.telefone,
          zona: protocolForm.zona,
          indicacaoFiscal: protocolForm.indicacaoFiscal,
          indicacaoFiscalParts: protocolForm.indicacaoFiscalParts,
          inscricaoImobiliaria: protocolForm.inscricaoImobiliaria,
          matricula: protocolForm.matricula,
          nirfCib: protocolForm.nirfCib,
          incra: protocolForm.incra,
          proprietario: protocolForm.proprietario,
          endereco: protocolForm.endereco,
          bairro: protocolForm.bairro,
          cep: protocolForm.cep,
          lat: protocolForm.lat,
          lng: protocolForm.lng,
          zoom: mapState.zoom,
          descricaoNivelDestruicao: protocolForm.descricaoNivelDestruicao,
          percentualDestruicao: protocolForm.percentualDestruicao,
          engineerId: protocolForm.engineerId || null,
          distributedToId: protocolForm.distributedToId || null
      };

      try {
          const { error } = await supabase
              .from('protocols')
              .upsert(newProtocol);

          if (error) {
              console.error(error);
              alert("Erro ao salvar protocolo no banco: " + error.message);
          } else {
              setProtocols(prev => {
                  const exists = prev.find(p => p.id === newProtocol.id);
                  if (exists) return prev.map(p => p.id === newProtocol.id ? newProtocol : p);
                  return [...prev, { ...newProtocol, created_at: new Date().toISOString() }];
              });
              alert("Protocolo salvo com sucesso!");
              setCurrentView('protocolList');
          }
      } catch (err) {
          alert("Erro de conexão ao salvar.");
      } finally {
          setIsLoading(false);
      }
  };

  const closeDeleteModal = () => {
      setShowDeleteModal(false);
      setProtocolToDelete(null);
      setHistoryToDeleteId(null);
      setDeletePassword('');
      setDeleteError('');
  };

  const handleDeleteProtocol = (id: string) => {
      setProtocolToDelete(id);
      setHistoryToDeleteId(null);
      setDeletePassword('');
      setDeleteError('');
      setShowDeleteModal(true);
  };

  const confirmDeleteProtocol = async () => {
      if (!protocolToDelete) return;
      if (!deletePassword) { setDeleteError('Digite sua senha para confirmar.'); return; }
      
      setIsLoading(true);
      setDeleteError('');

      try {
          // Requirement: Deletion only possible with admin password
          if (deletePassword !== 'admin') {
              setDeleteError('Senha de administrador incorreta. Exclusão não permitida.');
              setIsLoading(false);
              return;
          }

          // 1. Find all history entries for this protocol to get PDF URLs for storage cleanup
          const historyToDelete = laudoHistory.filter(h => h.protocol_id === protocolToDelete);
          const filesToRemove = historyToDelete
              .map(h => h.pdf_url?.split('/').pop()?.split('?')[0]) // Robust filename extraction
              .filter((name): name is string => !!name);

          if (filesToRemove.length > 0) {
              try {
                  console.log(`[STORAGE] Removendo ${filesToRemove.length} arquivos associados ao protocolo...`);
                  const deleteResponse = await fetch(`${window.location.origin}/api/storage`, {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ fileNames: filesToRemove }),
                  });
                  if (!deleteResponse.ok) {
                      const errorData = await deleteResponse.json();
                      console.warn("Aviso: Erro ao remover arquivos do Storage durante exclusão de protocolo:", errorData);
                  } else {
                      console.log("[STORAGE] Arquivos removidos com sucesso.");
                  }
              } catch (storageErr) {
                  console.warn("Aviso: Falha na comunicação para remover arquivos do Storage:", storageErr);
              }
          }

          // 2. Delete from Database (Cascade)
          // First delete history entries to ensure cleanup even if DB constraint is missing
          await supabase.from('laudo_history').delete().eq('protocol_id', protocolToDelete);
          
          const { error } = await supabase
              .from('protocols')
              .delete()
              .eq('id', protocolToDelete);

          if (error) {
              setDeleteError("Erro ao excluir: " + error.message);
          } else {
              setProtocols(prev => prev.filter(p => p.id !== protocolToDelete));
              setLaudoHistory(prev => prev.filter(h => h.protocol_id !== protocolToDelete));
              closeDeleteModal();
          }
      } catch (err) {
          setDeleteError("Erro de conexão.");
      } finally {
          setIsLoading(false);
      }
  };

  const validateLaudoForm = () => {
      const errors: Record<string, boolean> = {};
      let isValid = true;

      if (!formData.municipio) { errors.municipio = true; isValid = false; }
      if (!formData.data) { errors.data = true; isValid = false; }
      if (!formData.protocolo) { errors.protocolo = true; isValid = false; }
      if (!formData.requerente) { errors.requerente = true; isValid = false; }
      if (!formData.cpfRequerente) { errors.cpf = true; isValid = false; }
      if (!formData.endereco) { errors.endereco = true; isValid = false; }
      if (isNaN(formData.lat) || isNaN(formData.lng)) { errors.location = true; isValid = false; }
      if (!formData.tipologia) { errors.tipologia = true; isValid = false; }
      if (formData.tipologia === BuildingTypology.OUTRO && !formData.tipologiaOutro) { errors.tipologiaOutro = true; isValid = false; }
      if (!formData.finalidade || formData.finalidade.length === 0) { errors.finalidade = true; isValid = false; }
      if (!formData.classificacao) { errors.classificacao = true; isValid = false; }
      if (!formData.engineerId) { errors.engineerId = true; isValid = false; }

      setFormErrors(errors);

      if (!isValid) {
          triggerToast("Por favor, preencha todos os campos obrigatórios marcados em vermelho.");
      }

      return isValid;
  };

  const editProtocol = (protocol: Protocolo) => {
      clearErrors();
      setProtocolForm(protocol);
      const city = PARANA_CITIES.find(c => c.name === protocol.municipio);
      setMapState({
          lat: !isNaN(protocol.lat) ? protocol.lat : (city?.lat || -25.4897),
          lng: !isNaN(protocol.lng) ? protocol.lng : (city?.lng || -52.5283),
          zoom: protocol.zoom || 14
      });
      setIsSpecificLocation(!isNaN(protocol.lat));
      setCurrentView('protocolForm');
  };

  const startLaudoFromProtocol = (protocol: Protocolo) => {
      clearErrors();
      let classif = DamageClassification.SEM_DANOS;
      if (protocol.percentualDestruicao === '40%') classif = DamageClassification.PARCIAIS;
      if (protocol.percentualDestruicao === '70%') classif = DamageClassification.SEVEROS;
      if (protocol.percentualDestruicao === '100%') classif = DamageClassification.RUINA;

      const parecerPadrao = PARECER_TEXTS[classif] || '';
      
      setFormData({
          municipio: protocol.municipio,
          data: protocol.data,
          protocolo: protocol.numeroProtocolo,
          engineerId: loginEngineerId, // Defined from login
          zona: protocol.zona,
          indicacaoFiscal: protocol.indicacaoFiscal,
          indicacaoFiscalParts: protocol.indicacaoFiscalParts,
          inscricaoImobiliaria: protocol.inscricaoImobiliaria,
          matricula: protocol.matricula,
          nirfCib: protocol.nirfCib,
          incra: protocol.incra,
          proprietario: protocol.proprietario,
          requerente: protocol.requerente,
          cpfRequerente: protocol.cpf,
          telefoneRequerente: protocol.telefone,
          endereco: protocol.endereco,
          bairro: protocol.bairro,
          cep: protocol.cep,
          lat: protocol.lat,
          lng: protocol.lng,
          tipologia: '' as BuildingTypology,
          tipologiaOutro: '',
          finalidade: [],
          danos: [],
          classificacao: classif,
          logoEsquerda: BRASAO_PR_LOGO,
          logoDireita: DEFESA_CIVIL_PR_LOGO,
          parecerFinal: parecerPadrao,
          descricaoNivelDestruicao: protocol.descricaoNivelDestruicao
      });

      const city = PARANA_CITIES.find(c => c.name === protocol.municipio);
      setMapState({
          lat: !isNaN(protocol.lat) ? protocol.lat : (city?.lat || -25.4897),
          lng: !isNaN(protocol.lng) ? protocol.lng : (city?.lng || -52.5283),
          zoom: protocol.zoom || 18
      });
      setIsSpecificLocation(!isNaN(protocol.lat));

      setCurrentView('laudoForm');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const createNewProtocol = () => {
      clearErrors();
      setProtocolForm({
          id: '',
          data: getLocalDate(),
          municipio: '',
          numeroProtocolo: '',
          requerente: '',
          cpf: '',
          telefone: '',
          zona: ZoneType.URBANO,
          indicacaoFiscal: '',
          inscricaoImobiliaria: '',
          matricula: '',
          nirfCib: '',
          incra: '',
          proprietario: '',
          endereco: '',
          bairro: '',
          cep: '',
          lat: NaN,
          lng: NaN,
          zoom: 14,
          descricaoNivelDestruicao: '',
          percentualDestruicao: '',
          engineerId: isUserAdmin ? '' : loginEngineerId,
          distributedToId: ''
      });
      setMapState({ lat: -25.4897, lng: -52.5283, zoom: 14 });
      setIsSpecificLocation(false);
      setCurrentView('protocolForm');
  };

  // --- PDF & LOGIN ---

  const captureMap = async () => {
    const mapElement = document.getElementById('map-print-container');
    if (!mapElement) {
        console.error("[CAPTURE] Elemento map-print-container não encontrado");
        return null;
    }

    // Aguarda um tempo generoso para carregamento dos tiles
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
        console.log("[CAPTURE] Iniciando captura do mapa...");
        
        // Armazena dimensões originais para restaurar depois
        const originalWidth = mapElement.style.width;
        const originalHeight = mapElement.style.height;
        const originalZIndex = mapElement.style.zIndex;
        const originalPosition = mapElement.style.position;
        
        // Força dimensões exatas e garante que o container esteja visível e isolado
        mapElement.style.width = '1000px';
        mapElement.style.height = '500px';
        mapElement.style.position = 'fixed'; // Usar fixed para tirar do fluxo e evitar interferências
        mapElement.style.top = '0';
        mapElement.style.left = '0';
        mapElement.style.zIndex = '9999';
        
        // Notifica o Leaflet sobre a mudança de tamanho
        window.dispatchEvent(new Event('resize'));
        await new Promise(resolve => setTimeout(resolve, 500));

        // Força o recentralização no ponto exato antes da captura (INSTANTÂNEO)
        if (mapPickerRef.current) {
            mapPickerRef.current.recenter(true);
        }
        
        // Aguarda um tempo maior para garantir que os tiles carreguem e o mapa se ajuste
        await new Promise(resolve => setTimeout(resolve, 3000));

        const container = mapElement.querySelector('.leaflet-container') as HTMLElement || mapElement;
        
        // Capturamos o container com dimensões explícitas para evitar faixas cinzas
        const canvas = await html2canvas(container, {
            useCORS: true,
            allowTaint: false,
            scale: 1.5,
            backgroundColor: '#ffffff',
            logging: false,
            width: 1000,
            height: 500,
            imageTimeout: 60000,
            onclone: (clonedDoc) => {
                const clonedMap = clonedDoc.querySelector('.leaflet-container') as HTMLElement;
                if (clonedMap) {
                    clonedMap.style.width = '1000px';
                    clonedMap.style.height = '500px';
                    clonedMap.style.margin = '0';
                    clonedMap.style.padding = '0';
                    clonedMap.style.overflow = 'hidden';
                    
                    // Esconde TODOS os controles do Leaflet (incluindo atribuição que causa a faixa cinza)
                    const controls = clonedMap.querySelectorAll('.leaflet-control-container, .leaflet-control, .leaflet-control-attribution');
                    controls.forEach((el: any) => el.style.display = 'none');

                    // Corrige transformações 3D para o html2canvas
                    const panes = clonedMap.querySelectorAll('.leaflet-pane, .leaflet-tile-container');
                    panes.forEach((pane: any) => {
                        if (pane.style.transform) {
                            pane.style.transform = pane.style.transform.replace('translate3d', 'translate').replace(/,\s*0px\)$/, ')');
                        }
                    });

                    // Garante que as imagens de tiles estejam visíveis
                    const images = clonedMap.querySelectorAll('img');
                    images.forEach((img: HTMLImageElement) => {
                        img.setAttribute('crossOrigin', 'anonymous');
                        img.style.visibility = 'visible';
                        img.style.opacity = '1';
                        img.style.display = 'block';
                    });
                }

                // Limpeza de cores modernas (oklch) que o html2canvas não entende
                const all = clonedDoc.querySelectorAll('*');
                all.forEach((el: any) => {
                    try {
                        const style = window.getComputedStyle(el);
                        if (style.color.includes('oklch')) el.style.color = '#000000';
                        if (style.backgroundColor.includes('oklch')) el.style.backgroundColor = 'transparent';
                    } catch (e) {}
                });
            }
        });

        const dataUrl = canvas.toDataURL('image/png', 1.0);
        console.log("[CAPTURE] Captura concluída. Tamanho da string:", dataUrl.length);
        
        // Restaura dimensões originais
        mapElement.style.width = originalWidth;
        mapElement.style.height = originalHeight;
        mapElement.style.zIndex = originalZIndex;
        mapElement.style.position = originalPosition;
        window.dispatchEvent(new Event('resize'));
        
        return dataUrl.length > 3000 ? dataUrl : null;
    } catch (e) {
        console.error("[CAPTURE] Erro crítico ao capturar mapa:", e);
        return null;
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handlePreview = async () => {
    if (!validateLaudoForm()) return;
    if (!selectedEngineer) { alert("Responsável Técnico não identificado."); return; }
    if (!formData.classificacao) { alert("Selecione a classificação"); return; }

    setIsLoading(true);
    try {
        const mapImg = await captureMap();
        if (!mapImg) {
            console.warn("[PREVIEW] Mapa não capturado.");
        }
        
        const url = await generateLaudoPDF(
          { ...formData, id_laudo: idLaudo }, selectedEngineer, 'preview', mapImg || undefined, isSpecificLocation
        );
        if (url && typeof url === 'string') { 
            // Revoke previous blob URL if it exists and is a blob URL
            if (previewUrl && previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(previewUrl);
            }
            setPreviewUrl(url); 
            setShowPreviewModal(true);
        }
    } catch (e) {
        console.error("Erro no preview:", e);
    } finally {
        setIsLoading(false);
    }
  };

  const handleDownload = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (!validateLaudoForm()) return;
    if (!selectedEngineer) { alert("Responsável Técnico não identificado."); return; }
    if (!formData.classificacao) { alert("Selecione a classificação"); return; }
    
    setIsLoading(true);
    try {
        const mapImg = await captureMap();
        
        if (!mapImg) {
            // Se falhar a captura, avisamos o usuário mas permitimos continuar
            // No ambiente de iframe do AI Studio, capturas de tela complexas podem falhar por segurança (CORS)
            const msg = "Aviso: Não foi possível capturar a imagem do mapa automaticamente. Para garantir a captura, use a opção 'Abrir em nova aba'.";
            triggerToast(msg);
        }

        // 1. Gerar blob para upload, download e e-mail
        const pdfBlob = await generateLaudoPDF({ ...formData, id_laudo: idLaudo }, selectedEngineer, 'blob', mapImg || undefined, isSpecificLocation) as Blob;
        
        if (!pdfBlob) {
            throw new Error("Falha ao gerar o arquivo PDF.");
        }

        // 2. Download local imediato
        const fileName = getLaudoFilename(formData);
        const downloadUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);

        let pdfUrl = '';
        const uploadFileName = `${Date.now()}_${fileName}`;

        // 3. Upload para Cloudflare R2 (Usando Presigned URL para evitar limites do Vercel)
        console.log("[UPLOAD] Obtendo Presigned URL para upload direto...");
        try {
            const presignedResponse = await fetch('/api/presigned-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: uploadFileName,
                    contentType: 'application/pdf'
                }),
            });

            if (presignedResponse.ok) {
                const { uploadUrl, publicUrl: generatedPublicUrl } = await presignedResponse.json();
                console.log("[UPLOAD] Fazendo upload direto para Cloudflare...");
                
                const directUploadResponse = await fetch(uploadUrl, {
                    method: 'PUT',
                    body: pdfBlob,
                    headers: { 'Content-Type': 'application/pdf' }
                });

                if (directUploadResponse.ok) {
                    pdfUrl = generatedPublicUrl;
                    console.log("[UPLOAD] Upload direto concluído com sucesso. URL:", pdfUrl);
                } else {
                    const status = directUploadResponse.status;
                    console.error("[UPLOAD] Falha no upload direto. Status:", status);
                    triggerToast(`Aviso: O laudo foi baixado, mas o upload para a nuvem falhou (Status: ${status}).`);
                }
            } else {
                const errorText = await presignedResponse.text();
                console.error("[UPLOAD] Falha ao obter Presigned URL:", errorText);
                triggerToast(`Aviso: O laudo foi baixado, mas não pôde ser salvo na nuvem.`);
            }
        } catch (uploadErr: any) {
            console.error("[UPLOAD] Erro no processo de upload:", uploadErr);
            triggerToast(`Aviso: O laudo foi baixado, mas o upload falhou: ${uploadErr.message}`);
        }

        // 4. Preparar conteúdo para E-mail
        // Só calculamos o base64 se o upload falhou E o arquivo for pequeno o suficiente para o Vercel (aprox 3MB para segurança com base64)
        let base64Content: string | undefined = undefined;
        const MAX_VERCEL_PAYLOAD = 3 * 1024 * 1024; // 3MB (seguro para Vercel 4.5MB após base64)

        if (!pdfUrl) {
            if (pdfBlob.size < MAX_VERCEL_PAYLOAD) {
                console.log(`[EMAIL] Upload falhou (tamanho: ${pdfBlob.size} bytes), usando fallback base64...`);
                const arrayBuffer = await pdfBlob.arrayBuffer();
                const bytes = new Uint8Array(arrayBuffer);
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                base64Content = btoa(binary);
            } else {
                console.warn(`[EMAIL] Upload falhou e arquivo (${pdfBlob.size} bytes) é muito grande para fallback base64.`);
                // Não alertamos aqui para não acumular alerts, o erro final do e-mail será mais informativo
            }
        }

        // 5. Enviar E-mail
        console.log("[EMAIL] Iniciando envio de e-mail...");
        try {
            const emailPayload = {
                subject: `Laudo Técnico de Imóvel - Protocolo ${formData.protocolo}`,
                html: `
                    <div style="font-family: sans-serif; color: #1e3a8a;">
                        <h2 style="color: #1e3a8a;">Defesa Civil do Paraná</h2>
                        <p>Informamos que o laudo técnico referente à vistoria do imóvel localizado em <strong>${formData.municipio}</strong> foi gerado com sucesso.</p>
                        <p><strong>Protocolo:</strong> ${formData.protocolo}</p>
                        <p><strong>Requerente:</strong> ${formData.requerente}</p>
                        <p>O documento oficial segue em anexo a este e-mail para sua conferência.</p>
                        ${pdfUrl ? `<p><strong>Link Permanente:</strong> <a href="${pdfUrl}">${pdfUrl}</a></p>` : '<p style="color: #dc2626;">Nota: O arquivo não pôde ser salvo na nuvem, mas foi anexado diretamente (se permitido pelo tamanho).</p>'}
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                        <p style="font-size: 12px; color: #666;">Este é um e-mail automático gerado pelo Sistema de Laudos da Defesa Civil.</p>
                    </div>
                `,
                fileName: fileName,
                fileUrl: pdfUrl || undefined,
                fileBufferBase64: base64Content
            };

            console.log(`[EMAIL] Enviando payload. Tamanho base64: ${base64Content?.length || 0}, URL: ${pdfUrl || 'N/A'}`);

            const emailResponse = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(emailPayload),
            });
            
            if (emailResponse.ok) {
                console.log("[EMAIL] E-mail enviado com sucesso!");
                triggerToast("Sucesso! Laudo gerado, baixado e enviado por e-mail.");
            } else {
                const status = emailResponse.status;
                const errorText = await emailResponse.text();
                let errorMessage = errorText;
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.error || errorText;
                } catch (e) { }
                
                console.error(`[EMAIL] Erro no servidor (Status: ${status}):`, errorMessage);
                
                if (status === 413 || errorMessage.includes('TOO_LARGE')) {
                    triggerToast("Erro: O arquivo PDF é muito grande para ser enviado por e-mail.");
                } else {
                    triggerToast(`Aviso: O laudo foi baixado, mas o envio do e-mail falhou.`);
                }
            }
        } catch (emailErr) {
            console.error("[EMAIL] Falha ao processar e-mail:", emailErr);
            triggerToast(`Erro no processamento do E-mail.`);
        }

        // Registrar Histórico (Apenas se o upload funcionou ou se não era necessário)
        if (formData.protocolo) {
            // Encontrar ID do protocolo pelo numeroProtocolo
            const protocol = protocols.find(p => p.numeroProtocolo === formData.protocolo);
            if (protocol) {
                const historyEntry = {
                    protocol_id: protocol.id,
                    engineer_id: selectedEngineer.id,
                    engineer_name: selectedEngineer.name,
                    created_at: new Date().toISOString(),
                    pdf_url: pdfUrl || undefined // Only save if we have a URL
                };

                const { data: insertedData, error } = await supabase.from('laudo_history').insert(historyEntry).select();
                if (!error && insertedData) {
                    // Atualização otimista
                    setLaudoHistory(prev => [...prev, insertedData[0]]);
                } else if (error) {
                    console.error("Erro ao salvar histórico no Supabase:", error);
                }
            }
        }

        setTimeout(() => {
             const nextId = (parseInt(idLaudo) + 1).toString();
             setIdLaudo(nextId);
             localStorage.setItem('laudo_seq', nextId);
             triggerToast("Laudo gerado e salvo com sucesso!");
             setCurrentView('protocolList');
        }, 1000);
    } catch (e) {
        console.error("Erro no download:", e);
    } finally {
        setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoading(true);

    try {
        if (isAdminLoginMode) {
            if (adminUsername === 'admin' && loginPassword === 'admin') {
                setIsUserAdmin(true);
                setIsAuthenticated(true);
                setLoginEngineerId('');
                setCurrentView('protocolList');
            } else {
                setLoginError('Credenciais de administrador inválidas.');
            }
        } else {
            if (!loginEngineerId) { 
                setLoginError('Selecione um Responsável Técnico.'); 
                setIsLoading(false);
                return; 
            }

            const { data, error } = await supabase.rpc('check_engineer_credentials', {
                p_id: loginEngineerId,
                p_password: loginPassword
            });

            if (error) {
                console.error('RPC Error:', error);
                setLoginError('Erro no sistema de login. Contate o suporte.');
            } else if (data === true) {
                setIsUserAdmin(false);
                setIsAuthenticated(true);
                setCurrentView('protocolList');
            } else {
                setLoginError('Senha incorreta.');
            }
        }
    } catch(err) {
        setLoginError('Erro de conexão.');
    } finally {
        setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentView('login');
    setLoginEngineerId('');
    setEngineerSearch('');
    setLoginPassword('');
    setLoginError('');
    setIsUserAdmin(false);
    setAdminUsername('');
  };

  const saveEngineer = async () => {
    if (!newEngineer.name || !newEngineer.crea) return alert("Preencha nome e CREA");
    setIsLoading(true);
    
    try {
        if (editingEngineer) {
            const updates: any = {
                name: newEngineer.name,
                crea: newEngineer.crea,
                state: newEngineer.state,
                institution: newEngineer.institution || 'Voluntário',
            };

            if (newEngineer.password && newEngineer.password.trim() !== '') {
                updates.password = newEngineer.password;
            }

            const { error } = await supabase
                .from('engineers')
                .update(updates)
                .eq('id', editingEngineer.id);

            if (error) throw error;

            setEngineers(prev => {
                const updatedList = prev.map(e => 
                    e.id === editingEngineer.id ? { ...e, ...updates } : e
                );
                return updatedList.sort((a, b) => a.name.localeCompare(b.name));
            });

        } else {
            const newId = crypto.randomUUID();
            const passwordToSave = newEngineer.password || getDefaultPassword(newEngineer.name!);
            const newEng = { 
                id: newId, 
                name: newEngineer.name!, 
                crea: newEngineer.crea!, 
                state: newEngineer.state, 
                institution: newEngineer.institution || 'Voluntário', 
                isCustom: true,
                password: passwordToSave,
                active: true // Default to active
            };

            const { error } = await supabase.from('engineers').insert(newEng);
            if (error) throw error;

            setEngineers(prev => {
                const newList = [...prev, newEng];
                return newList.sort((a, b) => a.name.localeCompare(b.name));
            });
            
            if (!isAuthenticated) setLoginEngineerId(newId);
        }

        setShowEngineerModal(false);
        alert("Dados salvos com sucesso!");

    } catch(err: any) {
        console.error(err);
        alert("Erro ao salvar: " + err.message);
    } finally {
        setIsLoading(false);
    }
  };

  const handleEditSelf = () => {
    const engineer = engineers.find(e => e.id === loginEngineerId);
    if (engineer) {
        setEditingEngineer(engineer);
        setNewEngineer({ ...engineer, password: '' }); 
        setShowEngineerModal(true);
    }
  };

  const handleManageUsers = () => {
      setCurrentView('manageUsers');
  };

  const handleEditUserAsAdmin = (eng: Engineer) => {
      setEditingEngineer(eng);
      setNewEngineer({ ...eng, password: '' });
      setShowEngineerModal(true);
  }

  const handleNewUserAsAdmin = () => {
      setEditingEngineer(null);
      setNewEngineer({ state: 'PR', institution: 'Voluntário', name: '', crea: '' });
      setShowEngineerModal(true);
  }

  const handleDeleteHistory = (historyId: string) => {
      setHistoryToDeleteId(historyId);
      setProtocolToDelete(null);
      setDeletePassword('');
      setDeleteError('');
      setShowDeleteModal(true);
  };

  const confirmDeleteHistory = async () => {
      if (!historyToDeleteId) return;
      if (!deletePassword) { setDeleteError('Digite sua senha para confirmar.'); return; }
      
      setIsLoading(true);
      setDeleteError('');

      try {
          // Requirement: Deletion only possible with admin password
          if (deletePassword !== 'admin') {
              setDeleteError('Senha de administrador incorreta. Exclusão não permitida.');
              setIsLoading(false);
              return;
          }

          const entry = laudoHistory.find(h => h.id === historyToDeleteId);
          if (!entry) {
              setDeleteError("Registro não encontrado.");
              setIsLoading(false);
              return;
          }

          // 1. Delete from Storage if URL exists
          if (entry.pdf_url) {
              // Extract filename from public URL
              const urlParts = entry.pdf_url.split('/');
              const fileName = urlParts[urlParts.length - 1].split('?')[0]; // Remove query params if any
              
              if (fileName) {
                  try {
                      console.log(`[STORAGE] Solicitando exclusão do arquivo: ${fileName}`);
                      const deleteResponse = await fetch(`${window.location.origin}/api/storage`, {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ fileNames: [fileName] }),
                      });
                      if (!deleteResponse.ok) {
                          const errorData = await deleteResponse.json();
                          console.warn("Aviso: Erro ao remover arquivo do Storage via API:", errorData);
                      } else {
                          console.log(`[STORAGE] Arquivo ${fileName} removido com sucesso.`);
                      }
                  } catch (storageErr) {
                      console.warn("Aviso: Falha na comunicação para remover arquivo do Storage:", storageErr);
                  }
              }
          }

          // 2. Delete from Database
          const { error } = await supabase.from('laudo_history').delete().eq('id', historyToDeleteId);
          if (error) throw error;
          
          setLaudoHistory(prev => prev.filter(h => h.id !== historyToDeleteId));
          closeDeleteModal();
          console.log("History deleted successfully from database");
      } catch (err: any) {
          console.error("Error deleting history:", err);
          setDeleteError("Erro ao excluir histórico: " + err.message);
      } finally {
          setIsLoading(false);
      }
  };


  // --- SUB-RENDER FUNCTIONS ---

  const renderProtocolList = () => {
      // Apply Filters
      const filteredProtocols = protocols.filter(p => {
          const matchCity = !filterCity || p.municipio === filterCity;
          const matchDate = !filterDate || p.data === filterDate;
          const matchEngineer = !filterEngineer || p.distributedToId === filterEngineer;
          const matchProtocol = !filterProtocolNumber || (p.numeroProtocolo && p.numeroProtocolo.toLowerCase().includes(filterProtocolNumber.toLowerCase()));
          
          const hasLaudo = laudoHistory.some(h => h.protocol_id === p.id);
          const matchStatus = filterLaudoStatus === 'all' || 
                             (filterLaudoStatus === 'issued' && hasLaudo) || 
                             (filterLaudoStatus === 'pending' && !hasLaudo);

          return matchCity && matchDate && matchEngineer && matchStatus && matchProtocol;
      }).sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : new Date(a.data).getTime();
          const dateB = b.created_at ? new Date(b.created_at).getTime() : new Date(b.data).getTime();
          return dateB - dateA;
      });

      return (
      <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-blue-600 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                  <div className="bg-blue-100 p-3 rounded-full text-blue-900"><List size={24} /></div>
                  <div>
                      <h2 className="text-xl font-bold text-blue-900 uppercase">Protocolos Registrados</h2>
                      <p className="text-gray-500 text-sm">Gerencie os cadastros iniciais antes de emitir os laudos.</p>
                  </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="relative">
                      <button 
                          onClick={() => setShowColumnToggle(!showColumnToggle)} 
                          className="bg-white border-2 border-gray-200 hover:border-blue-500 text-gray-600 hover:text-blue-600 px-4 py-3 rounded-lg font-bold uppercase flex items-center gap-2 transition-all"
                          title="Personalizar Colunas"
                      >
                          <Columns size={20} /> <span className="hidden sm:inline">Colunas</span>
                      </button>
                      
                      {showColumnToggle && (
                          <>
                              <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[55] md:hidden" onClick={() => setShowColumnToggle(false)} />
                              <div className="absolute left-0 md:left-auto md:right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl border border-gray-200 z-[60] p-4 animate-in fade-in slide-in-from-top-2">
                                  <div className="flex justify-between items-center mb-3 border-b pb-2">
                                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Exibir Colunas</h4>
                                      <button onClick={() => setShowColumnToggle(false)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors"><X size={16}/></button>
                                  </div>
                                  <div className="space-y-1">
                                      {['Data', 'Protocolo', 'Município', 'Requerente', 'Distribuído Para', 'Status'].map(col => (
                                          <label key={col} className="flex items-center gap-3 p-2.5 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors group">
                                              <div className="relative flex items-center">
                                                  <input 
                                                      type="checkbox" 
                                                      className="peer w-5 h-5 rounded border-2 border-gray-300 text-blue-600 focus:ring-blue-500 transition-all"
                                                      checked={visibleColumns.includes(col)}
                                                      onChange={(e) => {
                                                          if (e.target.checked) {
                                                              setVisibleColumns([...visibleColumns, col]);
                                                          } else {
                                                              if (visibleColumns.length > 1) {
                                                                  setVisibleColumns(visibleColumns.filter(c => c !== col));
                                                              }
                                                          }
                                                      }}
                                                  />
                                              </div>
                                              <span className="text-sm font-bold text-gray-700 group-hover:text-blue-700 transition-colors">{col}</span>
                                          </label>
                                      ))}
                                  </div>
                                  <div className="mt-3 pt-2 border-t border-gray-100">
                                      <p className="text-[10px] text-gray-400 font-medium text-center italic">Suas preferências são salvas automaticamente.</p>
                                  </div>
                              </div>
                          </>
                      )}
                  </div>
                  <button onClick={createNewProtocol} className="flex-1 md:flex-none bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-bold uppercase shadow-lg flex items-center justify-center gap-2 transition-all">
                      <FilePlus size={20} /> Novo Protocolo
                  </button>
              </div>
          </div>

          {/* Filters Section */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Filtrar por Protocolo</label>
                  <input 
                      type="text" 
                      className={inputClass()} 
                      placeholder="Nº Protocolo..." 
                      value={filterProtocolNumber} 
                      onChange={e => setFilterProtocolNumber(e.target.value)} 
                  />
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Filtrar por Município</label>
                  <select className={inputClass()} value={filterCity || ''} onChange={e => setFilterCity(e.target.value)}>
                      <option value="">Selecione...</option>
                      {Array.from(new Set(protocols.map(p => p.municipio))).sort().map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Filtrar por Distribuído Para</label>
                  <select className={inputClass()} value={filterEngineer || ''} onChange={e => setFilterEngineer(e.target.value)}>
                      <option value="">Selecione...</option>
                      {engineers.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Filtrar por Data</label>
                  <input type="date" className={inputClass()} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status do Laudo</label>
                  <select className={inputClass()} value={filterLaudoStatus} onChange={e => setFilterLaudoStatus(e.target.value as any)}>
                      <option value="all">Todos</option>
                      <option value="issued">Laudo Emitido</option>
                      <option value="pending">Sem Laudo</option>
                  </select>
              </div>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden relative">
              {isLoading && (
                  <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center">
                      <div className="flex items-center gap-3">
                          <Loader2 size={32} className="animate-spin text-blue-600" />
                          <span className="font-bold text-blue-900">Carregando dados...</span>
                      </div>
                  </div>
              )}
              
              {filteredProtocols.length === 0 && !isLoading ? (
                  <div className="p-12 text-center text-gray-500">
                      <List size={48} className="mx-auto mb-4 opacity-20" />
                      <p className="text-lg">Nenhum protocolo encontrado.</p>
                      <p className="text-sm">Tente ajustar os filtros ou clique em "Novo Protocolo".</p>
                  </div>
              ) : (
                  <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300">
                      <table className="w-auto text-left border-collapse">
                          <thead>
                              <tr className="bg-gray-100 border-b border-gray-200 text-gray-600 text-sm uppercase">
                                  {visibleColumns.includes('Data') && <th className="p-4 font-bold whitespace-nowrap">Data</th>}
                                  {visibleColumns.includes('Protocolo') && <th className="p-4 font-bold whitespace-nowrap">Protocolo</th>}
                                  {visibleColumns.includes('Município') && <th className="p-4 font-bold whitespace-nowrap">Município</th>}
                                  {visibleColumns.includes('Requerente') && <th className="p-4 font-bold whitespace-nowrap">Requerente</th>}
                                  {visibleColumns.includes('Distribuído Para') && <th className="p-4 font-bold whitespace-nowrap">Distribuído Para</th>}
                                  {visibleColumns.includes('Status') && <th className="p-4 font-bold text-center whitespace-nowrap">Status</th>}
                                  <th className="p-4 font-bold text-center">Ações</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {filteredProtocols.map(p => {
                                  const history = laudoHistory.filter(h => h.protocol_id === p.id);
                                  const hasHistory = history.length > 0;
                                  
                                  return (
                                  <tr key={p.id} className="hover:bg-blue-50 transition-colors group">
                                      {visibleColumns.includes('Data') && (
                                          <td className="p-4 text-sm font-medium whitespace-nowrap">
                                              {(p.data || '').split('-').reverse().join('/')}
                                          </td>
                                      )}
                                      {visibleColumns.includes('Protocolo') && (
                                          <td className="p-4 text-sm font-bold text-blue-900 whitespace-nowrap">
                                              {p.numeroProtocolo}
                                          </td>
                                      )}
                                      {visibleColumns.includes('Município') && (
                                          <td className="p-4 text-sm whitespace-nowrap">
                                              {p.municipio}
                                          </td>
                                      )}
                                      {visibleColumns.includes('Requerente') && (
                                          <td className="p-4 text-sm whitespace-nowrap">
                                              {p.requerente}
                                          </td>
                                      )}
                                      {visibleColumns.includes('Distribuído Para') && (
                                          <td className="p-4 text-sm whitespace-nowrap">
                                              {p.distributedToId ? (engineers.find(e => e.id === p.distributedToId)?.name || 'N/A') : <span className="text-gray-400 italic">Pendente</span>}
                                          </td>
                                      )}
                                      {visibleColumns.includes('Status') && (
                                          <td className="p-4 text-center whitespace-nowrap">
                                              {hasHistory ? (
                                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                                      Emitido
                                                  </span>
                                              ) : (
                                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                                      Pendente
                                                  </span>
                                              )}
                                          </td>
                                      )}
                                      <td className="p-4">
                                          <div className="flex items-center justify-center gap-2 relative min-w-[120px]">
                                              {/* Edit / View Button */}
                                              <button 
                                                  type="button" 
                                                  onClick={() => editProtocol(p)} 
                                                  className={`p-2 rounded ${isUserAdmin || p.engineerId === loginEngineerId ? 'text-blue-600 hover:bg-blue-100' : 'text-gray-500 hover:bg-gray-100'}`} 
                                                  title={isUserAdmin || p.engineerId === loginEngineerId ? "Editar Protocolo" : "Visualizar Protocolo"}
                                              >
                                                  {isUserAdmin || p.engineerId === loginEngineerId ? <Edit size={16}/> : <Eye size={16}/>}
                                              </button>
                                              
                                              <HistoryButton 
                                                  protocol={p}
                                                  history={history}
                                                  isUserAdmin={isUserAdmin}
                                                  currentEngineerId={loginEngineerId}
                                                  onStartLaudo={startLaudoFromProtocol}
                                                  onDeleteHistory={handleDeleteHistory}
                                                  onPreviewHistory={(url) => { 
                                                      if (previewUrl && previewUrl.startsWith('blob:')) {
                                                          URL.revokeObjectURL(previewUrl);
                                                      }
                                                      setPreviewUrl(url); 
                                                      setShowPreviewModal(true); 
                                                   }}
                                              />

                                              <button type="button" onClick={() => handleDeleteProtocol(p.id)} className="p-2 text-red-600 hover:bg-red-100 rounded" title="Excluir"><Trash2 size={16}/></button>
                                          </div>
                                      </td>
                                  </tr>
                              )})}
                          </tbody>
                      </table>
                  </div>
              )}
          </div>
      </div>
      );
  };

  const fetchPropertyData = async (municipio: string) => {
      if (!municipio) return;
      setIsLoading(true);
      try {
          const { data, error } = await supabase
              .from('property_data')
              .select('*')
              .eq('municipio', municipio)
              .order('logradouro', { ascending: true })
              .limit(500); // Limit for performance
          
          if (error) throw error;
          setPropertyData(data || []);
      } catch (err) {
          console.error("Erro ao buscar dados:", err);
          triggerToast("Erro ao carregar dados cadastrais.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !importMunicipio) {
          triggerToast("Selecione o município e o arquivo Excel.");
          return;
      }

      setIsImporting(true);
      setImportProgress(0);

      try {
          const reader = new FileReader();
          reader.onload = async (evt) => {
              const bstr = evt.target?.result;
              const wb = XLSX.read(bstr, { type: 'binary' });
              const wsname = wb.SheetNames[0];
              const ws = wb.Sheets[wsname];
              const data = XLSX.utils.sheet_to_json(ws) as any[];

              if (data.length === 0) {
                  triggerToast("Arquivo Excel vazio.");
                  setIsImporting(false);
                  return;
              }

              // Map columns (case-insensitive search)
              const findCol = (row: any, ...names: string[]) => {
                  const keys = Object.keys(row);
                  for (const name of names) {
                      const found = keys.find(k => k.toUpperCase().trim() === name.toUpperCase());
                      if (found) return found;
                  }
                  return null;
              };

              const firstRow = data[0];
              const colInscricao = findCol(firstRow, 'INSCRIÇÃO MUNICIPAL', 'INSCRICAO MUNICIPAL', 'INSCRICAO', 'INSCRIÇÃO');
              const colIndicacao = findCol(firstRow, 'INDICAÇÃO FISCAL', 'INDICACAO FISCAL', 'INDICACAO', 'INDICAÇÃO');
              const colLogradouro = findCol(firstRow, 'LOGRADOURO', 'ENDEREÇO', 'ENDERECO', 'RUA');
              const colProprietario = findCol(firstRow, 'PROPRIETÁRIO', 'PROPRIETARIO', 'NOME');

              if (!colLogradouro || (!colInscricao && !colIndicacao)) {
                  triggerToast("Colunas obrigatórias não encontradas no Excel.");
                  setIsImporting(false);
                  return;
              }

              const formattedData = data.map(row => ({
                  municipio: importMunicipio,
                  inscricao_municipal: row[colInscricao || '']?.toString() || '',
                  indicacao_fiscal: row[colIndicacao || '']?.toString() || '',
                  logradouro: row[colLogradouro || '']?.toString() || '',
                  proprietario: row[colProprietario || '']?.toString() || ''
              }));

              // Delete existing data for this municipio first
              const { error: deleteError } = await supabase
                  .from('property_data')
                  .delete()
                  .eq('municipio', importMunicipio);
              
              if (deleteError) throw deleteError;

              // Upload in chunks of 500
              const chunkSize = 500;
              for (let i = 0; i < formattedData.length; i += chunkSize) {
                  const chunk = formattedData.slice(i, i + chunkSize);
                  const { error: uploadError } = await supabase
                      .from('property_data')
                      .insert(chunk);
                  
                  if (uploadError) throw uploadError;
                  setImportProgress(Math.round(((i + chunk.length) / formattedData.length) * 100));
              }

              triggerToast("Importação concluída com sucesso!");
              fetchPropertyData(importMunicipio);
              setIsImporting(false);
          };
          reader.readAsBinaryString(file);
      } catch (err) {
          console.error("Erro na importação:", err);
          triggerToast("Erro durante a importação do arquivo.");
          setIsImporting(false);
      }
  };

  const renderManagePropertyData = () => (
      <div className="space-y-6">
          <div className="flex justify-between items-center">
              <button onClick={() => setCurrentView('protocolList')} className="flex items-center gap-2 text-blue-900 font-bold hover:text-orange-600 transition-colors">
                  <ArrowLeft size={20} /> VOLTAR PARA LISTA
              </button>
              <h2 className="text-2xl font-bold text-blue-900 uppercase flex items-center gap-2"><Database className="text-orange-500"/> Gestão de Dados Cadastrais</h2>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
              <h3 className="font-bold text-blue-900 uppercase mb-4 flex items-center gap-2"><Upload className="text-orange-500"/> Importar Novo Cadastro (Excel)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Município</label>
                      <CityAutocomplete 
                          cities={PARANA_CITIES}
                          selectedCity={importMunicipio} 
                          onSelect={(val) => {
                              setImportMunicipio(val);
                              if (val) fetchPropertyData(val);
                          }} 
                      />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Arquivo Excel (.xlsx, .xls)</label>
                      <div className="relative">
                          <input 
                              type="file" 
                              accept=".xlsx, .xls" 
                              onChange={handleImportExcel}
                              disabled={isImporting || !importMunicipio}
                              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                      </div>
                  </div>
              </div>

              {isImporting && (
                  <div className="mt-6 space-y-2">
                      <div className="flex justify-between text-xs font-bold text-blue-900 uppercase">
                          <span>Processando Importação...</span>
                          <span>{importProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-orange-500 h-2 rounded-full transition-all duration-300" style={{ width: `${importProgress}%` }}></div>
                      </div>
                  </div>
              )}

              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <h4 className="text-sm font-bold text-blue-900 uppercase mb-2 flex items-center gap-2"><AlertTriangle size={16} className="text-orange-500"/> Instruções Importantes</h4>
                  <ul className="text-xs text-blue-800 space-y-1 list-disc pl-4">
                      <li>O arquivo deve conter as colunas: <strong>INSCRIÇÃO MUNICIPAL</strong>, <strong>INDICAÇÃO FISCAL</strong>, <strong>LOGRADOURO</strong> e <strong>PROPRIETÁRIO</strong>.</li>
                      <li>Ao importar para um município, os dados anteriores daquele município serão <strong>substituídos</strong>.</li>
                      <li>Certifique-se de que os dados estão limpos e sem linhas vazias no topo.</li>
                  </ul>
              </div>
          </div>

          {importMunicipio && (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                  <div className="bg-blue-900 p-4 text-white flex justify-between items-center">
                      <h3 className="font-bold uppercase flex items-center gap-2"><List size={20}/> Registros em {importMunicipio}</h3>
                      <span className="text-xs bg-blue-800 px-2 py-1 rounded">{propertyData.length} registros exibidos</span>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-bold">
                              <tr>
                                  <th className="px-4 py-3">Logradouro</th>
                                  <th className="px-4 py-3">Proprietário</th>
                                  <th className="px-4 py-3">Indicação Fiscal</th>
                                  <th className="px-4 py-3">Inscrição Mun.</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {isLoading ? (
                                  <tr>
                                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                          <Loader2 className="animate-spin mx-auto mb-2" /> Carregando dados...
                                      </td>
                                  </tr>
                              ) : propertyData.length === 0 ? (
                                  <tr>
                                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500 italic">Nenhum dado cadastrado para este município.</td>
                                  </tr>
                              ) : (
                                  propertyData.map((item, idx) => (
                                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                          <td className="px-4 py-3 font-medium">{item.logradouro}</td>
                                          <td className="px-4 py-3">{item.proprietario}</td>
                                          <td className="px-4 py-3 font-mono text-xs">{item.indicacao_fiscal}</td>
                                          <td className="px-4 py-3 font-mono text-xs">{item.inscricao_municipal}</td>
                                      </tr>
                                  ))
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}
      </div>
  );

  const renderManageUsers = () => (
      <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button onClick={() => setCurrentView('protocolList')} className="text-gray-500 hover:text-blue-900 font-bold flex items-center gap-2"><ArrowLeft size={20}/> Voltar</button>
            <h2 className="text-xl font-bold text-blue-900 uppercase">Gestão de Equipe Técnica</h2>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-blue-600 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                  <div className="bg-blue-100 p-3 rounded-full text-blue-900"><Users size={24} /></div>
                  <div>
                      <h2 className="text-xl font-bold text-blue-900 uppercase">Responsáveis Técnicos</h2>
                      <p className="text-gray-500 text-sm">Gerencie os engenheiros habilitados para emitir laudos.</p>
                  </div>
              </div>
              <button onClick={handleNewUserAsAdmin} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-bold uppercase shadow-lg flex items-center gap-2">
                  <Plus size={20} /> Novo Engenheiro
              </button>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                      <thead>
                          <tr className="bg-gray-100 border-b border-gray-200 text-gray-600 text-sm uppercase">
                              <th className="p-4 font-bold">Nome</th>
                              <th className="p-4 font-bold">CREA</th>
                              <th className="p-4 font-bold">Instituição</th>
                              <th className="p-4 font-bold text-center">Ações</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {engineers.map(eng => (
                              <tr key={eng.id} className="hover:bg-blue-50 transition-colors">
                                  <td className="p-4 text-sm font-bold text-gray-800">{eng.name}</td>
                                  <td className="p-4 text-sm font-medium">{eng.crea} ({eng.state})</td>
                                  <td className="p-4 text-sm">
                                      <span className={`px-2 py-1 rounded text-xs font-bold ${eng.institution === 'CEDEC' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                          {eng.institution}
                                      </span>
                                  </td>
                                  <td className="p-4 text-center flex items-center justify-center gap-2">
                                      <button onClick={() => handleEditUserAsAdmin(eng)} className="text-blue-600 hover:underline text-sm font-bold flex items-center gap-1">
                                          <Edit size={14}/> Editar
                                      </button>
                                      <button 
                                          onClick={() => {
                                              // Toggle active status
                                              const updatedEng = { ...eng, active: !eng.active };
                                              setEngineers(prev => prev.map(e => e.id === eng.id ? updatedEng : e));
                                              // Persist to Supabase
                                              supabase.from('engineers').update({ active: updatedEng.active }).eq('id', eng.id).then(({ error }) => {
                                                  if (error) alert("Erro ao atualizar status: " + error.message);
                                              });
                                          }} 
                                          className={`text-sm font-bold flex items-center gap-1 px-2 py-1 rounded border ${eng.active ? 'text-green-600 border-green-200 bg-green-50 hover:bg-green-100' : 'text-gray-400 border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
                                          title={eng.active ? "Desativar Usuário" : "Ativar Usuário"}
                                      >
                                          {eng.active ? <CheckCircle size={14}/> : <XCircle size={14}/>} {eng.active ? 'Ativo' : 'Inativo'}
                                      </button>
                                      <button 
                                          onClick={() => {
                                              if (window.confirm(`Tem certeza que deseja excluir o usuário ${eng.name}? Esta ação não pode ser desfeita.`)) {
                                                  supabase.from('engineers').delete().eq('id', eng.id).then(({ error }) => {
                                                      if (error) {
                                                          alert("Erro ao excluir usuário: " + error.message);
                                                      } else {
                                                          setEngineers(prev => prev.filter(e => e.id !== eng.id));
                                                      }
                                                  });
                                              }
                                          }}
                                          className="text-red-600 hover:underline text-sm font-bold flex items-center gap-1 ml-2"
                                          title="Excluir Usuário"
                                      >
                                          <Trash2 size={14}/> Excluir
                                      </button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>
  );

  const renderSharedFields = (isProtocol: boolean, state: any, setState: Function, disabled = false, isReadOnly = false) => (
      <div className={disabled && !isReadOnly ? "opacity-50 pointer-events-none grayscale transition-all duration-300" : "transition-all duration-300"}>
        {/* Row 1: Zone */}
        <div className="grid grid-cols-2 gap-6 border-b border-gray-200 pb-6 mb-2">
            <div onClick={() => !disabled && setState((prev:any) => ({...prev, zona: ZoneType.URBANO}))} className={`cursor-pointer flex flex-col md:flex-row items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 ${state.zona === ZoneType.URBANO ? 'border-orange-500 bg-orange-50 shadow-md transform scale-[1.02]' : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-gray-50'} ${isReadOnly ? 'cursor-default pointer-events-none' : ''}`}>
                <div className={`p-3 rounded-full ${state.zona === ZoneType.URBANO ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'}`}><Building size={32} /></div>
                <div className="text-center md:text-left"><h3 className={`font-bold text-lg ${state.zona === ZoneType.URBANO ? 'text-blue-900' : 'text-gray-600'}`}>Zona Urbana</h3></div>
                 {state.zona === ZoneType.URBANO && <div className="hidden md:block ml-auto"><CheckCircle className="text-orange-500" size={24} /></div>}
            </div>
            <div onClick={() => !disabled && setState((prev:any) => ({...prev, zona: ZoneType.RURAL}))} className={`cursor-pointer flex flex-col md:flex-row items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 ${state.zona === ZoneType.RURAL ? 'border-orange-500 bg-orange-50 shadow-md transform scale-[1.02]' : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-gray-50'} ${isReadOnly ? 'cursor-default pointer-events-none' : ''}`}>
                <div className={`p-3 rounded-full ${state.zona === ZoneType.RURAL ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'}`}><Trees size={32} /></div>
                <div className="text-center md:text-left"><h3 className={`font-bold text-lg ${state.zona === ZoneType.RURAL ? 'text-blue-900' : 'text-gray-600'}`}>Zona Rural</h3></div>
                {state.zona === ZoneType.RURAL && <div className="hidden md:block ml-auto"><CheckCircle className="text-orange-500" size={24} /></div>}
            </div>
        </div>

        {/* Row 2: Identifiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
            {state.zona === ZoneType.URBANO ? (
                <>
                    <div>
                        <label className={labelClass}>Indicação Fiscal</label>
                        <div className="relative h-[42px]">
                            <input disabled={disabled} type="text" className={`${inputClass()} ${!isReadOnly && indicacaoFiscalValid === false ? 'border-red-500 ring-1 ring-red-500' : ''} ${!isReadOnly && indicacaoFiscalValid === true ? 'border-green-500 ring-1 ring-green-500' : ''} ${isReadOnly ? 'bg-gray-50 text-gray-700' : ''}`} value={state.indicacaoFiscal} onChange={(e) => handleIndicacaoFiscalChangeGeneric(e.target.value, state.municipio, setState)} onBlur={(e) => handleIndicacaoFiscalBlurGeneric(e.target.value, state.municipio)} placeholder={state.municipio === 'Rio Bonito do Iguaçu' ? "00.00.000.0000.0000.000" : "Digite a Indicação Fiscal..."} />
                            {!isReadOnly && <div className="absolute right-3 top-2.5">{indicacaoFiscalValid === true && <CheckCircle size={20} className="text-green-600" />}{indicacaoFiscalValid === false && <XCircle size={20} className="text-red-600" />}</div>}
                        </div>
                        {!isReadOnly && indicacaoFiscalValid === false && <p className="text-[10px] text-red-600 font-bold mt-1 uppercase">Indicação Fiscal incompleta</p>}
                    </div>
                    <div><label className={labelClass}>Inscrição Municipal</label><input disabled={disabled} type="text" className={`${inputClass()} ${isReadOnly ? 'bg-gray-50 text-gray-700' : ''}`} value={state.inscricaoImobiliaria} onChange={(e) => handleInscricaoChangeGeneric(e.target.value, state.municipio, setState)} /></div>
                    <div><label className={labelClass}>Matrícula</label><input disabled={disabled} type="text" className={`${inputClass()} ${isReadOnly ? 'bg-gray-50 text-gray-700' : ''}`} value={state.matricula} onChange={e => setState((prev:any) => ({...prev, matricula: e.target.value}))} /></div>
                </>
            ) : (
                <>
                    <div><label className={labelClass}>NIRF / CIB</label><input disabled={disabled} type="text" className={`${inputClass()} ${isReadOnly ? 'bg-gray-50 text-gray-700' : ''}`} value={state.nirfCib} onChange={e => setState((prev:any) => ({...prev, nirfCib: e.target.value}))} /></div>
                    <div><label className={labelClass}>INCRA</label><input disabled={disabled} type="text" className={`${inputClass()} ${isReadOnly ? 'bg-gray-50 text-gray-700' : ''}`} value={state.incra} onChange={e => setState((prev:any) => ({...prev, incra: e.target.value}))} /></div>
                    <div><label className={labelClass}>Matrícula</label><input disabled={disabled} type="text" className={`${inputClass()} ${isReadOnly ? 'bg-gray-50 text-gray-700' : ''}`} value={state.matricula} onChange={e => setState((prev:any) => ({...prev, matricula: e.target.value}))} /></div>
                </>
            )}
        </div>

        {/* Row 3: People */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 border-t border-gray-200 pt-6">
            <div className="lg:col-span-1">
                <LabelWithAsterisk>Requerente</LabelWithAsterisk>
                <input disabled={disabled} type="text" className={`${inputClass(formErrors.requerente)} ${isReadOnly ? 'bg-gray-50 text-gray-700' : ''}`} value={state.requerente} onChange={e => setState((prev:any) => ({...prev, requerente: e.target.value}))} />
            </div>
            <div className="lg:col-span-1">
                <LabelWithAsterisk>CPF do Requerente</LabelWithAsterisk>
                <div className="relative h-[42px]">
                    <input disabled={disabled} type="text" className={`${inputClass(formErrors.cpf)} ${!isReadOnly && cpfValid === false ? 'border-red-500 ring-1 ring-red-500' : ''} ${!isReadOnly && cpfValid === true ? 'border-green-500 ring-1 ring-green-500' : ''} ${isReadOnly ? 'bg-gray-50 text-gray-700' : ''}`} value={isProtocol ? state.cpf : state.cpfRequerente} onChange={(e) => handleCpfChangeGeneric(e.target.value, setState, isProtocol)} onBlur={(e) => handleCpfBlurGeneric(e.target.value)} placeholder="000.000.000-00" maxLength={14} />
                    {!isReadOnly && <div className="absolute right-3 top-2.5">{cpfValid === true && <CheckCircle size={20} className="text-green-600" />}{cpfValid === false && <XCircle size={20} className="text-red-600" />}</div>}
                </div>
                {!isReadOnly && cpfValid === false && <p className="text-[10px] text-red-600 font-bold mt-1 uppercase">{cpfErrorMessage || 'CPF Inválido'}</p>}
            </div>
            
            <div className="lg:col-span-1">
                <label className={labelClass}>Telefone para Contato</label>
                <div className="relative">
                    <input disabled={disabled} type="text" className={`${inputClass()} ${isReadOnly ? 'bg-gray-50 text-gray-700' : ''}`} value={isProtocol ? state.telefone : (state.telefoneRequerente || '')} onChange={e => { const val = formatPhone(e.target.value); if(isProtocol) setState((prev:any)=>({...prev, telefone: val})); else setState((prev:any)=>({...prev, telefoneRequerente: val})); }} placeholder="(00) 00000-0000" />
                    <Phone className="absolute right-3 top-2.5 text-gray-400" size={18} />
                </div>
            </div>

            <div className="lg:col-span-1"><label className={labelClass}>Proprietário</label><input disabled={disabled} type="text" className={`${inputClass()} ${autoFilled ? 'bg-green-50 border-green-300 transition-colors duration-500' : ''} ${isReadOnly ? 'bg-gray-50 text-gray-700' : ''}`} value={state.proprietario} onChange={e => setState((prev:any) => ({...prev, proprietario: e.target.value}))} /></div>
        </div>
      </div>
  );

  const renderMapSection = (isProtocol: boolean, state: any, setState: Function, disabled = false, isReadOnly = false) => (
      <div className={`bg-blue-50 p-4 rounded-lg border border-blue-100 relative z-0 mt-6 transition-all duration-300 ${disabled && !isReadOnly ? 'opacity-50 pointer-events-none' : ''}`}>
            {disabled && !isReadOnly && (
                <div className="absolute inset-0 bg-white/60 z-50 flex items-center justify-center backdrop-blur-[1px] rounded-lg">
                    <span className="text-sm font-bold text-gray-500 bg-white px-4 py-2 rounded-full shadow border border-gray-200">
                        Selecione um município para habilitar o mapa
                    </span>
                </div>
            )}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-3 border-b border-blue-200 pb-2">
                <div className="flex flex-col">
                    <label className="block text-sm font-bold text-blue-900 uppercase">Localização Geográfica (Selecione no Mapa)</label>
                    <p className="text-[10px] text-blue-600 font-medium">Dica: Se o mapa não sair no PDF, use o botão "Abrir em nova aba" do AI Studio.</p>
                </div>
                {!isReadOnly && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                        {downloadState.error ? (
                            <div className="flex items-center gap-2 bg-red-100 px-3 py-1.5 rounded-full shadow-sm border border-red-200 w-full justify-center sm:w-auto animate-in fade-in">
                                <AlertTriangle size={14} className="text-red-700"/>
                                <span className="text-xs font-bold text-red-800">Erro</span>
                            </div>
                        ) : downloadState.isPreparing ? (
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-blue-100 justify-center w-full sm:w-auto">
                                <Loader2 size={14} className="animate-spin text-orange-600"/>
                                <span className="text-xs font-bold text-blue-900">Calculando...</span>
                            </div>
                        ) : downloadState.isDownloading ? (
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-blue-100 justify-center">
                                    <Loader2 size={14} className="animate-spin text-orange-600"/>
                                    <span className="text-xs font-bold text-blue-900">
                                        {downloadState.total > 0 ? Math.floor((downloadState.progress / downloadState.total) * 100) : 0}%
                                    </span>
                                </div>
                                <button type="button" onClick={() => mapPickerRef.current?.cancelOfflineDownload()} className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold uppercase rounded border border-red-200">Cancelar</button>
                            </div>
                        ) : downloadState.completed ? (
                            <div className="flex items-center gap-2 bg-green-100 px-3 py-1.5 rounded-full shadow-sm border border-green-200 w-full justify-center sm:w-auto animate-in fade-in slide-in-from-right-2">
                                <Check size={14} className="text-green-700"/>
                                <span className="text-xs font-bold text-green-800">Salvo!</span>
                            </div>
                        ) : (
                            <button type="button" onClick={() => mapPickerRef.current?.triggerOfflineDownload()} className="flex items-center justify-center gap-2 px-3 py-1.5 bg-white border border-gray-300 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 text-gray-600 rounded-lg text-xs font-bold uppercase transition-all shadow-sm w-full sm:w-auto">
                                <DownloadCloud size={14} /> Offline
                            </button>
                        )}
                </div>
                )}
            </div>

            <div id="map-print-container" className={isReadOnly ? "pointer-events-none grayscale-[0.3]" : ""}>
            <MapPicker 
                ref={mapPickerRef}
                key={isProtocol ? protocolForm.id : idLaudo}
                centerLat={mapState.lat} 
                centerLng={mapState.lng} 
                cityName={state.municipio}
                initialZoom={mapState.zoom} 
                onLocationSelect={handleLocationSelect} 
                onZoomChange={(z) => setMapState(prev => ({ ...prev, zoom: z }))} 
                showMarker={isSpecificLocation} 
                onDownloadStateChange={handleDownloadStateChange}
            />
            </div>
        
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-lg border border-gray-200 bg-gray-50 mt-4">
                <div className="md:col-span-2"><LabelWithAsterisk>Endereço</LabelWithAsterisk><input disabled={isReadOnly} type="text" value={state.endereco} onChange={e => setState((prev:any) => ({...prev, endereco: e.target.value}))} className={`${inputClass(formErrors.endereco)} ${autoFilled ? 'bg-green-50 border-green-300 transition-colors duration-500' : ''} ${isReadOnly ? 'bg-gray-100 text-gray-600' : ''}`} /></div>
                <div><label className={labelClass}>Bairro</label><input disabled={isReadOnly} type="text" value={state.bairro} onChange={e => setState((prev:any) => ({...prev, bairro: e.target.value}))} className={`${inputClass(false)} ${isReadOnly ? 'bg-gray-100 text-gray-600' : ''}`} /></div>
                <div><label className={labelClass}>CEP</label><input disabled={isReadOnly} type="text" value={state.cep} onChange={e => setState((prev:any) => ({...prev, cep: e.target.value}))} className={`${inputClass(false)} ${isReadOnly ? 'bg-gray-100 text-gray-600' : ''}`} /></div>
                <div><LabelWithAsterisk>Latitude</LabelWithAsterisk><input disabled={isReadOnly} type="text" defaultValue={isNaN(state.lat) ? '' : state.lat} key={`lat-${state.lat}`} onBlur={(e) => { const val = e.target.value; if (val === '') setState((prev:any)=>({...prev, lat: NaN})); else { const num = parseFloat(val); if (!isNaN(num)) setState((prev:any)=>({...prev, lat: num})); } }} className={`${inputClass(formErrors.location)} ${isReadOnly ? 'bg-gray-100 text-gray-600' : ''}`} /></div>
                <div><LabelWithAsterisk>Longitude</LabelWithAsterisk><input disabled={isReadOnly} type="text" defaultValue={isNaN(state.lng) ? '' : state.lng} key={`lng-${state.lng}`} onBlur={(e) => { const val = e.target.value; if (val === '') setState((prev:any)=>({...prev, lng: NaN})); else { const num = parseFloat(val); if (!isNaN(num)) setState((prev:any)=>({...prev, lng: num})); } }} className={`${inputClass(formErrors.location)} ${isReadOnly ? 'bg-gray-100 text-gray-600' : ''}`} /></div>
            </div>
      </div>
  );

  const renderProtocolFormView = () => {
      const isCitySelected = !!protocolForm.municipio;
      const isEditingExisting = !!protocolForm.id;
      const canEdit = !isEditingExisting || isUserAdmin || protocolForm.engineerId === loginEngineerId;
      const isReadOnly = !canEdit;

      return (
      <div className="space-y-8 relative">
          {isLoading && (
              <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center rounded-xl">
                  <Loader2 size={32} className="animate-spin text-blue-600" />
              </div>
          )}
          <div className="flex items-center justify-between">
            <button onClick={() => setCurrentView('protocolList')} className="text-gray-500 hover:text-blue-900 font-bold flex items-center gap-2"><ArrowLeft size={20}/> Voltar</button>
            <h2 className="text-xl font-bold text-blue-900 uppercase">
                {isReadOnly ? 'Visualizar Protocolo' : (protocolForm.id ? 'Editar Protocolo' : 'Novo Cadastro de Protocolo')}
            </h2>
          </div>

          <section className="bg-white rounded-xl shadow-md border-t-4 border-blue-600 p-6">
               {isReadOnly && (
                   <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                       <div className="flex">
                           <div className="flex-shrink-0">
                               <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                           </div>
                           <div className="ml-3">
                               <p className="text-sm text-yellow-700">
                                   Modo de visualização. Você não tem permissão para editar este protocolo.
                               </p>
                           </div>
                       </div>
                   </div>
               )}

               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div>
                        <LabelWithAsterisk>Município</LabelWithAsterisk>
                        <div className={formErrors.municipio ? 'border-red-500 ring-1 ring-red-500 rounded-md' : ''}>
                           <CityAutocomplete cities={PARANA_CITIES} selectedCity={protocolForm.municipio} onSelect={handleCityChange} disabled={isReadOnly} />
                        </div>
                    </div>
                    <div className={!isCitySelected ? "opacity-50 pointer-events-none" : ""}>
                        <LabelWithAsterisk>Data</LabelWithAsterisk>
                        <input disabled={!isCitySelected || isReadOnly} type="date" className={inputClass(formErrors.data)} value={protocolForm.data} onChange={(e) => setProtocolForm({...protocolForm, data: e.target.value})} />
                    </div>
                    <div className={!isCitySelected ? "opacity-50 pointer-events-none" : ""}>
                        <LabelWithAsterisk>Protocolo</LabelWithAsterisk>
                        <div className="relative h-[42px]">
                            <input disabled={!isCitySelected || isReadOnly} type="text" className={`${inputClass(formErrors.numeroProtocolo)} ${protocoloValid === false ? 'border-red-500 ring-1 ring-red-500' : ''}`} value={protocolForm.numeroProtocolo} onChange={(e) => handleProtocoloChangeGeneric(e.target.value, setProtocolForm)} onBlur={(e) => handleProtocoloBlurGeneric(e.target.value)} placeholder="11.111.111-1" maxLength={12} />
                        </div>
                    </div>
               </div>

               {/* REUSING SHARED FIELDS & MAP */}
               {renderSharedFields(true, protocolForm, setProtocolForm, !isCitySelected || isReadOnly, isReadOnly)}
               {renderMapSection(true, protocolForm, setProtocolForm, !isCitySelected || isReadOnly, isReadOnly)}

               <div className={`mt-8 border-t border-gray-200 pt-6 transition-all duration-300 ${!isCitySelected ? "opacity-50 pointer-events-none" : ""}`}>
                    <h3 className="font-bold text-blue-900 uppercase mb-4 flex items-center gap-2"><AlertTriangle className="text-orange-500"/> Avaliação Preliminar de Danos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <LabelWithAsterisk>Percentual de Nível de Destruição (segundo requerente)</LabelWithAsterisk>
                            <select disabled={!isCitySelected || isReadOnly} className={`${inputClass(formErrors.percentualDestruicao)} ${isReadOnly ? 'bg-gray-100 text-gray-600' : ''}`} value={protocolForm.percentualDestruicao || ''} onChange={(e) => setProtocolForm({...protocolForm, percentualDestruicao: e.target.value as any})}>
                                <option value="">Selecione...</option>
                                <option value="0%">0% (Sem Danos)</option>
                                <option value="40%">Até 40% (Danos Parciais/Leves)</option>
                                <option value="70%">De 41% até 70% (Danos Severos)</option>
                                <option value="100%">100% (Ruína/Destruição Total)</option>
                            </select>
                        </div>
                        <div>
                             <LabelWithAsterisk>Descrição do Nível de Destruição (segundo requerente)</LabelWithAsterisk>
                             <textarea disabled={!isCitySelected || isReadOnly} rows={3} className={`${inputClass(formErrors.descricaoNivelDestruicao)} ${isReadOnly ? 'bg-gray-100 text-gray-600' : ''}`} style={{height: 'auto'}} value={protocolForm.descricaoNivelDestruicao} onChange={(e) => setProtocolForm({...protocolForm, descricaoNivelDestruicao: e.target.value})} placeholder="Descreva brevemente a situação observada..."></textarea>
                        </div>
                    </div>
               </div>

               <div className={`mt-6 border-t border-gray-200 pt-6 transition-all duration-300 ${!isCitySelected ? "opacity-50 pointer-events-none" : ""}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="font-bold text-blue-900 uppercase mb-4 flex items-center gap-2"><User className="text-orange-500"/> <label className={labelClass}>Distribuído Para</label></h3>
                            <select 
                                className={inputClass(formErrors.distributedToId)}
                                value={protocolForm.distributedToId || ''}
                                onChange={(e) => setProtocolForm({...protocolForm, distributedToId: e.target.value})}
                                disabled={isReadOnly}
                            >
                                <option value="">Selecione o Engenheiro...</option>
                                {engineers.filter(e => e.active).map(eng => (
                                    <option key={eng.id} value={eng.id}>
                                        {eng.name} (CREA {eng.crea})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <h3 className="font-bold text-blue-900 uppercase mb-4 flex items-center gap-2"><User className="text-orange-500"/> <LabelWithAsterisk>Cadastrado Por</LabelWithAsterisk></h3>
                            {isUserAdmin ? (
                                <select 
                                    className={inputClass(formErrors.engineerId)}
                                    value={protocolForm.engineerId || ''}
                                    onChange={(e) => setProtocolForm({...protocolForm, engineerId: e.target.value})}
                                >
                                    <option value="">Selecione...</option>
                                    <option value="ADMIN">Administrador (Sistema)</option>
                                    {engineers.filter(e => e.active).map(eng => (
                                        <option key={eng.id} value={eng.id}>
                                            {eng.name} (CREA {eng.crea})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input 
                                    type="text" 
                                    className={`${inputClass(false)} bg-gray-100 cursor-not-allowed text-gray-600`}
                                    value={selectedEngineer ? `${selectedEngineer.name} (CREA ${selectedEngineer.crea})` : 'Usuário Logado'} 
                                    readOnly 
                                />
                            )}
                        </div>
                    </div>
               </div>

               <div className="mt-6 flex justify-end gap-3">
                   <button onClick={() => setCurrentView('protocolList')} className="px-6 py-3 text-gray-600 font-bold uppercase hover:bg-gray-100 rounded-lg">
                       {isReadOnly ? 'Voltar' : 'Cancelar'}
                   </button>
                   {!isReadOnly && (
                       <button onClick={saveProtocol} className="px-8 py-3 bg-blue-900 text-white font-bold uppercase rounded-lg hover:bg-blue-800 shadow-lg flex items-center gap-2">
                           <Save size={20}/> Salvar Protocolo
                       </button>
                   )}
               </div>
          </section>
      </div>
  );
  };

  const renderLaudoFormView = () => {
    return (
      <div className="space-y-8 animate-in fade-in relative">
          {isLoading && (
              <div className="fixed inset-0 bg-white/80 z-[200] flex items-center justify-center">
                  <div className="text-center">
                      <Loader2 size={48} className="animate-spin text-blue-600 mx-auto mb-4" />
                      <p className="font-bold text-blue-900 uppercase tracking-widest">Processando Laudo...</p>
                      <p className="text-xs text-blue-600 mt-2">Capturando mapa e gerando PDF</p>
                  </div>
              </div>
          )}
          <div className="flex items-center justify-between">
             <button onClick={() => setCurrentView('protocolList')} className="text-gray-500 hover:text-blue-900 font-bold flex items-center gap-2"><ArrowLeft size={20}/> Voltar para Lista</button>
             <h2 className="text-xl font-bold text-blue-900 uppercase">Emissão de Laudo Técnico</h2>
          </div>

          <section className="bg-white rounded-xl shadow-md border-t-4 border-blue-600 p-6">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-blue-900 uppercase flex items-center gap-2"><FileText className="text-orange-500"/> Dados Gerais do Protocolo</h3>
                  <div className="text-xs bg-blue-50 text-blue-800 px-3 py-1 rounded-full font-bold border border-blue-100">
                      Protocolo: {formData.protocolo}
                  </div>
              </div>

              {/* SHARED FIELDS (Auto-filled from Protocol) */}
              {renderSharedFields(false, formData, setFormData)}

              {/* MAP SECTION */}
              {renderMapSection(false, formData, setFormData)}
              
              <div className="mt-8 border-t border-gray-200 pt-6">
                <h3 className="font-bold text-blue-900 uppercase mb-4 flex items-center gap-2"><Building className="text-orange-500"/> Tipologia e Finalidade</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <LabelWithAsterisk>Tipologia Construtiva</LabelWithAsterisk>
                        <select className={inputClass(formErrors.tipologia)} value={formData.tipologia || ''} onChange={(e) => setFormData({...formData, tipologia: e.target.value as BuildingTypology})}>
                            <option value="">Selecione...</option>
                            {Object.values(BuildingTypology).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    {formData.tipologia === BuildingTypology.OUTRO && (
                        <div>
                            <LabelWithAsterisk>Especifique</LabelWithAsterisk>
                            <input type="text" className={inputClass(formErrors.tipologiaOutro)} value={formData.tipologiaOutro} onChange={(e) => setFormData({...formData, tipologiaOutro: e.target.value})} placeholder="Ex: Container, Tenda..." />
                        </div>
                    )}
                </div>

                <div className="mt-6">
                    <LabelWithAsterisk>Finalidade da Edificação</LabelWithAsterisk>
                    <div className={`flex flex-wrap gap-6 mt-2 p-3 rounded-lg border ${formErrors.finalidade ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                        {['Residencial', 'Comercial'].map(option => (
                            <label key={option} className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center justify-center">
                                    <input 
                                        type="checkbox" 
                                        className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-gray-300 bg-white checked:border-orange-500 checked:bg-orange-500 transition-all"
                                        checked={formData.finalidade.includes(option)}
                                        onChange={(e) => {
                                            const newFinalidade = e.target.checked 
                                                ? [...formData.finalidade, option]
                                                : formData.finalidade.filter(f => f !== option);
                                            
                                            const isComercial = newFinalidade.includes('Comercial');
                                            const newParecer = isComercial ? PARECER_COMERCIAL : (PARECER_TEXTS[formData.classificacao] || '');
                                            
                                            setFormData({...formData, finalidade: newFinalidade, parecerFinal: newParecer});
                                        }}
                                    />
                                    <Check className="absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" strokeWidth={4} />
                                </div>
                                <span className="text-sm font-bold text-blue-900 uppercase group-hover:text-orange-600 transition-colors">{option}</span>
                            </label>
                        ))}
                    </div>
                    {formErrors.finalidade && <p className="text-red-500 text-xs mt-1 font-bold">Selecione pelo menos uma finalidade.</p>}
                </div>
              </div>

              <div className="mt-8 border-t border-gray-200 pt-6">
                <h3 className="font-bold text-blue-900 uppercase mb-4 flex items-center gap-2"><AlertTriangle className="text-orange-500"/> Danos Identificados</h3>
                <DamageInput value={formData.danos} onChange={(newDanos) => setFormData({...formData, danos: newDanos})} />
              </div>

              <div className="mt-8 border-t border-gray-200 pt-6">
                <h3 className="font-bold text-blue-900 uppercase mb-4 flex items-center gap-2"><ShieldCheck className="text-orange-500"/> Parecer Técnico Final</h3>
                <div className="grid grid-cols-1 gap-6">
                    <div>
                        <label className={labelClass}>Descrição do Nível de Destruição (Segundo Requerente)</label>
                        <textarea 
                            disabled 
                            rows={3} 
                            className={`${inputClass()} bg-gray-100 text-gray-600 mb-4 h-auto`} 
                            value={formData.descricaoNivelDestruicao || ''} 
                        />
                    </div>

                    <div>
                        <LabelWithAsterisk>Classificação do Dano (Lei 22.787/2025)</LabelWithAsterisk>
                        <select className={`${inputClass(formErrors.classificacao)} font-bold text-blue-900`} value={formData.classificacao || ''} onChange={handleClassificationChange}>
                            <option value="">Selecione...</option>
                            {Object.values(DamageClassification).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    
                    {formData.classificacao && (
                        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 animate-in fade-in">
                            <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                                <div><span className="font-bold text-gray-500">Nível de Destruição:</span> <span className="font-bold text-orange-700">{damageStats.level}</span></div>
                                <div><span className="font-bold text-gray-500">Percentual Estimado:</span> <span className="font-bold text-orange-700">{damageStats.percent}</span></div>
                            </div>
                            <label className={labelClass}>Texto do Parecer (Editável)</label>
                            <textarea 
                                rows={6} 
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-3 text-sm bg-white"
                                value={formData.parecerFinal}
                                onChange={(e) => setFormData({...formData, parecerFinal: e.target.value})}
                            />
                        </div>
                    )}
                </div>
              </div>

              <div className="mt-8 border-t border-gray-200 pt-6">
                   <h3 className="font-bold text-blue-900 uppercase mb-4 flex items-center gap-2"><User className="text-orange-500"/> Responsável Técnico pelo Laudo</h3>
                   {isUserAdmin ? (
                       <select 
                           className={inputClass(formErrors.engineerId)}
                           value={formData.engineerId || ''}
                           onChange={(e) => setFormData({...formData, engineerId: e.target.value})}
                       >
                           <option value="">Selecione...</option>
                           {engineers.filter(e => e.active).map(eng => (
                               <option key={eng.id} value={eng.id}>
                                   {eng.name} (CREA {eng.crea})
                               </option>
                           ))}
                       </select>
                   ) : (
                       <input 
                           type="text" 
                           className={`${inputClass()} bg-gray-100 cursor-not-allowed text-gray-600`}
                           value={selectedEngineer ? `${selectedEngineer.name} (CREA ${selectedEngineer.crea})` : 'Usuário Logado'} 
                           readOnly 
                       />
                   )}
              </div>

              <div className="mt-8 border-t-2 border-gray-100 pt-6 flex flex-col md:flex-row justify-end gap-3 relative">
                   {showCustomization && (
                      <div className="absolute bottom-16 left-0 bg-white/[0.97] backdrop-blur-sm p-4 rounded-xl shadow-xl border border-gray-200 animate-in slide-in-from-bottom-2 z-10 w-72">
                          <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 border-b pb-2">Personalizar Cabeçalho (PDF)</h4>
                          
                          <div className="space-y-3">
                              <div>
                                  <label className="block text-[10px] font-bold text-blue-900 uppercase mb-1">Logo Esquerda (Brasão)</label>
                                  <div className="flex items-center gap-2">
                                      {formData.logoEsquerda ? (
                                          <div className="relative group border rounded p-1 bg-gray-50">
                                              <img src={formData.logoEsquerda} className="h-10 w-10 object-contain" alt="Logo Esq" />
                                              <button onClick={() => setFormData({...formData, logoEsquerda: undefined})} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-sm hover:bg-red-600 transition-colors"><X size={12}/></button>
                                          </div>
                                      ) : (
                                          <label className="cursor-pointer flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded border border-gray-300 border-dashed text-xs font-bold text-gray-500 w-full justify-center transition-colors">
                                              <Upload size={14}/> Enviar Imagem
                                              <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                                  const file = e.target.files?.[0];
                                                  if(file) {
                                                      const reader = new FileReader();
                                                      reader.onload = (ev) => setFormData(prev => ({...prev, logoEsquerda: ev.target?.result as string}));
                                                      reader.readAsDataURL(file);
                                                  }
                                              }} />
                                          </label>
                                      )}
                                  </div>
                              </div>

                              <div>
                                  <label className="block text-[10px] font-bold text-blue-900 uppercase mb-1">Logo Direita (Defesa Civil)</label>
                                  <div className="flex items-center gap-2">
                                      {formData.logoDireita ? (
                                          <div className="relative group border rounded p-1 bg-gray-50">
                                              <img src={formData.logoDireita} className="h-10 w-10 object-contain" alt="Logo Dir" />
                                              <button onClick={() => setFormData({...formData, logoDireita: undefined})} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-sm hover:bg-red-600 transition-colors"><X size={12}/></button>
                                          </div>
                                      ) : (
                                          <label className="cursor-pointer flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded border border-gray-300 border-dashed text-xs font-bold text-gray-500 w-full justify-center transition-colors">
                                              <Upload size={14}/> Enviar Imagem
                                              <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                                  const file = e.target.files?.[0];
                                                  if(file) {
                                                      const reader = new FileReader();
                                                      reader.onload = (ev) => setFormData(prev => ({...prev, logoDireita: ev.target?.result as string}));
                                                      reader.readAsDataURL(file);
                                                  }
                                              }} />
                                          </label>
                                      )}
                                  </div>
                              </div>
                          </div>
                      </div>
                   )}
                   <button onClick={() => setShowCustomization(!showCustomization)} className={`text-sm font-bold mr-auto flex items-center gap-1 px-3 py-2 rounded transition-colors ${showCustomization ? 'bg-gray-100 text-gray-800' : 'text-gray-100 hover:text-white'}`}><Settings size={14}/> {showCustomization ? 'Ocultar Opções' : 'Opções Avançadas'}</button>
                   
                   <button onClick={handlePreview} className="px-6 py-3 bg-blue-100 text-blue-800 font-bold uppercase rounded-lg hover:bg-blue-200 flex items-center justify-center gap-2">
                       <Eye size={20}/> Visualizar PDF
                   </button>
                   <button onClick={handleDownload} className="px-8 py-3 bg-green-600 text-white font-bold uppercase rounded-lg hover:bg-green-700 shadow-lg flex items-center justify-center gap-2">
                       <Save size={20}/> Finalizar e Baixar PDF
                   </button>
              </div>
          </section>
      </div>
    );
  };

  // MAIN RENDER
  const renderLoginView = () => {
    // Filter engineers for search
    const filteredEngineers = engineers.filter(e => 
        e.active && ( // Only show active engineers
            e.name.toLowerCase().includes(engineerSearch.toLowerCase()) ||
            e.crea.includes(engineerSearch)
        )
    );

    const cedecEngineers = filteredEngineers.filter(e => e.institution === 'CEDEC');
    const volunEngineers = filteredEngineers.filter(e => e.institution !== 'CEDEC');

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 to-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-blue-50 p-4 text-center border-b border-blue-100 relative">
                    <div className="flex justify-center gap-4 mb-4">
                       <img src={BRASAO_PR_LOGO} className="h-20 md:h-24 object-contain" alt="Brasão PR" />
                       <img src={DEFESA_CIVIL_PR_LOGO} className="h-20 md:h-24 object-contain" alt="Defesa Civil" />
                    </div>
                    <h1 className="text-xl font-black text-blue-900 uppercase tracking-tight">Sistema de Laudos Técnicos</h1>
                    <p className="text-blue-600 text-[10px] font-bold uppercase tracking-widest mt-1">COORDENADORIA ESTADUAL DA DEFESA CIVIL</p>
                </div>
                
                <form onSubmit={handleLogin} className="p-6 space-y-4 pb-6">
                    {loginError && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold flex items-center gap-2 border border-red-100 animate-in shake">
                            <AlertTriangle size={16} /> {loginError}
                        </div>
                    )}

                    {isAdminLoginMode ? (
                        <div className="animate-in fade-in slide-in-from-right-4">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Usuário Administrador</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-gray-800"
                                    placeholder="Usuário"
                                    value={adminUsername}
                                    onChange={(e) => setAdminUsername(e.target.value)}
                                />
                                <Shield className="absolute left-3 top-3.5 text-gray-400" size={18} />
                            </div>
                        </div>
                    ) : (
                        <div ref={engineerSelectRef} className="relative animate-in fade-in slide-in-from-left-4">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Responsável Técnico</label>
                            <div className="relative">
                                <input 
                                    type="text"
                                    className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-gray-800 cursor-pointer"
                                    placeholder="Selecione ou digite seu nome..."
                                    value={engineerSearch}
                                    onChange={(e) => {
                                        setEngineerSearch(e.target.value);
                                        setLoginEngineerId(''); // Reset selection on type
                                        setShowEngineerList(true);
                                    }}
                                    onFocus={() => setShowEngineerList(true)}
                                />
                                <User className="absolute left-3 top-3.5 text-gray-400" size={18} />
                                <div 
                                    className="absolute right-3 top-3.5 text-gray-400 cursor-pointer"
                                    onClick={() => setShowEngineerList(!showEngineerList)}
                                >
                                    {showEngineerList ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                                </div>
                            </div>

                            {/* Dropdown List */}
                            {showEngineerList && (
                                <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-xl max-h-60 overflow-y-auto border border-gray-200 animate-in fade-in slide-in-from-top-1">
                                    {cedecEngineers.length > 0 && (
                                        <>
                                            <div className="px-3 py-2 bg-blue-50 text-xs font-bold text-blue-800 uppercase sticky top-0">Corpo Técnico CEDEC</div>
                                            {cedecEngineers.map(e => (
                                                <div 
                                                    key={e.id} 
                                                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 flex justify-between items-center"
                                                    onClick={() => {
                                                        setLoginEngineerId(e.id);
                                                        setEngineerSearch(e.name);
                                                        setShowEngineerList(false);
                                                    }}
                                                >
                                                    <span>{e.name}</span>
                                                    {loginEngineerId === e.id && <Check size={14} className="text-green-600"/>}
                                                </div>
                                            ))}
                                        </>
                                    )}
                                    
                                    {volunEngineers.length > 0 && (
                                        <>
                                            <div className="px-3 py-2 bg-gray-100 text-xs font-bold text-gray-600 uppercase sticky top-0 border-t border-gray-200">Voluntários e Outros</div>
                                            {volunEngineers.map(e => (
                                                <div 
                                                    key={e.id} 
                                                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 flex justify-between items-center"
                                                    onClick={() => {
                                                        setLoginEngineerId(e.id);
                                                        setEngineerSearch(e.name);
                                                        setShowEngineerList(false);
                                                    }}
                                                >
                                                    <span>{e.name}</span>
                                                    {loginEngineerId === e.id && <Check size={14} className="text-green-600"/>}
                                                </div>
                                            ))}
                                        </>
                                    )}

                                    {filteredEngineers.length === 0 && (
                                        <div className="p-4 text-center text-sm text-gray-500">Nenhum engenheiro encontrado.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Senha de Acesso</label>
                        <div className="relative">
                            <input 
                                type="password" 
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold text-gray-800 tracking-widest"
                                placeholder="••••••••"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                            />
                            <Key className="absolute left-3 top-3.5 text-gray-400" size={18} />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-orange-500 text-white font-bold uppercase py-3 rounded-lg hover:bg-orange-600 active:scale-95 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                    >
                        {isLoading ? <Loader2 size={20} className="animate-spin" /> : <><LogIn size={20} /> Acessar Sistema</>}
                    </button>

                    <div className="pt-4 border-t border-gray-100 flex flex-col gap-2">
                        <button 
                            type="button"
                            onClick={() => {
                                setIsAdminLoginMode(!isAdminLoginMode);
                                setLoginError('');
                                setLoginPassword('');
                            }}
                            className="text-sm text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider flex items-center justify-center gap-2 mx-auto transition-colors p-2 hover:bg-blue-50 rounded-lg w-full"
                        >
                            {isAdminLoginMode ? <><User size={16} /> Voltar para Acesso Técnico</> : <><Shield size={16} /> Acesso Administrativo</>}
                        </button>
                    </div>
                </form>
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    <span>Versão 2.5 (Final)</span>
                    <button 
                        type="button"
                        onClick={() => {
                            if ('serviceWorker' in navigator) {
                                navigator.serviceWorker.getRegistrations().then(registrations => {
                                    for (let registration of registrations) {
                                        registration.unregister();
                                    }
                                    // @ts-ignore
                                    window.location.reload(true);
                                });
                            } else {
                                // @ts-ignore
                                window.location.reload(true);
                            }
                        }}
                        className="hover:text-blue-600 transition-colors flex items-center gap-1"
                    >
                        <Zap size={10} /> Limpar Cache
                    </button>
                </div>
            </div>
        </div>
    );
  };

  return (
    <>
      {(!isAuthenticated && currentView === 'login') ? renderLoginView() : (
          <div className="min-h-screen bg-gray-50 pb-12 font-sans text-slate-800">
      <header className="bg-blue-900 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-24 flex items-center justify-between">
          <div className="flex items-center gap-6 overflow-hidden">
             <img src={DEFESA_CIVIL_PR_LOGO} className="h-16 md:h-20 w-auto object-contain shrink-0" alt="Defesa Civil" />
             <h1 className="text-sm sm:text-xl md:text-2xl font-black uppercase tracking-tight whitespace-nowrap truncate">
                COORDENADORIA ESTADUAL DA DEFESA CIVIL
             </h1>
          </div>
          
          <div className="flex items-center gap-4 shrink-0">
              <div className="text-right hidden md:block">
                  <p className="text-sm font-bold text-white leading-tight">{loggedInEngineer ? loggedInEngineer.name : (isUserAdmin ? 'Administrador' : 'Usuário')}</p>
                  <p className="text-xs text-blue-300">{loggedInEngineer ? `CREA: ${loggedInEngineer.crea}` : (isUserAdmin ? 'Acesso Administrativo' : 'Acesso Restrito')}</p>
              </div>
              <div className="flex items-center gap-2">
                  {isUserAdmin && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentView('managePropertyData')} className="p-2 bg-blue-800 hover:bg-blue-700 rounded-full text-blue-200 hover:text-white transition-colors" title="Dados Cadastrais">
                            <Database size={20} />
                        </button>
                        <button onClick={handleManageUsers} className="p-2 bg-blue-800 hover:bg-blue-700 rounded-full text-blue-200 hover:text-white transition-colors" title="Gerenciar Usuários">
                            <Users size={20} />
                        </button>
                    </div>
                  )}
                  {!isUserAdmin && (
                    <button onClick={handleEditSelf} className="p-2 bg-blue-800 hover:bg-blue-700 rounded-full text-blue-200 hover:text-white transition-colors" title="Meus Dados">
                        <Settings size={20} />
                    </button>
                  )}
                  <button onClick={handleLogout} className="p-2 bg-red-600/20 hover:bg-red-600 rounded-full text-red-200 hover:text-white transition-colors border border-red-500/30" title="Sair">
                      <LogOut size={20} />
                  </button>
              </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in slide-in-from-bottom-4">
          {currentView === 'protocolList' && renderProtocolList()}
          {currentView === 'manageUsers' && renderManageUsers()}
          {currentView === 'managePropertyData' && renderManagePropertyData()}
          {currentView === 'protocolForm' && renderProtocolFormView()}
          {currentView === 'laudoForm' && renderLaudoFormView()}
      </main>
        </div>
      )}

      {/* SHARED MODALS */}
      {showToast && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4 fade-in">
              <div className="bg-red-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-red-500">
                  <AlertTriangle size={20} />
                  <span className="font-bold uppercase text-sm tracking-wide">{toastMessage}</span>
              </div>
          </div>
      )}

      {showEngineerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="bg-orange-500 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold text-lg uppercase flex items-center gap-2"><User size={20}/> {editingEngineer ? 'Editar Cadastro' : 'Novo Engenheiro'}</h3>
                    <button onClick={() => setShowEngineerModal(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={20}/></button>
                </div>
                <div className="p-6 space-y-4">
                    <div><label className={labelClass}>Nome Completo</label><input type="text" className={inputClass()} value={newEngineer.name || ''} onChange={e => setNewEngineer({...newEngineer, name: e.target.value})} /></div>
                    <div><label className={labelClass}>CREA</label><input type="text" className={inputClass()} value={newEngineer.crea || ''} onChange={e => setNewEngineer({...newEngineer, crea: e.target.value})} /></div>
                    <div>
                        <label className={labelClass}>Instituição</label>
                        <select className={inputClass()} value={newEngineer.institution || ''} onChange={e => setNewEngineer({...newEngineer, institution: e.target.value})}>
                            <option value="">Selecione...</option>
                            <option value="Voluntário">Voluntário</option>
                            <option value="CEDEC">CEDEC</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Nova Senha</label>
                        <input type="password" className={inputClass()} value={newEngineer.password || ''} onChange={e => setNewEngineer({...newEngineer, password: e.target.value})} placeholder="Preencha apenas para alterar" />
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button onClick={() => setShowEngineerModal(false)} className="px-4 py-2 text-gray-500 font-bold uppercase hover:bg-gray-100 rounded">Cancelar</button>
                        <button onClick={saveEngineer} disabled={isLoading} className="px-6 py-2 bg-orange-500 text-white font-bold uppercase rounded hover:bg-orange-600 shadow">{isLoading ? 'Salvando...' : 'Salvar Dados'}</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {showPreviewModal && previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
            <div className="bg-white rounded-none sm:rounded-xl shadow-2xl w-full h-full sm:h-[95vh] max-w-5xl overflow-hidden flex flex-col">
                <div className="bg-blue-900 p-4 flex justify-between items-center text-white shrink-0">
                    <h3 className="font-bold text-lg uppercase flex items-center gap-2"><Eye size={20}/> Visualização do Laudo</h3>
                    <div className="flex items-center gap-2">
                        <a 
                            href={previewUrl} 
                            download="laudo.pdf"
                            className="bg-blue-800 hover:bg-blue-700 px-3 py-1 rounded text-xs font-bold uppercase flex items-center gap-1 transition-colors"
                        >
                            <Download size={14} /> <span className="hidden sm:inline">Baixar</span>
                        </a>
                        <button onClick={() => setShowPreviewModal(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors"><X size={24}/></button>
                    </div>
                </div>
                <div className="flex-1 bg-gray-100 relative overflow-hidden">
                    <PDFViewer url={previewUrl} />
                </div>
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-center shrink-0">
                    <button 
                        onClick={() => setShowPreviewModal(false)} 
                        className="px-8 py-2 bg-blue-900 text-white font-bold uppercase rounded-lg hover:bg-blue-800 shadow-lg transition-all"
                    >
                        Fechar Visualização
                    </button>
                </div>
            </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in zoom-in-95">
             <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border-2 border-red-500">
                 <div className="bg-red-50 p-6 text-center">
                     <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                         <Trash2 className="text-red-600" size={32} />
                     </div>
                     <h3 className="text-xl font-bold text-red-900 uppercase">Confirmar Exclusão</h3>
                     <p className="text-sm text-red-700 mt-2">
                         {protocolToDelete 
                            ? "Esta ação é irreversível. O protocolo e todo o seu histórico serão apagados permanentemente." 
                            : "Esta ação é irreversível. Este registro do histórico será apagado permanentemente."}
                     </p>
                 </div>
                 <div className="p-6 bg-white space-y-4">
                     {deleteError && <div className="bg-red-50 text-red-600 text-xs font-bold p-2 rounded border border-red-100 text-center">{deleteError}</div>}
                     <div>
                         <label className="block text-xs font-bold text-gray-500 uppercase mb-1 text-center">Digite a senha de administrador para confirmar</label>
                         <input type="password" className="w-full text-center text-lg tracking-widest border-2 border-gray-200 rounded-lg py-2 bg-white text-black focus:border-red-500 focus:ring-0 transition-colors" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} autoFocus />
                      </div>
                      <div className="flex gap-3 pt-2">
                         <button onClick={closeDeleteModal} className="flex-1 py-3 text-gray-500 font-bold uppercase hover:bg-gray-100 rounded-lg">Cancelar</button>
                         <button onClick={protocolToDelete ? confirmDeleteProtocol : confirmDeleteHistory} disabled={isLoading} className="flex-1 py-3 bg-red-600 text-white font-bold uppercase rounded-lg hover:bg-red-700 shadow-lg">{isLoading ? 'Apagando...' : 'Excluir Agora'}</button>
                     </div>
                 </div>
             </div>
        </div>
      )}

    </>
  );
}
