import React, { useState, useEffect } from 'react';
// @ts-ignore
import html2canvas from 'html2canvas';
import { 
  BuildingTypology, 
  DamageClassification, 
  Engineer, 
  LaudoForm, 
  ZoneType 
} from './types';
import { 
  PARANA_CITIES, 
  INITIAL_ENGINEERS, 
  DAMAGE_LOGIC, 
  BRAZIL_STATES,
  PARECER_TEXTS
} from './constants';
// Import logos from the assets directory
import { BRASAO_PR_LOGO, DEFESA_CIVIL_PR_LOGO } from './assets/logos';
import { MapPicker } from './components/MapPicker';
import { DamageInput } from './components/DamageInput';
import { generateLaudoPDF } from './services/pdfService';
import { FileText, Save, MapPin, User, AlertTriangle, Building, Shield, Trash2, Edit, Lock, CheckCircle, XCircle, Trees, Eye, X, Download, Image as ImageIcon, Upload, Link as LinkIcon, Settings, CloudUpload, Check, Loader2, ClipboardList } from 'lucide-react';

// --- CONFIGURAÇÃO DA PLANILHA ---
// Cole a URL do seu Google Apps Script aqui:
const GOOGLE_SHEETS_URL = ''; 
// Exemplo: 'https://script.google.com/macros/s/AKfycbx.../exec'

// Helper for CPF Mask
const formatCPF = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

// Helper for Protocolo Mask (11.111.111-1)
const formatProtocolo = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  return numbers
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
    .substring(0, 12); // Limit length: XX.XXX.XXX-X is 12 chars
};

// Helper for Indicação Fiscal Mask (Updated Pattern: 00.00.000.0000.0000.0)
const formatIndicacaoFiscal = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  return numbers
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{2})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{2})\.(\d{3})(\d)/, '$1.$2.$3.$4')
    .replace(/^(\d{2})\.(\d{2})\.(\d{3})\.(\d{4})(\d)/, '$1.$2.$3.$4.$5')
    .replace(/^(\d{2})\.(\d{2})\.(\d{3})\.(\d{4})\.(\d{4})(\d)/, '$1.$2.$3.$4.$5.$6')
    .substring(0, 21); // Limit length based on the mask
};

// Helper to parse Indicação Fiscal into temporary system variables
const parseIndicacaoFiscal = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    // Expecting at least 16 digits for a full parse based on standard 00.00.000.0000.0000.0
    if (numbers.length >= 16) {
        return {
            setor: numbers.substring(0, 2),
            quadra: numbers.substring(2, 4),
            lote: numbers.substring(4, 7),
            sublote: numbers.substring(7, 11),
            unidade: numbers.substring(11, 15),
            digito: numbers.substring(15, 16)
        };
    }
    return undefined;
};

// Helper for CPF Validation
const validateCPF = (cpf: string) => {
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
  
  let sum = 0;
  let remainder;
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

// Helper to process and trim whitespace from images (Accepts File or Blob)
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
  
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
  
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
          let found = false;
  
          for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
              const i = (y * canvas.width + x) * 4;
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const a = data[i + 3];
  
              // Consider pixel "content" if it is NOT transparent AND NOT white
              // White tolerance: > 240 on all channels
              const isWhite = r > 240 && g > 240 && b > 240;
              const isTransparent = a < 10;
  
              if (!isTransparent && !isWhite) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                found = true;
              }
            }
          }
  
          if (!found) { 
              // If image is blank or full white, return original (or empty)
              resolve(img.src); 
              return; 
          }
  
          const width = maxX - minX + 1;
          const height = maxY - minY + 1;
  
          const cutCanvas = document.createElement('canvas');
          cutCanvas.width = width;
          cutCanvas.height = height;
          const cutCtx = cutCanvas.getContext('2d');
          if(!cutCtx) { resolve(img.src); return; }
  
          cutCtx.drawImage(canvas, minX, minY, width, height, 0, 0, width, height);
          resolve(cutCanvas.toDataURL('image/png'));
        };
        // Handle loading errors for the image element
        img.onerror = () => {
            resolve(e.target?.result as string);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

// Helper to fetch an image from a URL and convert to Base64 (with trimming)
const downloadAndProcessImage = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const blob = await response.blob();
        return await processAndTrimImage(blob);
    } catch (error) {
        console.warn("Could not download/process image from URL (likely CORS). Using raw URL.", error);
        return url; // Fallback to the URL string if fetch fails
    }
};

