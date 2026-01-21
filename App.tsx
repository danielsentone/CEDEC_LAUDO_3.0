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
  BRAZIL_STATES 
} from './constants';
import { MapPicker } from './components/MapPicker';
import { DamageInput } from './components/DamageInput';
import { generateLaudoPDF } from './services/pdfService';
import { FileText, Save, MapPin, User, AlertTriangle, Building, Shield, Trash2, Edit, Lock, CheckCircle, XCircle, Trees, Eye, X, Download, Image as ImageIcon, Upload } from 'lucide-react';

// Helper for CPF Mask
const formatCPF = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
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

// Helper to process and trim whitespace from images
const processAndTrimImage = (file: File): Promise<string> => {
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
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

function App() {
  // Load engineers from localStorage or use initial list
  const [engineers, setEngineers] = useState<Engineer[]>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('dc_pr_engineers');
        if (saved) return JSON.parse(saved);
    }
    return INITIAL_ENGINEERS;
  });

  // Persist engineers on change
  useEffect(() => {
    localStorage.setItem('dc_pr_engineers', JSON.stringify(engineers));
  }, [engineers]);

  const [formData, setFormData] = useState<LaudoForm>({
    municipio: '',
    data: new Date().toISOString().split('T')[0],
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
    lat: -25.4284, // Default Curitiba
    lng: -49.2733,
    tipologia: '' as BuildingTypology, // Force user selection
    tipologiaOutro: '',
    danos: [],
    classificacao: '' as DamageClassification, // Force user selection
    logoEsquerda: '',
    logoDireita: ''
  });

  // Auto-increment ID starting at 1, persisted in localStorage to simulate database sequence
  const [idLaudo] = useState(() => {
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
  const [newEngineer, setNewEngineer] = useState<Partial<Engineer>>({ state: 'PR' });
  const [editingEngineer, setEditingEngineer] = useState<Engineer | null>(null);

  // Delete Confirmation States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Preview State
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Validation State
  const [cpfValid, setCpfValid] = useState<boolean | null>(null);
  const [cpfErrorMessage, setCpfErrorMessage] = useState<string>('');

  // Computed Values
  const selectedEngineer = engineers.find(e => e.id === formData.engineerId);
  const damageStats = formData.classificacao 
    ? DAMAGE_LOGIC[formData.classificacao] 
    : { level: '---', percent: '---' };

  // Standard input style class for consistency
  const inputClass = "w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 py-2 px-3 border bg-white text-black";
  const labelClass = "block text-sm font-bold text-blue-900 mb-1";

  // Logic to center map on city selection
  const handleCityChange = (cityName: string) => {
    const city = PARANA_CITIES.find(c => c.name === cityName);
    setFormData(prev => ({
      ...prev,
      municipio: cityName,
      lat: city ? city.lat : prev.lat,
      lng: city ? city.lng : prev.lng
    }));
  };

  // Logic to handle Engineer Selection
  const handleEngineerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'OUTRO') {
      setShowEngineerModal(true);
      setNewEngineer({ state: 'PR', name: '', crea: '' });
      setEditingEngineer(null);
    } else {
      setFormData(prev => ({ ...prev, engineerId: val }));
    }
  };

  const saveEngineer = () => {
    if (!newEngineer.name || !newEngineer.crea) return alert("Preencha nome e CREA");
    
    if (editingEngineer) {
        // Edit existing
        setEngineers(prev => prev.map(eng => eng.id === editingEngineer.id ? { ...eng, ...newEngineer } as Engineer : eng));
        setFormData(prev => ({ ...prev, engineerId: editingEngineer.id }));
    } else {
        // Create new
        const newId = Date.now().toString();
        const eng: Engineer = {
            id: newId,
            name: newEngineer.name!,
            crea: newEngineer.crea!,
            state: newEngineer.state,
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
          // Default to PR if state is missing (e.g. from old data)
          setNewEngineer({ ...selectedEngineer, state: selectedEngineer.state || 'PR' });
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

      if (val.length === 14) {
          const isValid = validateCPF(val);
          setCpfValid(isValid);
          if (!isValid) setCpfErrorMessage('CPF Inválido');
      } else {
          setCpfValid(null);
      }
  };

  const handleCpfBlur = () => {
    const val = formData.cpfRequerente;
    if (val.length > 0 && val.length < 14) {
        setCpfValid(false);
        setCpfErrorMessage('CPF incompleto');
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

  const validateForm = () => {
    if (!selectedEngineer) { alert("Selecione um engenheiro"); return false; }
    if (!formData.municipio) { alert("Selecione um município"); return false; }
    if (!formData.tipologia) { alert("Selecione a Tipologia da Edificação"); return false; }
    if (!formData.classificacao) { alert("Selecione a Classificação dos Danos"); return false; }
    if (cpfValid === false) { alert(cpfErrorMessage || "CPF do Requerente inválido!"); return false; }
    return true;
  };

  const captureMap = async () => {
    const mapElement = document.getElementById('map-print-container');
    if (!mapElement) return null;
    try {
        const canvas = await html2canvas(mapElement, {
            useCORS: true,
            allowTaint: false,
            logging: false,
            scale: 2 // Improved resolution
        });
        return canvas.toDataURL('image/png');
    } catch (e) {
        console.error("Failed to capture map", e);
        return null;
    }
  };

  const handlePreview = async () => {
    if (!validateForm()) return;
    if (selectedEngineer) {
        const mapImg = await captureMap();
        const url = await generateLaudoPDF({ ...formData, id_laudo: idLaudo }, selectedEngineer, 'preview', mapImg || undefined);
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
        const mapImg = await captureMap();
        await generateLaudoPDF({ ...formData, id_laudo: idLaudo }, selectedEngineer, 'save', mapImg || undefined);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-8">
      {/* Header with Defesa Civil Colors */}
      <header className="bg-blue-900 text-white shadow-lg sticky top-0 z-50 border-b-4 border-orange-500">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="bg-orange-500 p-2 rounded-lg shadow-md">
                    <Shield size={32} className="text-white fill-blue-900" />
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-wide uppercase">Defesa Civil</h1>
                    <p className="text-xs md:text-sm font-semibold text-blue-100 uppercase tracking-wider">
                        Coordenadoria Estadual - Paraná
                    </p>
                </div>
            </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <form className="space-y-8">
            
            {/* 0. Header Customization */}
            <section className="bg-white rounded-xl shadow-md border-t-4 border-gray-400 overflow-hidden">
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
                             <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-colors">
                                <Upload className="text-gray-400 mb-2" />
                                <span className="text-sm text-gray-500 font-medium">Enviar Imagem</span>
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, 'left')} />
                             </label>
                        ) : (
                            <div className="relative w-full h-32 border border-gray-200 rounded-lg p-2 flex items-center justify-center bg-gray-50">
                                <img src={formData.logoEsquerda} alt="Logo Esquerda" className="max-h-full max-w-full object-contain" />
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
                             <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-colors">
                                <Upload className="text-gray-400 mb-2" />
                                <span className="text-sm text-gray-500 font-medium">Enviar Imagem</span>
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, 'right')} />
                             </label>
                        ) : (
                            <div className="relative w-full h-32 border border-gray-200 rounded-lg p-2 flex items-center justify-center bg-gray-50">
                                <img src={formData.logoDireita} alt="Logo Direita" className="max-h-full max-w-full object-contain" />
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

            {/* 1. Basic Info Section */}
            <section className="bg-white rounded-xl shadow-md border-t-4 border-blue-600 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-2">
                    <MapPin className="text-orange-600" size={24} />
                    <h2 className="text-lg font-bold text-blue-900 uppercase">1. Localização e Data</h2>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className={labelClass}>Município</label>
                        <select 
                            className={inputClass}
                            value={formData.municipio}
                            onChange={(e) => handleCityChange(e.target.value)}
                            required
                        >
                            <option value="">Selecione...</option>
                            {PARANA_CITIES.map(c => (
                                <option key={c.name} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Data da Vistoria</label>
                        <input 
                            type="date"
                            className={`${inputClass} bg-gray-100 cursor-not-allowed opacity-75`}
                            value={formData.data}
                            readOnly
                            tabIndex={-1}
                        />
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
                                    <input 
                                        type="text"
                                        className={inputClass}
                                        value={formData.indicacaoFiscal}
                                        onChange={e => setFormData({...formData, indicacaoFiscal: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Inscrição Imobiliária</label>
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
                                required
                            />
                        </div>
                        <div className="col-span-1">
                            <label className={labelClass}>CPF do Requerente</label>
                            <div className="relative">
                                <input 
                                    type="text"
                                    className={`${inputClass} ${cpfValid === false ? 'border-red-500 ring-1 ring-red-500' : ''} ${cpfValid === true ? 'border-green-500 ring-1 ring-green-500' : ''}`}
                                    value={formData.cpfRequerente}
                                    onChange={handleCpfChange}
                                    onBlur={handleCpfBlur}
                                    placeholder="000.000.000-00"
                                    maxLength={14}
                                    required
                                />
                                <div className="absolute right-3 top-2.5">
                                    {cpfValid === true && <CheckCircle size={20} className="text-green-600" />}
                                    {cpfValid === false && <XCircle size={20} className="text-red-600" />}
                                </div>
                            </div>
                            {cpfValid === false && <p className="text-xs text-red-600 font-bold mt-1">{cpfErrorMessage || 'CPF Inválido'}</p>}
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
                        <label className="block text-sm font-bold text-blue-900 mb-2">Localização Geográfica (Selecione no Mapa)</label>
                        <MapPicker 
                            centerLat={formData.lat}
                            centerLng={formData.lng}
                            onLocationSelect={handleLocationSelect}
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
                             <input type="number" step="any" value={formData.lat} onChange={e => setFormData({...formData, lat: parseFloat(e.target.value)})} className={inputClass} />
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Longitude</label>
                             <input type="number" step="any" value={formData.lng} onChange={e => setFormData({...formData, lng: parseFloat(e.target.value)})} className={inputClass} />
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
                             onChange={e => setFormData({...formData, classificacao: e.target.value as DamageClassification})}
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

            {/* Submit Button - Static Footer */}
            <div className="bg-white rounded-xl shadow-md p-6 border-t-4 border-gray-400">
                <div className="flex flex-col md:flex-row justify-end gap-4">
                    <button 
                        type="button"
                        onClick={handlePreview}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95 uppercase tracking-wide text-sm md:text-base border border-blue-800"
                    >
                        <Eye size={20} />
                        Visualizar Laudo
                    </button>
                    <button 
                        type="button"
                        onClick={handleDownload}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-8 rounded-lg shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95 uppercase tracking-wide text-sm md:text-base border border-orange-600"
                    >
                        <Save size={20} />
                        Emitir PDF
                    </button>
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