function App() {
  // Detection for mobile to adjust default zoom
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Load engineers from localStorage or use initial list with robustness
  const [engineers, setEngineers] = useState<Engineer[]>(() => {
    if (typeof window !== 'undefined') {
        try {
            const saved = localStorage.getItem('dc_pr_engineers');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error("Erro ao carregar engenheiros do histórico:", error);
            // Fallback to initial if data is corrupted
        }
    }
    return INITIAL_ENGINEERS;
  });

  // Persist engineers on change with error handling
  useEffect(() => {
    try {
        localStorage.setItem('dc_pr_engineers', JSON.stringify(engineers));
    } catch (error) {
        console.error("Erro ao salvar engenheiros no histórico:", error);
    }
  }, [engineers]);

  const [formData, setFormData] = useState<LaudoForm>({
    municipio: 'Rio Bonito do Iguaçu',
    data: new Date().toISOString().split('T')[0],
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
    endereco: '',
    bairro: '',
    cep: '',
    lat: -25.4897, // Rio Bonito do Iguaçu
    lng: -52.5283, // Rio Bonito do Iguaçu
    tipologia: '' as BuildingTypology, 
    tipologiaOutro: '',
    danos: [],
    classificacao: '' as DamageClassification, 
    logoEsquerda: BRASAO_PR_LOGO,
    logoDireita: DEFESA_CIVIL_PR_LOGO,
    parecerFinal: ''
  });

  // Map Visualization State - Default zoom is slightly lower on mobile to prevent excessive zoom in PDF
  const [mapState, setMapState] = useState({
      lat: -25.4897,
      lng: -52.5283,
      zoom: isMobile ? 14 : 15
  });
  
  // Track if the location is specific (user clicked/GPS) or general (default city center)
  const [isSpecificLocation, setIsSpecificLocation] = useState(false);

  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Effect to automatically download and process default logos on mount
  useEffect(() => {
    const processDefaults = async () => {
        let updates: Partial<LaudoForm> = {};
        let changed = false;

        // Check if logos are URLs and start with http (not already base64)
        if (BRASAO_PR_LOGO.startsWith('http')) {
            const processedLeft = await downloadAndProcessImage(BRASAO_PR_LOGO);
            if (processedLeft !== BRASAO_PR_LOGO) {
                updates.logoEsquerda = processedLeft;
                changed = true;
            }
        }

        if (DEFESA_CIVIL_PR_LOGO.startsWith('http')) {
            const processedRight = await downloadAndProcessImage(DEFESA_CIVIL_PR_LOGO);
            if (processedRight !== DEFESA_CIVIL_PR_LOGO) {
                updates.logoDireita = processedRight;
                changed = true;
            }
        }

        if (changed) {
            setFormData(prev => ({ ...prev, ...updates }));
        }
    };
    processDefaults();
  }, []);

  // Auto-increment ID starting at 1, persisted in localStorage to simulate database sequence
  const [idLaudo, setIdLaudo] = useState(() => {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('laudo_seq');
        const next = stored ? parseInt(stored) + 1 : 1;
        localStorage.setItem('laudo_seq', next.toString());
        return next.toString();
    }
    return '1';
  });

  // Modal States
  const [showEngineerModal, setShowEngineerModal] = useState(false);
  const [newEngineer, setNewEngineer] = useState<Partial<Engineer>>({ state: 'PR', institution: 'Voluntário' });
  const [editingEngineer, setEditingEngineer] = useState<Engineer | null>(null);

  // Delete Confirmation States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Preview State
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Customization Visibility State
  const [showCustomization, setShowCustomization] = useState(false);

  // Validation State
  const [cpfValid, setCpfValid] = useState<boolean | null>(null);
  const [cpfErrorMessage, setCpfErrorMessage] = useState<string>('');
  const [indicacaoFiscalValid, setIndicacaoFiscalValid] = useState<boolean | null>(null);
  const [protocoloValid, setProtocoloValid] = useState<boolean | null>(null);

  // Computed Values
  const selectedEngineer = engineers.find(e => e.id === formData.engineerId);
  const damageStats = formData.classificacao 
    ? DAMAGE_LOGIC[formData.classificacao] 
    : { level: '---', percent: '---' };

  // Standard input style class for consistency - Added fixed height for alignment
  const inputClass = "w-full h-[42px] rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 py-2 px-3 border bg-white text-black transition-all";
  const labelClass = "block text-sm font-bold text-blue-900 mb-1";

  // Logic to center map on city selection
  const handleCityChange = (cityName: string) => {
    const city = PARANA_CITIES.find(c => c.name === cityName);
    
    // Update map view if city found
    if (city) {
        setMapState(prev => ({ ...prev, lat: city.lat, lng: city.lng, zoom: isMobile ? 14 : 15 }));
    }

    // Reset specific location flag - user just picked a city, hasn't pinpointed address
    setIsSpecificLocation(false);

    setFormData(prev => ({
      ...prev,
      municipio: cityName,
      lat: city ? city.lat : prev.lat,
      lng: city ? city.lng : prev.lng
    }));
    // Reset fiscal validation when changing cities
    setIndicacaoFiscalValid(null);
  };

  // Logic to handle Engineer Selection
  const handleEngineerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'OUTRO') {
      setShowEngineerModal(true);
      setNewEngineer({ state: 'PR', name: '', crea: '', institution: 'Voluntário' });
      setEditingEngineer(null);
    } else {
      setFormData(prev => ({ ...prev, engineerId: val }));
    }
  };

  const handleClassificationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value as DamageClassification;
      // Get standard text for this classification
      const defaultParecer = PARECER_TEXTS[val] || '';
      
      setFormData(prev => ({
          ...prev,
          classificacao: val,
          parecerFinal: defaultParecer // Update the parecer text
      }));
  };

  // Logic for Indicação Fiscal Change
  const handleIndicacaoFiscalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;

      if (formData.municipio === 'Rio Bonito do Iguaçu') {
          const formatted = formatIndicacaoFiscal(rawValue);
          const parsedParts = parseIndicacaoFiscal(formatted);
          setFormData(prev => ({ 
              ...prev, 
              indicacaoFiscal: formatted,
              indicacaoFiscalParts: parsedParts
          }));
      } else {
          // Free text for other cities
          setFormData(prev => ({ 
              ...prev, 
              indicacaoFiscal: rawValue,
              indicacaoFiscalParts: undefined // Clear parsed parts
          }));
      }
      
      // Reset validation while typing
      setIndicacaoFiscalValid(null);
  };

  const handleIndicacaoFiscalBlur = () => {
    if (formData.municipio === 'Rio Bonito do Iguaçu') {
        const val = formData.indicacaoFiscal;
        if (val.length > 0) {
            // Updated Standard full mask is 21 characters: 00.00.000.0000.0000.0
            if (val.length < 21) {
                setIndicacaoFiscalValid(false);
            } else {
                setIndicacaoFiscalValid(true);
            }
        } else {
            setIndicacaoFiscalValid(null);
        }
    } else {
        // No strict validation for other cities
        setIndicacaoFiscalValid(null);
    }
  };

  // Logic for Protocolo Change
  const handleProtocoloChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = formatProtocolo(e.target.value);
    setFormData(prev => ({ ...prev, protocolo: val }));
    // Reset validation while typing
    setProtocoloValid(null);
  };

  const handleProtocoloBlur = () => {
      const val = formData.protocolo;
      // Mask: 11.111.111-1 (12 chars total)
      if (val.length > 0) {
          if (val.length < 12) {
              setProtocoloValid(false);
          } else {
              setProtocoloValid(true);
          }
      } else {
          setProtocoloValid(false); // Mandatory field
      }
  };

  const saveEngineer = () => {
    if (!newEngineer.name || !newEngineer.crea) return alert("Preencha nome e CREA");
    
    // User selected institution
    const institutionToSave = newEngineer.institution || 'Voluntário';

    if (editingEngineer) {
        // Edit existing
        setEngineers(prev => prev.map(eng => eng.id === editingEngineer.id ? { ...eng, ...newEngineer, institution: institutionToSave } as Engineer : eng));
        setFormData(prev => ({ ...prev, engineerId: editingEngineer.id }));
    } else {
        // Create new
        const newId = Date.now().toString();
        const eng: Engineer = {
            id: newId,
            name: newEngineer.name!,
            crea: newEngineer.crea!,
            state: newEngineer.state,
            institution: institutionToSave,
            isCustom: true
        };
        setEngineers(prev => [...prev, eng]);
        setFormData(prev => ({ ...prev, engineerId: newId }));
    }
    setShowEngineerModal(false);
  };

  const handleEditCurrentEngineer = () => {
      if (selectedEngineer) {
          setEditingEngineer(selectedEngineer);
          // Default to PR if state is missing
          // Use existing institution or default to Voluntário if missing (for legacy data)
          setNewEngineer({ 
              ...selectedEngineer, 
              state: selectedEngineer.state || 'PR',
              institution: selectedEngineer.institution || 'Voluntário'
          });
          setShowEngineerModal(true);
      }
  };

  // Trigger the delete modal
  const handleDeleteClick = () => {
      if (!selectedEngineer) return;
      setDeletePassword('');
      setDeleteError('');
      setShowDeleteModal(true);
  };

  // Confirm delete logic
  const confirmDeleteEngineer = () => {
      if (deletePassword === 'admin') {
          if (selectedEngineer) {
            const idToRemove = selectedEngineer.id;
            setFormData(prev => ({ ...prev, engineerId: '' })); // Deselect first
            setEngineers(prev => prev.filter(e => e.id !== idToRemove));
            setShowDeleteModal(false);
          }
      } else {
          setDeleteError("Senha Inválida");
      }
  };

  const handleLocationSelect = (lat: number, lng: number, addressData?: any) => {
    // When selecting from map (click/gps), we are specific
    setIsSpecificLocation(true);
    
    // Update BOTH map view/marker AND form fields
    setMapState(prev => ({ ...prev, lat, lng }));
    setFormData(prev => ({
        ...prev,
        lat,
        lng,
        endereco: addressData?.road ? `${addressData.road}, ${addressData.house_number || 'S/N'}` : prev.endereco,
        bairro: addressData?.suburb || addressData?.neighbourhood || prev.bairro,
        cep: addressData?.postcode || prev.cep,
    }));
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = formatCPF(e.target.value);
      setFormData(prev => ({ ...prev, cpfRequerente: val }));
      
      // Reset error message while typing
      setCpfErrorMessage('');

      if (val.length > 0) {
          if (val.length === 14) {
              const isValid = validateCPF(val);
              setCpfValid(isValid);
              if (!isValid) setCpfErrorMessage('CPF Inválido');
          } else {
              setCpfValid(null);
          }
      } else {
          // Empty is valid now (optional field)
          setCpfValid(null);
      }
  };

  const handleCpfBlur = () => {
    const val = formData.cpfRequerente;
    if (val.length > 0 && val.length < 14) {
        setCpfValid(false);
        setCpfErrorMessage('CPF incompleto');
    } else if (val.length === 0) {
        // Clear errors if empty
        setCpfValid(null);
        setCpfErrorMessage('');
    }
  };

  // Handle Logo Upload with Trimming
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, position: 'left' | 'right') => {
    const file = e.target.files?.[0];
    if (file) {
        try {
            const base64String = await processAndTrimImage(file);
             if (position === 'left') {
                setFormData(prev => ({ ...prev, logoEsquerda: base64String }));
            } else {
                setFormData(prev => ({ ...prev, logoDireita: base64String }));
            }
        } catch (error) {
            console.error("Error processing image", error);
        }
    }
  };

  const removeLogo = (position: 'left' | 'right') => {
      if (position === 'left') {
          setFormData(prev => ({ ...prev, logoEsquerda: '' }));
      } else {
          setFormData(prev => ({ ...prev, logoDireita: '' }));
      }
  };

  // Handler for URL inputs - Downloads and processes the image
  const handleUrlInput = async (e: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>, field: 'logoEsquerda' | 'logoDireita') => {
    const target = e.target as HTMLInputElement;
    const url = target.value;
    
    if (url && url.length > 5) {
        // Show user something is happening (optional, but good UX would be a loading state)
        // For now, we just process it.
        const processedImage = await downloadAndProcessImage(url);
        setFormData(prev => ({ ...prev, [field]: processedImage }));
        
        // Clear input value if it was a successful download (it will be replaced by the image view)
        // If it failed and returned the URL, the image view will still try to render the URL.
        target.value = ''; 
    }
  };

  const validateForm = () => {
    if (!selectedEngineer) { alert("Selecione um engenheiro"); return false; }
    if (!formData.municipio) { alert("Selecione um município"); return false; }
    // Protocolo validation
    if (!formData.protocolo || formData.protocolo.length < 12) { 
        alert("Preencha o Protocolo (SID) corretamente."); 
        setProtocoloValid(false);
        return false; 
    }
    
    if (!formData.classificacao) { alert("Selecione a Classificação dos Danos"); return false; }
    
    // Validate Indicação Fiscal for Urban zone (New Length 21) - ONLY FOR RIO BONITO
    if (formData.zona === ZoneType.URBANO && formData.municipio === 'Rio Bonito do Iguaçu' && formData.indicacaoFiscal.length > 0 && indicacaoFiscalValid === false) {
        alert("Indicação Fiscal incompleta");
        return false;
    }

    // Only validate CPF if it is filled and marked as invalid
    if (formData.cpfRequerente.length > 0 && cpfValid === false) { 
        alert(cpfErrorMessage || "CPF do Requerente inválido!"); 
        return false; 
    }
    return true;
  };

  const captureMap = async () => {
    const mapElement = document.getElementById('map-print-container');
    if (!mapElement) return null;
    try {
        // Adjusted scale for mobile to improve capture quality without distortion
        const captureScale = isMobile ? 1.5 : 2;

        const canvas = await html2canvas(mapElement, {
            useCORS: true,
            allowTaint: false,
            logging: false,
            scale: captureScale,
            backgroundColor: null,
            onclone: (clonedDoc) => {
                const elementsToHide = [
                    '.leaflet-control-container', // Zoom controls, attribution, etc.
                    '.map-custom-controls',       // Custom controls (Layers + GPS)
                    '.map-instruction',           // Bottom instruction text
                ];
                elementsToHide.forEach(selector => {
                    const el = clonedDoc.querySelector(selector);
                    if (el) (el as HTMLElement).style.display = 'none';
                });

                // Ensure the cloned map maintains the visual appearance
                const clonedMapContainer = clonedDoc.getElementById('map-print-container');
                if (clonedMapContainer) {
                    clonedMapContainer.style.width = mapElement.offsetWidth + 'px';
                    clonedMapContainer.style.height = mapElement.offsetHeight + 'px';
                }
            }
        });
        return canvas.toDataURL('image/png');
    } catch (e) {
        console.error("Failed to capture map", e);
        return null;
    }
  };

  const sendDataToSheet = async () => {
    if (!GOOGLE_SHEETS_URL) return; // Skip if not configured
    if (!selectedEngineer) return;

    setIsSyncing(true);
    setSyncStatus('idle');

    // Summarize damages
    const damageSummary = formData.danos
        .map(d => `${d.type}: ${d.description || 'Sem descrição'}`)
        .join(' | ');

    const payload = {
        protocolo: formData.protocolo,
        municipio: formData.municipio,
        engineerName: selectedEngineer.name,
        engineerCrea: selectedEngineer.crea,
        zona: formData.zona,
        requerente: formData.requerente || 'N/I',
        cpf: formData.cpfRequerente || 'N/I',
        endereco: formData.endereco || 'N/I',
        tipologia: formData.tipologia || 'N/I',
        classificacao: formData.classificacao,
        nivelDestruicao: damageStats.level,
        resumoDanos: damageSummary
    };

    try {
        await fetch(GOOGLE_SHEETS_URL, {
            method: 'POST',
            mode: 'no-cors', // Essential for Google Apps Script Webhooks from browser
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        setSyncStatus('success');
    } catch (error) {
        console.error("Sync Error", error);
        setSyncStatus('error');
    } finally {
        setIsSyncing(false);
    }
  };

  const handlePreview = async () => {
    if (!validateForm()) return;
    if (selectedEngineer) {
        const mapImg = await captureMap();
        // Pass isSpecificLocation to control vector pin drawing
        const url = await generateLaudoPDF({ ...formData, id_laudo: idLaudo }, selectedEngineer, 'preview', mapImg || undefined, isSpecificLocation);
        if (url) {
            setPreviewUrl(url);
            setShowPreview(true);
        }
    }
  };

  const handleDownload = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (!validateForm()) return;
    if (selectedEngineer) {
        // Trigger Sync
        if (GOOGLE_SHEETS_URL) {
            sendDataToSheet();
        }

        const mapImg = await captureMap();
        // Generate PDF
        // Pass isSpecificLocation to control vector pin drawing
        await generateLaudoPDF({ ...formData, id_laudo: idLaudo }, selectedEngineer, 'save', mapImg || undefined, isSpecificLocation);
        
        // Wait a bit to reset form without reload
        setTimeout(() => {
             // 1. Increment ID
             const nextId = (parseInt(idLaudo) + 1).toString();
             setIdLaudo(nextId);
             localStorage.setItem('laudo_seq', nextId);

             // 2. Reset Fields (Keep Municipio, Data, Logos)
             const currentCity = PARANA_CITIES.find(c => c.name === formData.municipio);
             const defaultLat = currentCity ? currentCity.lat : -25.4897;
             const defaultLng = currentCity ? currentCity.lng : -52.5283;

             setFormData(prev => ({
                 ...prev,
                 // Keep: municipio, data, logos
                 // Reset Engineer:
                 engineerId: '', 
                 // Reset Other Fields:
                 protocolo: '',
                 zona: ZoneType.URBANO,
                 indicacaoFiscal: '',
                 indicacaoFiscalParts: undefined,
                 inscricaoImobiliaria: '',
                 matricula: '',
                 nirfCib: '',
                 incra: '',
                 proprietario: '',
                 requerente: '',
                 cpfRequerente: '',
                 endereco: '',
                 bairro: '',
                 cep: '',
                 lat: defaultLat,
                 lng: defaultLng,
                 tipologia: '' as BuildingTypology,
                 tipologiaOutro: '',
                 danos: [],
                 classificacao: '' as DamageClassification,
                 parecerFinal: ''
             }));

             // 3. Reset Validation States
             setCpfValid(null);
             setCpfErrorMessage('');
             setIndicacaoFiscalValid(null);
             setProtocoloValid(null);

             // 4. Reset Map View and Location Flag
             setMapState({ lat: defaultLat, lng: defaultLng, zoom: isMobile ? 14 : 15 });
             setIsSpecificLocation(false);

             // 5. Reset Sync Status visually
             setSyncStatus('idle');
             
             // Scroll to top
             window.scrollTo({ top: 0, behavior: 'smooth' });

             alert("PDF gerado com sucesso! O formulário foi limpo para o próximo laudo.");
        }, 1000); 
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-8">
      {/* Header with Defesa Civil Colors */}
      <header className="bg-blue-900 text-white shadow-lg sticky top-0 z-50 border-b-4 border-orange-500">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-end gap-4">
                <img 
                    src={DEFESA_CIVIL_PR_LOGO} 
                    alt="Defesa Civil PR" 
                    className="h-20 md:h-24 w-auto drop-shadow-md"
                />
                <div>
                    <h1 className="text-xl md:text-3xl font-black tracking-wide uppercase leading-none mb-2">
                        Coordenadoria Estadual da Defesa Civil
                    </h1>
                </div>
            </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <form className="space-y-8">
            
            {/* 1. Basic Info Section */}
            <section className="bg-white rounded-xl shadow-md border-t-4 border-blue-600 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-2">
                    <MapPin className="text-orange-600" size={24} />
                    <h2 className="text-lg font-bold text-blue-900 uppercase">1. Localização, Data e Protocolo</h2>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                    <div>
                        <label className={labelClass}>Município</label>
                        <select 
                            className={inputClass}
                            value={formData.municipio}
                            onChange={(e) => handleCityChange(e.target.value)}
                        >
                            <option value="">Selecione o Município...</option>
                            {PARANA_CITIES.map(city => (
                                <option key={city.name} value={city.name}>{city.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Data da Vistoria</label>
                        <input 
                            type="date"
                            className={inputClass}
                            value={formData.data}
                            onChange={(e) => setFormData({...formData, data: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Protocolo</label>
                        <div className="relative h-[42px]">
                            <input 
                                type="text"
                                className={`${inputClass} ${protocoloValid === false ? 'border-red-500 ring-1 ring-red-500' : ''} ${protocoloValid === true ? 'border-green-500 ring-1 ring-green-500' : ''}`}
                                value={formData.protocolo}
                                onChange={handleProtocoloChange}
                                onBlur={handleProtocoloBlur}
                                placeholder="11.111.111-1"
                                maxLength={12}
                            />
                            <div className="absolute right-3 top-2.5">
                                {protocoloValid === true && <CheckCircle size={20} className="text-green-600" />}
                                {protocoloValid === false && <XCircle size={20} className="text-red-600" />}
                            </div>
                            {protocoloValid === false && <p className="absolute left-0 -bottom-5 text-[10px] text-red-600 font-bold leading-tight uppercase">Protocolo Inválido</p>}
                        </div>
                    </div>
                </div>
            </section>

             {/* 2. Engineer Section */}
             <section className="bg-white rounded-xl shadow-md border-t-4 border-blue-600 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-2">
                    <User className="text-orange-600" size={24} />
                    <h2 className="text-lg font-bold text-blue-900 uppercase">2. Responsável Técnico</h2>
                </div>
                <div className="p-6">
                    <div className="flex flex-col md:flex-row gap-4 md:items-end">
                        <div className="flex-1">
                            <label className={labelClass}>Engenheiro(a) Responsável</label>
                            <select 
                                className={inputClass}
                                value={formData.engineerId}
                                onChange={handleEngineerSelect}
                                required
                            >
                                <option value="">Selecione...</option>
                                {engineers.map(e => (
                                    <option key={e.id} value={e.id}>
                                        {e.name} - CREA {e.state || 'PR'} {e.crea}
                                    </option>
                                ))}
                                <option value="OUTRO" className="font-bold text-orange-600">+ Cadastrar Novo Engenheiro</option>
                            </select>
                        </div>
                        {selectedEngineer && (
                             <div className="flex gap-2">
                                <button 
                                    type="button" 
                                    onClick={handleEditCurrentEngineer}
                                    className="px-4 py-2 bg-blue-50 text-blue-800 rounded-md border border-blue-200 hover:bg-blue-100 text-sm font-bold uppercase transition-colors flex items-center gap-1"
                                >
                                    <Edit size={16} /> Editar
                                </button>
                                <button 
                                    type="button" 
                                    onClick={handleDeleteClick}
                                    className="px-4 py-2 bg-red-50 text-red-700 rounded-md border border-red-200 hover:bg-red-100 text-sm font-bold uppercase transition-colors flex items-center gap-1"
                                >
                                    <Trash2 size={16} /> Excluir
                                </button>
                             </div>
                        )}
                    </div>
                </div>
            </section>

            {/* 3. Property Details & Map */}
            <section className="bg-white rounded-xl shadow-md border-t-4 border-blue-600 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-2">
                    <Building className="text-orange-600" size={24} />
                    <h2 className="text-lg font-bold text-blue-900 uppercase">3. Dados do Imóvel</h2>
                </div>
                <div className="p-6 space-y-6">
                    
                    {/* Zone Selection with Custom Icons */}
                    <div className="grid grid-cols-2 gap-6 border-b border-gray-200 pb-6 mb-2">
                        <div 
                            onClick={() => setFormData({...formData, zona: ZoneType.URBANO})}
                            className={`cursor-pointer flex flex-col md:flex-row items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 ${
                                formData.zona === ZoneType.URBANO
                                    ? 'border-orange-500 bg-orange-50 shadow-md transform scale-[1.02]'
                                    : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-gray-50'
                            }`}
                        >
                            <div className={`p-3 rounded-full ${formData.zona === ZoneType.URBANO ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                <Building size={32} />
                            </div>
                            <div className="text-center md:text-left">
                                <h3 className={`font-bold text-lg ${formData.zona === ZoneType.URBANO ? 'text-blue-900' : 'text-gray-600'}`}>Zona Urbana</h3>
                                <p className="text-xs text-gray-500 hidden md:block">Imóvel situado em perímetro urbano</p>
                            </div>
                             {formData.zona === ZoneType.URBANO && <div className="hidden md:block ml-auto"><CheckCircle className="text-orange-500" size={24} /></div>}
                        </div>

                        <div 
                            onClick={() => setFormData({...formData, zona: ZoneType.RURAL})}
                            className={`cursor-pointer flex flex-col md:flex-row items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 ${
                                formData.zona === ZoneType.RURAL
                                    ? 'border-orange-500 bg-orange-50 shadow-md transform scale-[1.02]'
                                    : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-gray-50'
                            }`}
                        >
                            <div className={`p-3 rounded-full ${formData.zona === ZoneType.RURAL ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                <Trees size={32} />
                            </div>
                            <div className="text-center md:text-left">
                                <h3 className={`font-bold text-lg ${formData.zona === ZoneType.RURAL ? 'text-blue-900' : 'text-gray-600'}`}>Zona Rural</h3>
                                <p className="text-xs text-gray-500 hidden md:block">Imóvel situado em perímetro rural</p>
                            </div>
                            {formData.zona === ZoneType.RURAL && <div className="hidden md:block ml-auto"><CheckCircle className="text-orange-500" size={24} /></div>}
                        </div>
                    </div>

                    {/* Conditional Fields based on Zone */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
                        {formData.zona === ZoneType.URBANO ? (
                            <>
                                <div>
                                    <label className={labelClass}>Indicação Fiscal</label>
                                    <div className="relative h-[42px]">
                                        <input 
                                            type="text"
                                            className={`${inputClass} ${indicacaoFiscalValid === false ? 'border-red-500 ring-1 ring-red-500' : ''} ${indicacaoFiscalValid === true ? 'border-green-500 ring-1 ring-green-500' : ''}`}
                                            value={formData.indicacaoFiscal}
                                            onChange={handleIndicacaoFiscalChange}
                                            onBlur={handleIndicacaoFiscalBlur}
                                            placeholder={formData.municipio === 'Rio Bonito do Iguaçu' ? "00.00.000.0000.0000.0" : "Digite a Indicação Fiscal..."}
                                        />
                                        <div className="absolute right-3 top-2.5">
                                            {indicacaoFiscalValid === true && <CheckCircle size={20} className="text-green-600" />}
                                            {indicacaoFiscalValid === false && <XCircle size={20} className="text-red-600" />}
                                        </div>
                                    </div>
                                    {indicacaoFiscalValid === false && <p className="text-[10px] text-red-600 font-bold mt-1 uppercase">Indicação Fiscal incompleta</p>}
                                </div>
                                <div>
                                    <label className={labelClass}>Inscrição Municipal</label>
                                    <input 
                                        type="text"
                                        className={inputClass}
                                        value={formData.inscricaoImobiliaria}
                                        onChange={e => setFormData({...formData, inscricaoImobiliaria: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Matrícula</label>
                                    <input 
                                        type="text"
                                        className={inputClass}
                                        value={formData.matricula}
                                        onChange={e => setFormData({...formData, matricula: e.target.value})}
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <label className={labelClass}>NIRF / CIB</label>
                                    <input 
                                        type="text"
                                        className={inputClass}
                                        value={formData.nirfCib}
                                        onChange={e => setFormData({...formData, nirfCib: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>INCRA</label>
                                    <input 
                                        type="text"
                                        className={inputClass}
                                        value={formData.incra}
                                        onChange={e => setFormData({...formData, incra: e.target.value})}
                                    />
                                </div>
                                <div className="hidden md:block"></div> {/* Spacer */}
                            </>
                        )}
                    </div>

                    {/* Common Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-gray-200 pt-6">
                        <div className="col-span-1">
                            <label className={labelClass}>Requerente</label>
                            <input 
                                type="text"
                                className={inputClass}
                                value={formData.requerente}
                                onChange={e => setFormData({...formData, requerente: e.target.value})}
                                // Optional now
                            />
                        </div>
                        <div className="col-span-1">
                            <label className={labelClass}>CPF do Requerente</label>
                            <div className="relative h-[42px]">
                                <input 
                                    type="text"
                                    className={`${inputClass} ${cpfValid === false ? 'border-red-500 ring-1 ring-red-500' : ''} ${cpfValid === true ? 'border-green-500 ring-1 ring-green-500' : ''}`}
                                    value={formData.cpfRequerente}
                                    onChange={handleCpfChange}
                                    onBlur={handleCpfBlur}
                                    placeholder="000.000.000-00"
                                    maxLength={14}
                                    // Optional now
                                />
                                <div className="absolute right-3 top-2.5">
                                    {cpfValid === true && <CheckCircle size={20} className="text-green-600" />}
                                    {cpfValid === false && <XCircle size={20} className="text-red-600" />}
                                </div>
                            </div>
                            {cpfValid === false && <p className="text-[10px] text-red-600 font-bold mt-1 uppercase">{cpfErrorMessage || 'CPF Inválido'}</p>}
                        </div>
                         <div className="col-span-1">
                            <label className={labelClass}>Proprietário</label>
                            <input 
                                type="text"
                                className={inputClass}
                                value={formData.proprietario}
                                onChange={e => setFormData({...formData, proprietario: e.target.value})}
                            />
                        </div>
                    </div>

                    {/* Map Integration */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <label className="block text-sm font-bold text-blue-900 mb-2 uppercase">Localização Geográfica (Selecione no Mapa)</label>
                        <MapPicker 
                            centerLat={mapState.lat}
                            centerLng={mapState.lng}
                            initialZoom={mapState.zoom}
                            onLocationSelect={handleLocationSelect}
                            onZoomChange={(z) => setMapState(prev => ({ ...prev, zoom: z }))}
                            showMarker={isSpecificLocation}
                        />
                    </div>

                    {/* Address Fields - Now with White Backgrounds */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-lg border border-gray-200 bg-gray-50">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Endereço (Rua, Nº)</label>
                            <input type="text" value={formData.endereco} onChange={e => setFormData({...formData, endereco: e.target.value})} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bairro</label>
                            <input type="text" value={formData.bairro} onChange={e => setFormData({...formData, bairro: e.target.value})} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CEP</label>
                            <input type="text" value={formData.cep} onChange={e => setFormData({...formData, cep: e.target.value})} className={inputClass} />
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Latitude</label>
                             <input 
                                type="text"
                                defaultValue={isNaN(formData.lat) ? '' : formData.lat}
                                key={`lat-${formData.lat}`} // Force update if map changes formData
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val === '') {
                                        setFormData({...formData, lat: NaN});
                                    } else {
                                        const num = parseFloat(val);
                                        if (!isNaN(num)) setFormData({...formData, lat: num});
                                    }
                                }}
                                className={inputClass}
                             />
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Longitude</label>
                             <input 
                                type="text" 
                                defaultValue={isNaN(formData.lng) ? '' : formData.lng}
                                key={`lng-${formData.lng}`} // Force update if map changes formData
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val === '') {
                                        setFormData({...formData, lng: NaN});
                                    } else {
                                        const num = parseFloat(val);
                                        if (!isNaN(num)) setFormData({...formData, lng: num});
                                    }
                                }}
                                className={inputClass} 
                             />
                        </div>
                    </div>

                    {/* Typology */}
                    <div>
                        <label className={labelClass}>Tipologia da Edificação</label>
                        <select 
                            className={inputClass}
                            value={formData.tipologia}
                            onChange={e => setFormData({...formData, tipologia: e.target.value as BuildingTypology})}
                        >
                            <option value="">Selecione...</option>
                            {Object.values(BuildingTypology).map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                        {formData.tipologia === BuildingTypology.OUTRO && (
                            <input 
                                type="text"
                                placeholder="Descreva a tipologia..."
                                className={`mt-2 ${inputClass}`}
                                value={formData.tipologiaOutro}
                                onChange={e => setFormData({...formData, tipologiaOutro: e.target.value})}
                            />
                        )}
                    </div>
                </div>
            </section>

             {/* 4. Damages */}
             <section className="bg-white rounded-xl shadow-md border-t-4 border-blue-600 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-2">
                    <AlertTriangle className="text-orange-600" size={24} />
                    <h2 className="text-lg font-bold text-blue-900 uppercase">4. Levantamento de Danos</h2>
                </div>
                <div className="p-6">
                    <DamageInput 
                        value={formData.danos}
                        onChange={danos => setFormData({...formData, danos})}
                    />
                </div>
            </section>

            {/* 5. Classification */}
            <section className="bg-white rounded-xl shadow-md border-t-4 border-blue-600 overflow-hidden">
                 <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-2">
                    <FileText className="text-orange-600" size={24} />
                    <h2 className="text-lg font-bold text-blue-900 uppercase">5. Classificação Final</h2>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className={labelClass}>Classificação dos Danos</label>
                        <select 
                             className={inputClass}
                             value={formData.classificacao}
                             onChange={handleClassificationChange}
                        >
                             <option value="">Selecione...</option>
                             {Object.values(DamageClassification).map(c => (
                                <option key={c} value={c}>{c}</option>
                             ))}
                        </select>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                        <span className="block text-xs font-bold text-orange-600 uppercase">Nível de Destruição</span>
                        <div className="text-xl font-black text-gray-800 mt-1">{damageStats.level}</div>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                        <span className="block text-xs font-bold text-orange-600 uppercase">Percentual Estimado</span>
                        <div className="text-xl font-black text-gray-800 mt-1">{damageStats.percent}</div>
                    </div>
                </div>
            </section>

             {/* 6. Parecer Técnico Final */}
             <section className="bg-white rounded-xl shadow-md border-t-4 border-blue-600 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-2">
                    <ClipboardList className="text-orange-600" size={24} />
                    <h2 className="text-lg font-bold text-blue-900 uppercase">6. Parecer Técnico Final</h2>
                </div>
                <div className="p-6">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg mb-4">
                        <p className="text-sm text-blue-800">
                            <strong>Nota:</strong> O texto abaixo é gerado automaticamente com base na Classificação dos Danos (Lei Estadual nº 22.787/2025). 
                            Você pode complementar com informações adicionais se necessário.
                        </p>
                    </div>
                    <label className={labelClass}>Texto do Parecer</label>
                    <textarea 
                        rows={6}
                        className={inputClass}
                        style={{ height: 'auto', minHeight: '150px' }}
                        value={formData.parecerFinal}
                        onChange={e => setFormData({...formData, parecerFinal: e.target.value})}
                        placeholder="Selecione uma classificação para gerar o parecer padrão..."
                    />
                </div>
            </section>

            {/* 6. Header Customization (Conditional) */}
            {showCustomization && (
                <section className="bg-white rounded-xl shadow-md border-t-4 border-gray-400 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-2">
                        <ImageIcon className="text-gray-600" size={24} />
                        <h2 className="text-lg font-bold text-gray-800 uppercase">Personalização (Logos)</h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left Logo */}
                        <div>
                            <label className={labelClass}>Logo Esquerda (Brasão)</label>
                            <p className="text-xs text-gray-500 mb-2">Topo Esquerdo</p>
                            
                            {!formData.logoEsquerda ? (
                                <div className="space-y-3">
                                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-colors">
                                        <Upload className="text-gray-400 mb-2" />
                                        <span className="text-sm text-gray-500 font-medium">Enviar Arquivo</span>
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, 'left')} />
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <LinkIcon size={14} className="text-gray-400" />
                                        </div>
                                        <input 
                                            type="text" 
                                            className={`${inputClass} pl-8 text-xs`} 
                                            placeholder="Ou cole a URL da imagem aqui..." 
                                            onBlur={(e) => handleUrlInput(e, 'logoEsquerda')}
                                            onKeyDown={(e) => e.key === 'Enter' && handleUrlInput(e, 'logoEsquerda')}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="relative w-full h-32 border border-gray-200 rounded-lg p-2 flex items-center justify-center bg-gray-50">
                                    <img 
                                        src={formData.logoEsquerda} 
                                        alt="Logo Esquerda" 
                                        className="max-h-full max-w-full object-contain"
                                        onError={() => {
                                            // Silent fallback or alert
                                            setFormData(prev => ({ ...prev, logoEsquerda: '' }));
                                        }}
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => removeLogo('left')}
                                        className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 shadow-sm"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Right Logo */}
                        <div>
                            <label className={labelClass}>Logo Direita (Defesa Civil)</label>
                            <p className="text-xs text-gray-500 mb-2">Topo Direito</p>
                            
                            {!formData.logoDireita ? (
                                <div className="space-y-3">
                                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-colors">
                                        <Upload className="text-gray-400 mb-2" />
                                        <span className="text-sm text-gray-500 font-medium">Enviar Arquivo</span>
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, 'right')} />
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <LinkIcon size={14} className="text-gray-400" />
                                        </div>
                                        <input 
                                            type="text" 
                                            className={`${inputClass} pl-8 text-xs`} 
                                            placeholder="Ou cole a URL da imagem aqui..." 
                                            onBlur={(e) => handleUrlInput(e, 'logoDireita')}
                                            onKeyDown={(e) => e.key === 'Enter' && handleUrlInput(e, 'logoDireita')}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="relative w-full h-32 border border-gray-200 rounded-lg p-2 flex items-center justify-center bg-gray-50">
                                    <img 
                                        src={formData.logoDireita} 
                                        alt="Logo Direita" 
                                        className="max-h-full max-w-full object-contain" 
                                        onError={() => {
                                            setFormData(prev => ({ ...prev, logoDireita: '' }));
                                        }}
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => removeLogo('right')}
                                        className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 shadow-sm"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            )}

            {/* Submit Button - Footer */}
            <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-gray-400">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    {/* Settings Trigger */}
                    <button
                        type="button"
                        onClick={() => setShowCustomization(!showCustomization)}
                        className="opacity-10 hover:opacity-100 text-gray-500 hover:text-blue-900 hover:bg-gray-100 p-3 rounded-full transition-all flex items-center gap-2 text-sm font-bold uppercase"
                        title="Configurar Logos e Cabeçalho"
                    >
                        <Settings size={24} />
                    </button>

                    {/* Main Actions */}
                    <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-center">
                        
                        {/* Sync Status Indicator */}
                        {GOOGLE_SHEETS_URL && (
                            <div className="mr-4 flex items-center gap-2 text-sm font-bold">
                                {isSyncing ? (
                                    <span className="text-blue-600 flex items-center gap-1"><Loader2 size={16} className="animate-spin" /> Sincronizando...</span>
                                ) : syncStatus === 'success' ? (
                                    <span className="text-green-600 flex items-center gap-1"><Check size={16} /> Dados Enviados</span>
                                ) : syncStatus === 'error' ? (
                                    <span className="text-red-500 flex items-center gap-1"><XCircle size={16} /> Falha no Envio</span>
                                ) : null}
                            </div>
                        )}

                        <button 
                            type="button"
                            onClick={handlePreview}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95 uppercase tracking-wide text-sm md:text-base border border-blue-800 w-full md:w-auto"
                        >
                            <Eye size={20} />
                            Visualizar Laudo
                        </button>
                        <button 
                            type="button"
                            onClick={handleDownload}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-8 rounded-lg shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95 uppercase tracking-wide text-sm md:text-base border border-orange-600 w-full md:w-auto"
                        >
                            <Save size={20} />
                            Emitir PDF
                        </button>
                    </div>
                </div>
            </div>
        </form>
      </main>

      {/* Preview Modal */}
      {showPreview && previewUrl && (
          <div className="fixed inset-0 bg-black/80 z-[200] flex flex-col animate-in fade-in">
              <div className="bg-blue-900 text-white p-4 flex justify-between items-center shadow-lg">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                      <FileText /> Visualização do Laudo
                  </h3>
                  <div className="flex gap-4">
                        <button 
                            onClick={handleDownload}
                            className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded font-bold text-sm uppercase flex items-center gap-2"
                        >
                            <Download size={16} /> Baixar PDF
                        </button>
                        <button 
                            onClick={() => setShowPreview(false)}
                            className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
                        >
                            <X size={24} />
                        </button>
                  </div>
              </div>
              <div className="flex-1 bg-gray-200 p-4 flex justify-center overflow-hidden">
                  <object
                    data={previewUrl}
                    type="application/pdf"
                    className="w-full max-w-5xl h-full rounded shadow-2xl bg-white"
                  >
                      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
                          <p>Seu navegador não suporta visualização de PDF.</p>
                          <a 
                            href={previewUrl} 
                            download={`Laudo_${formData.municipio}.pdf`}
                            className="bg-orange-500 text-white px-4 py-2 rounded font-bold uppercase"
                          >
                             Baixar PDF
                          </a>
                      </div>
                  </object>
              </div>
          </div>
      )}

      {/* Modal for Engineer Add/Edit */}
      {showEngineerModal && (
        <div className="fixed inset-0 bg-blue-900/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 border-t-8 border-orange-500">
                <h3 className="text-xl font-bold mb-6 text-blue-900 uppercase border-b pb-2">
                    {editingEngineer ? 'Editar Engenheiro' : 'Cadastrar Engenheiro'}
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>Nome Completo</label>
                        <input 
                            className={inputClass} 
                            value={newEngineer.name || ''} 
                            onChange={e => setNewEngineer({...newEngineer, name: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1">
                            <label className={labelClass}>Estado</label>
                            <select 
                                className={inputClass}
                                value={newEngineer.state}
                                onChange={e => setNewEngineer({...newEngineer, state: e.target.value})}
                            >
                                {BRAZIL_STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                            </select>
                        </div>
                        <div className="col-span-2">
                             <label className={labelClass}>Número CREA</label>
                            <input 
                                className={inputClass} 
                                value={newEngineer.crea || ''} 
                                onChange={e => setNewEngineer({...newEngineer, crea: e.target.value})}
                            />
                        </div>
                    </div>
                    {/* Institution Field - Read Only for UI logic */}
                    <div>
                        <label className={labelClass}>Instituição</label>
                        <select 
                            className={inputClass}
                            value={newEngineer.institution || 'Voluntário'}
                            onChange={e => setNewEngineer({...newEngineer, institution: e.target.value})}
                        >
                            <option value="CEDEC">CEDEC</option>
                            <option value="Voluntário">Voluntário</option>
                        </select>
                    </div>

                    <div className="flex gap-3 justify-end pt-6">
                        <button 
                            type="button"
                            onClick={() => { setShowEngineerModal(false); if(!editingEngineer) setFormData({...formData, engineerId: ''}); }} 
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md font-bold uppercase text-sm"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="button"
                            onClick={saveEngineer} 
                            className="px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 font-bold uppercase text-sm shadow-md"
                        >
                            Salvar Dados
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Modal for Delete Confirmation */}
      {showDeleteModal && (
          <div className="fixed inset-0 bg-red-900/40 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 border-t-8 border-red-500">
                <div className="flex items-center gap-2 mb-4 text-red-600 border-b pb-2 border-red-100">
                    <Lock size={24} />
                    <h3 className="text-xl font-bold uppercase">Confirmar Exclusão</h3>
                </div>
                
                <p className="text-gray-700 mb-4 text-sm font-medium">
                    Para excluir o cadastro de <span className="font-bold text-black">{selectedEngineer?.name}</span>, digite a senha de administrador.
                </p>

                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>Senha de Admin</label>
                        <input 
                            type="password"
                            className={`${inputClass} ${deleteError ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                            value={deletePassword} 
                            onChange={e => { setDeletePassword(e.target.value); setDeleteError(''); }}
                            placeholder="Digite a senha..."
                            autoFocus
                        />
                        {deleteError && (
                            <p className="text-red-600 text-xs font-bold mt-1 flex items-center gap-1">
                                <AlertTriangle size={12} /> {deleteError}
                            </p>
                        )}
                    </div>
                    
                    <div className="flex gap-3 justify-end pt-4">
                        <button 
                            type="button"
                            onClick={() => setShowDeleteModal(false)} 
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md font-bold uppercase text-sm"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="button"
                            onClick={confirmDeleteEngineer} 
                            className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-bold uppercase text-sm shadow-md flex items-center gap-2"
                        >
                           <Trash2 size={16} /> Excluir
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

export default App;