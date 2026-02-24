import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { City } from '../types';
import { Locate, Loader2, Search, MapPin, X, List } from 'lucide-react';

// Fix Leaflet marker icons in React safely
try {
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
} catch (e) {
    console.warn("Leaflet icon fix failed", e);
}

export interface DownloadState {
    isDownloading: boolean;
    isPreparing: boolean;
    progress: number;
    total: number;
    completed: boolean;
    error: boolean;
}

export interface MapPickerHandle {
    triggerOfflineDownload: () => void;
    cancelOfflineDownload: () => void;
    searchAndCenter: (address: string) => Promise<void>;
}

interface MapPickerProps {
  centerLat: number;
  centerLng: number;
  cityName: string;
  initialZoom?: number;
  selectedCity?: City;
  onLocationSelect: (lat: number, lng: number, addressData?: any) => void;
  onZoomChange?: (zoom: number) => void;
  showMarker?: boolean;
  onDownloadStateChange?: (state: DownloadState) => void;
}

// Math helpers for Tile calculation
const long2tile = (lon: number, zoom: number) => {
    return (Math.floor((lon + 180) / 360 * Math.pow(2, zoom)));
}
const lat2tile = (lat: number, zoom: number) => {
    return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)));
}

// Component to handle map center updates when prop changes
const MapController = ({ 
  lat, 
  lng, 
  zoom,
  ignoreRecenter, 
  shouldFlyToTarget,
  locateTrigger 
}: { 
  lat: number; 
  lng: number, 
  zoom: number,
  ignoreRecenter: React.MutableRefObject<boolean>;
  shouldFlyToTarget: React.MutableRefObject<boolean>;
  locateTrigger: number;
}) => {
  const map = useMap();
  const prevCoords = useRef({ lat, lng });
  const prevZoom = useRef(zoom);
  const prevTrigger = useRef(locateTrigger);
  
  useEffect(() => {
    // Safety check: ensure coordinates are valid numbers
    if (isNaN(lat) || isNaN(lng)) return;

    const coordsChanged = Math.abs(prevCoords.current.lat - lat) > 0.0001 || Math.abs(prevCoords.current.lng - lng) > 0.0001;
    const zoomChanged = prevZoom.current !== zoom;
    const triggerChanged = prevTrigger.current !== locateTrigger;
    
    if (!ignoreRecenter.current) {
        if (coordsChanged || triggerChanged) {
            // Se foi um trigger de busca (shouldFlyToTarget), usa zoom alto (18). 
            // Se foi apenas uma carga de dados (ex: abrir protocolo), usa o zoom salvo.
            const targetZoom = shouldFlyToTarget.current ? 18 : zoom;
            
            map.setView([lat, lng], targetZoom, { animate: true, duration: 1.5 });
            shouldFlyToTarget.current = false; 
        } else if (zoomChanged) {
            // Se mudou só o zoom (ex: scroll do mouse), não reseta o centro!
            // Apenas garante que o zoom está sincronizado se for diferente
            if (map.getZoom() !== zoom) {
                map.setZoom(zoom);
            }
        }
    }

    prevCoords.current = { lat, lng };
    prevZoom.current = zoom;
    prevTrigger.current = locateTrigger;
  }, [lat, lng, zoom, locateTrigger, map, ignoreRecenter, shouldFlyToTarget]);
  return null;
};

const MapInvalidator = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

const MapEventsHandler = ({ onSelect, onZoom }: { onSelect: (lat: number, lng: number) => void, onZoom: (zoom: number) => void }) => {
  useMapEvents({
    click(e) { onSelect(e.latlng.lat, e.latlng.lng); },
    zoomend(e) { onZoom(e.target.getZoom()); }
  });
  return null;
};

// Componente para baixar área offline (Headless - Lógica apenas)
const OfflineDownloader = ({ 
    layerType, 
    triggerRef, 
    cancelRef,
    onStateChange 
}: { 
    layerType: 'osm' | 'sat' | 'hybrid', 
    triggerRef: React.MutableRefObject<(() => void) | null>,
    cancelRef: React.MutableRefObject<(() => void) | null>,
    onStateChange?: (state: DownloadState) => void
}) => {
    const map = useMap();
    const [downloading, setDownloading] = useState(false);
    const [preparing, setPreparing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [total, setTotal] = useState(0);
    const [completed, setCompleted] = useState(false);
    const [errorState, setErrorState] = useState(false);
    
    const abortControllerRef = useRef<AbortController | null>(null);
    const lastStateStr = useRef("");
    
    // Store the callback in a ref to avoid effect dependency loops
    const onStateChangeRef = useRef(onStateChange);
    useEffect(() => {
        onStateChangeRef.current = onStateChange;
    }, [onStateChange]);

    // Efeito para reportar mudanças de estado ao pai
    useEffect(() => {
        const currentState = { isDownloading: downloading, isPreparing: preparing, progress, total, completed, error: errorState };
        const currentStr = JSON.stringify(currentState);
        
        // Só chama o pai se o estado realmente mudou (em string)
        if (currentStr !== lastStateStr.current) {
            lastStateStr.current = currentStr;
            if (onStateChangeRef.current) {
                onStateChangeRef.current(currentState);
            }
        }
    }, [downloading, preparing, progress, total, completed, errorState]);

    const cancelDownload = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setDownloading(false);
        setPreparing(false);
        setCompleted(false);
        setTimeout(() => setTotal(0), 100);
    }, []);

    const downloadArea = useCallback(async () => {
        if (!navigator.onLine) {
            alert("Você precisa estar online para iniciar o download do mapa.");
            return;
        }

        try {
            setPreparing(true);
            setErrorState(false);
            setCompleted(false);

            // Pequeno delay para garantir que a UI mostre "Calculando..." antes de travar o thread com cálculos pesados
            await new Promise(resolve => setTimeout(resolve, 100));

            // USA OS LIMITES ATUAIS DO MAPA (O QUE ESTÁ SENDO MOSTRADO)
            const bounds = map.getBounds();
            // Zoom levels desejados: 14 até 18 (Detalhes de rua)
            const zoomLevels = [14, 15, 16, 17, 18];
            
            let totalTiles = 0;
            const tileRanges: { z: number, xMin: number, xMax: number, yMin: number, yMax: number }[] = [];

            zoomLevels.forEach(z => {
                const top = lat2tile(bounds.getNorth(), z);
                const left = long2tile(bounds.getWest(), z);
                const bottom = lat2tile(bounds.getSouth(), z);
                const right = long2tile(bounds.getEast(), z);
                
                const xMin = Math.min(left, right);
                const xMax = Math.max(left, right);
                const yMin = Math.min(top, bottom);
                const yMax = Math.max(top, bottom);

                const count = (xMax - xMin + 1) * (yMax - yMin + 1);
                totalTiles += count;
                tileRanges.push({ z, xMin, xMax, yMin, yMax });
            });

            const minutesEstimate = Math.ceil((totalTiles * 0.05) / 60); 
            console.log(`[OfflineMap] Calculado: ${totalTiles} imagens para baixar.`);

            // Confirmação se for muita coisa
            if (totalTiles > 2000) {
                // Remove o loading momentaneamente para o alert não travar com loading na tela
                setPreparing(false); 
                await new Promise(resolve => setTimeout(resolve, 100)); // Delay para UI atualizar

                const msg = totalTiles > 10000 
                    ? `ATENÇÃO: ÁREA MUITO GRANDE!\n\nVocê selecionou uma área que requer ${totalTiles} imagens.\nIsso pode levar ${minutesEstimate} minutos ou mais e consumir muitos dados.\n\nDeseja realmente continuar?`
                    : `Você solicitou o download de ${totalTiles} imagens.\nTempo estimado: ~${minutesEstimate} minutos.\n\nDeseja continuar?`;
                    
                if(!confirm(msg)) {
                    // Se cancelar, sai do fluxo. O bloco finally garantirá que preparing fique false.
                    return;
                }
                // Se aceitar, volta o loading
                setPreparing(true); 
            }

            setDownloading(true);
            setTotal(totalTiles);
            setProgress(0);
            setPreparing(false); // Fim da preparação, início do download real

            abortControllerRef.current = new AbortController();
            const signal = abortControllerRef.current.signal;

            let urlTemplate = "";
            if (layerType === 'osm') urlTemplate = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
            else if (layerType === 'sat') urlTemplate = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
            else if (layerType === 'hybrid') urlTemplate = "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}";

            const BATCH_SIZE = 12; 
            let currentBatch: Promise<void>[] = [];
            let completedCount = 0;

            for (const range of tileRanges) {
                if (signal.aborted) break;
                
                for (let x = range.xMin; x <= range.xMax; x++) {
                    for (let y = range.yMin; y <= range.yMax; y++) {
                            if (signal.aborted) break;

                            const subdomain = ['a', 'b', 'c'][Math.floor(Math.random() * 3)];
                            const url = urlTemplate
                            .replace('{z}', range.z.toString())
                            .replace('{x}', x.toString())
                            .replace('{y}', y.toString())
                            .replace('{s}', subdomain);

                            const fetchPromise = fetch(url, { mode: 'cors', cache: 'reload', signal })
                            .then(res => {
                                if (!res.ok) throw new Error('Status ' + res.status);
                                return res;
                            })
                            .catch((err) => {
                                if (signal.aborted) throw err; // Se foi abortado, propaga o erro para o catch
                                return fetch(url, { mode: 'no-cors', cache: 'reload', signal });
                            })
                            .then(() => {
                                if (signal.aborted) return;
                                completedCount++;
                                if (completedCount % 5 === 0 || completedCount === totalTiles) {
                                    setProgress(completedCount);
                                }
                            });

                            currentBatch.push(fetchPromise);

                            if (currentBatch.length >= BATCH_SIZE) {
                                await Promise.all(currentBatch);
                                currentBatch = [];
                            }
                    }
                }
            }

            if (currentBatch.length > 0 && !signal.aborted) {
                await Promise.all(currentBatch);
            }

            if (!signal.aborted) {
                setCompleted(true);
                setTimeout(() => setCompleted(false), 4000);
            }
        } catch (error: any) {
            // Ignora erro se for cancelamento intencional ou AbortError
            if (error.name === 'AbortError' || (abortControllerRef.current && abortControllerRef.current.signal.aborted)) {
                console.log("Download cancelado pelo usuário.");
            } else {
                console.error("Erro crítico no download:", error);
                setErrorState(true);
                setTimeout(() => setErrorState(false), 3000);
                alert("Ocorreu um erro durante o download. Tente uma área menor.");
            }
        } finally {
            // Garante que o estado de "Calculando..." seja sempre removido, mesmo em caso de erro ou return antecipado
            setPreparing(false);
            setDownloading(false);
        }
    }, [map, layerType]);

    useEffect(() => {
        if (triggerRef) triggerRef.current = downloadArea;
        if (cancelRef) cancelRef.current = cancelDownload;
    }, [downloadArea, cancelDownload, triggerRef, cancelRef]);

    return null; 
};

// Extract number from string to preserve user input in autocomplete
const extractNumber = (text: string) => {
    const match = text.match(/\b\d+\b/);
    return match ? match[0] : null;
};

// Match a house number against ViaCEP range strings
const matchCepByNumber = (numberStr: string | null, complemento: string): boolean => {
    if (!numberStr) return false;
    // Remove non-digits for parsing
    const num = parseInt(numberStr.replace(/\D/g, ''));
    if (isNaN(num)) return false;

    const comp = (complemento || "").toLowerCase();
    
    // Par/Ímpar check
    const isPar = comp.includes('par');
    const isImpar = comp.includes('ímpar') || comp.includes('impar');
    
    if (isPar && num % 2 !== 0) return false;
    if (isImpar && num % 2 === 0) return false;

    // Range check: "de 1 a 100"
    const rangeMatch = comp.match(/de (\d+) a (\d+)/);
    if (rangeMatch) {
        const start = parseInt(rangeMatch[1]);
        const end = parseInt(rangeMatch[2]);
        return num >= start && num <= end;
    }

    // Range check: "de 101 ao fim"
    const startMatch = comp.match(/de (\d+) ao fim/);
    if (startMatch) {
        const start = parseInt(startMatch[1]);
        return num >= start;
    }

    // Range check: "até 50"
    const endMatch = comp.match(/até (\d+)/);
    if (endMatch) {
        const end = parseInt(endMatch[1]);
        return num <= end;
    }

    // If it mentions par/impar but no range, and we passed the par/impar check, it's a potential match
    if (isPar || isImpar) return true;

    return false;
};

// --- CEP SELECTOR MODAL COMPONENT ---
interface CepOption {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
}

const CepSelectorModal = ({ 
  options, 
  onSelect, 
  onCancel 
}: { 
  options: CepOption[], 
  onSelect: (option: CepOption) => void, 
  onCancel: () => void 
}) => {
  return (
    <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90%]">
        <div className="bg-blue-900 text-white p-4 flex justify-between items-center shrink-0">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <List size={20} className="text-orange-400"/> Múltiplos CEPs Encontrados
            </h3>
            <p className="text-xs text-blue-200 mt-1">
              Esta rua possui CEPs diferentes por trecho. Selecione o correto:
            </p>
          </div>
          <button onClick={onCancel} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="overflow-y-auto p-2 space-y-2 bg-gray-50 flex-1">
          {options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => onSelect(opt)}
              className="w-full text-left bg-white p-3 rounded-lg border border-gray-200 hover:border-orange-500 hover:shadow-md transition-all group relative"
            >
              <div className="flex justify-between items-start">
                <div>
                   <span className="block font-bold text-gray-800 text-sm">{opt.logradouro}</span>
                   {opt.complemento && (
                     <span className="block text-xs font-semibold text-orange-600 mt-0.5 uppercase bg-orange-50 inline-block px-1.5 py-0.5 rounded border border-orange-100">
                       {opt.complemento}
                     </span>
                   )}
                   <span className="block text-xs text-gray-500 mt-1">{opt.bairro} - {opt.localidade}/{opt.uf}</span>
                </div>
                <div className="text-right">
                  <span className="block font-black text-blue-900 text-base">{opt.cep}</span>
                </div>
              </div>
              <div className="absolute inset-0 border-2 border-orange-500 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"></div>
            </button>
          ))}
        </div>
        
        <div className="p-3 bg-gray-100 text-center text-xs text-gray-500 shrink-0 border-t border-gray-200">
           Caso não encontre o trecho exato, selecione o mais próximo ou feche para manter o CEP geral.
        </div>
      </div>
    </div>
  );
};

// Helper function to query ViaCEP
const fetchViaCepCandidates = async (city: string, road: string): Promise<CepOption[]> => {
    try {
        const cleanCity = city.trim();
        const cleanRoad = road.trim();
        const url = `https://viacep.com.br/ws/PR/${encodeURIComponent(cleanCity)}/${encodeURIComponent(cleanRoad)}/json/`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
            return data as CepOption[];
        }
    } catch (e) {
        console.warn("Falha ao consultar ViaCEP", e);
    }
    return [];
};

export const MapPicker = forwardRef<MapPickerHandle, MapPickerProps>(({ 
    centerLat, 
    centerLng, 
    cityName,
    initialZoom = 15, 
    onLocationSelect, 
    onZoomChange, 
    showMarker = true,
    onDownloadStateChange
}, ref) => {
  const [layer, setLayer] = useState<'osm' | 'sat' | 'hybrid'>('hybrid');
  const [isLocating, setIsLocating] = useState(false);
  const [locateTrigger, setLocateTrigger] = useState(0); 
  const [currentZoom, setCurrentZoom] = useState(initialZoom); // Estado para o zoom atual
  const downloadTriggerRef = useRef<(() => void) | null>(null);
  const cancelDownloadRef = useRef<(() => void) | null>(null);

  // Sincroniza o zoom inicial se mudar externamente (ex: troca de cidade ou carregamento de protocolo)
  useEffect(() => {
      setCurrentZoom(initialZoom);
  }, [initialZoom]);

  // Search State
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // CEP Selection Modal State
  const [showCepModal, setShowCepModal] = useState(false);
  const [cepCandidates, setCepCandidates] = useState<CepOption[]>([]);
  const [pendingLocationData, setPendingLocationData] = useState<{lat: number, lng: number, addressData: any} | null>(null);

  const ignoreRecenter = useRef(false);
  const shouldFlyToTarget = useRef(false);
  const skipSearchRef = useRef(false);

  useEffect(() => {
    setSearchText('');
    setSuggestions([]);
  }, [cityName]); 

  // Debounce search logic
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
        if (skipSearchRef.current) {
            skipSearchRef.current = false;
            return;
        }

        if (searchText.length > 2) {
            setIsSearching(true);
            try {
                let query = searchText;
                if (!query.toLowerCase().includes(cityName.toLowerCase())) {
                    query = `${query}, ${cityName}`;
                }
                query += `, Paraná, Brasil`;

                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&countrycodes=br`);
                const data = await response.json();
                setSuggestions(data);
                setShowSuggestions(true);
            } catch (e) {
                console.error("Erro no autocomplete", e);
            } finally {
                setIsSearching(false);
            }
        } else if (searchText.length <= 2) {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }, 800); 

    return () => clearTimeout(delayDebounceFn);
  }, [searchText, cityName]);

  const finalizeLocationSelect = useCallback((lat: number, lng: number, addressData: any) => {
      onLocationSelect(lat, lng, addressData);
      setPendingLocationData(null);
      setShowCepModal(false);
  }, [onLocationSelect]);

  const processLocationWithViaCep = useCallback(async (lat: number, lng: number, addressData: any, houseNumber?: string | null) => {
      const city = addressData.city || addressData.town || addressData.village || cityName;
      const road = addressData.road;

      if (city && road) {
          const candidates = await fetchViaCepCandidates(city, road);
          const uniqueCeps = Array.from(new Set(candidates.map(c => c.cep)));
          
          if (uniqueCeps.length > 1) {
              // Tenta auto-filtragem pelo número do imóvel
              const hNum = houseNumber || addressData.house_number || extractNumber(searchText);
              
              if (hNum) {
                  const matched = candidates.find(c => matchCepByNumber(hNum, c.complemento));
                  if (matched) {
                      const finalAddressData = {
                          ...addressData,
                          postcode: matched.cep,
                          suburb: matched.bairro || addressData.suburb,
                          road: matched.logradouro || addressData.road,
                          house_number: hNum
                      };
                      finalizeLocationSelect(lat, lng, finalAddressData);
                      return;
                  }
                  
                  // Se tem número mas não deu match exato nas faixas do ViaCEP, 
                  // ainda mostramos o modal para o usuário decidir ou mantemos o primeiro como fallback?
                  // O pedido diz: "A janela de escolha só abre quando não foi definido número predial"
                  // Mas se o número não bate com nenhuma faixa, o modal é a segurança.
                  // Vou manter o modal apenas se o número for nulo/vazio.
              }

              // Se NÃO foi definido número predial, abre a janela
              if (!hNum) {
                  setPendingLocationData({ lat, lng, addressData });
                  setCepCandidates(candidates);
                  setShowCepModal(true);
                  return;
              }
          }
          
          if (candidates.length >= 1) {
              // Se só tem um CEP ou se o número não bateu mas queremos evitar o modal:
              const matched = houseNumber ? candidates.find(c => matchCepByNumber(houseNumber, c.complemento)) : candidates[0];
              const bestCandidate = matched || candidates[0];
              
              const finalAddressData = {
                  ...addressData,
                  postcode: bestCandidate.cep,
                  suburb: bestCandidate.bairro || addressData.suburb,
                  road: bestCandidate.logradouro || addressData.road,
                  house_number: houseNumber || addressData.house_number
              };
              finalizeLocationSelect(lat, lng, finalAddressData);
              return;
          }
      }
      finalizeLocationSelect(lat, lng, addressData);
  }, [cityName, finalizeLocationSelect, searchText]);

  const handleSelect = useCallback(async (lat: number, lng: number, fromGPS = false) => {
    if (!fromGPS) ignoreRecenter.current = true;
    else ignoreRecenter.current = false;

      try {
      // 1. Nominatim Reverse Geocoding
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      const data = await response.json();
      const addressData = data.address;
      
      await processLocationWithViaCep(lat, lng, addressData);
    } catch (error) {
      finalizeLocationSelect(lat, lng, {}); 
    }
    setTimeout(() => { ignoreRecenter.current = false; }, 1000);
  }, [finalizeLocationSelect]);

  useImperativeHandle(ref, () => ({
    triggerOfflineDownload: () => {
        if (downloadTriggerRef.current) {
            downloadTriggerRef.current();
        }
    },
    cancelOfflineDownload: () => {
        if (cancelDownloadRef.current) {
            cancelDownloadRef.current();
        }
    },
    searchAndCenter: async (address: string) => {
        setIsSearching(true);
        skipSearchRef.current = true;
        setSearchText(address);
        try {
            // Construct query specific to the context to limit results
            const query = `${address}, ${cityName}, Paraná, Brasil`;
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=1`);
            const data = await response.json();
            
            if (data && data.length > 0) {
                const result = data[0];
                const lat = parseFloat(result.lat);
                const lng = parseFloat(result.lon);
                
                // Trigger Map Movement
                shouldFlyToTarget.current = true;
                if(onZoomChange) onZoomChange(18); // Close zoom
                setLocateTrigger(prev => prev + 1); // Force re-render/move in MapController
                
                // Select Location using the data we found
                const addressData = result.address;
                await processLocationWithViaCep(lat, lng, addressData);
                
                ignoreRecenter.current = false;
            } else {
                console.log("Endereço não encontrado no mapa.");
            }
        } catch (e) {
            console.error("Auto-center failed", e);
        } finally {
            setIsSearching(false);
        }
    }
  }));

  const handleSelectSuggestion = async (suggestion: any) => {
      const lat = parseFloat(suggestion.lat);
      const lng = parseFloat(suggestion.lon);
      const userNumber = extractNumber(searchText);
      let displayName = suggestion.address.road || suggestion.display_name.split(',')[0];
      
      let addressData = { ...suggestion.address };

      if (suggestion.address.house_number) {
          displayName += `, ${suggestion.address.house_number}`;
      } else if (userNumber && !displayName.includes(userNumber)) {
          displayName += `, ${userNumber}`;
          addressData.house_number = userNumber; 
      }

      skipSearchRef.current = true;
      setSearchText(displayName);
      setSuggestions([]);
      setShowSuggestions(false); 
      shouldFlyToTarget.current = true;
      if (onZoomChange) onZoomChange(19);

      await processLocationWithViaCep(lat, lng, addressData, userNumber);
      
      ignoreRecenter.current = false;
  };

  const handleCepOptionSelect = (option: CepOption) => {
      if (pendingLocationData) {
          const mergedAddress = {
              ...pendingLocationData.addressData,
              postcode: option.cep,
              suburb: option.bairro || pendingLocationData.addressData.suburb,
              road: option.logradouro || pendingLocationData.addressData.road,
          };
          finalizeLocationSelect(pendingLocationData.lat, pendingLocationData.lng, mergedAddress);
      }
  };

  const handleSearchAddress = () => {
    if (suggestions.length > 0) setShowSuggestions(true);
  };

  const handleLocateUser = () => {
      if (!navigator.geolocation) { alert("Geolocalização não suportada."); return; }
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
          (position) => {
              const { latitude, longitude } = position.coords;
              shouldFlyToTarget.current = true; 
              setLocateTrigger(t => t + 1); 
              handleSelect(latitude, longitude, true);
              setIsLocating(false);
          },
          (error) => { console.error(error); alert("Erro ao obter localização."); setIsLocating(false); },
          { enableHighAccuracy: true, timeout: 10000 }
      );
  };

  // If coordinates are invalid, show a fallback or a loader instead of crashing
  const hasValidCoordinates = !isNaN(centerLat) && !isNaN(centerLng);

  if (!hasValidCoordinates) {
      return (
        <div id="map-print-container" className="relative w-full h-[450px] rounded-lg overflow-hidden border border-gray-300 z-0 bg-gray-100 flex items-center justify-center flex-col text-gray-500">
             <MapPin size={48} className="mb-2 opacity-50"/>
             <p>Aguardando localização válida...</p>
             <p className="text-xs">Selecione um município ou habilite o GPS.</p>
        </div>
      );
  }

  // Stabilize handlers to prevent map re-binding loops
  const onMapSelect = useCallback((lat: number, lng: number) => handleSelect(lat, lng), [handleSelect]);
  
  // Atualizado: Atualiza estado local E avisa o pai
  const onMapZoom = useCallback((zoom: number) => { 
      setCurrentZoom(zoom);
      if(onZoomChange) onZoomChange(zoom); 
  }, [onZoomChange]);

  return (
    <div id="map-print-container" className="relative w-full h-[450px] rounded-lg overflow-hidden border border-gray-300 z-0 group">
      
      {/* CEP SELECTION MODAL */}
      {showCepModal && (
          <CepSelectorModal 
             options={cepCandidates} 
             onSelect={handleCepOptionSelect} 
             onCancel={() => {
                 // Use raw Nominatim data if user cancels
                 if(pendingLocationData) finalizeLocationSelect(pendingLocationData.lat, pendingLocationData.lng, pendingLocationData.addressData);
             }}
          />
      )}

      {/* SEARCH BAR (CENTERED TOP) */}
      <div className={`map-search-container absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] w-[90%] max-w-md transition-all duration-300 opacity-100 translate-y-0`}>
            <div className="flex flex-col gap-2">
                <div className="relative shadow-2xl rounded-full">
                    <input 
                        type="text" 
                        className="w-full pl-4 pr-10 py-3 rounded-full text-sm font-medium bg-white text-gray-800 focus:outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-orange-500 shadow-sm"
                        placeholder={`Endereço em ${cityName}...`}
                        value={searchText}
                        onChange={(e) => {
                             skipSearchRef.current = false;
                             setSearchText(e.target.value);
                        }}
                        onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true); }}
                    />
                    <div className="absolute right-3 top-2.5 text-gray-400">
                        {isSearching ? <Loader2 size={20} className="animate-spin text-orange-500" /> : (searchText ? <X size={20} className="cursor-pointer hover:text-gray-600" onClick={() => { setSearchText(''); setSuggestions([]); }}/> : <button type="button" onClick={() => handleSearchAddress()}><Search size={20} /></button>)}
                    </div>
                </div>
            </div>

         {/* AUTOCOMPLETE SUGGESTIONS */}
         {showSuggestions && suggestions.length > 0 && (
             <ul className="mt-2 bg-white rounded-xl shadow-xl overflow-hidden border border-gray-100 animate-in slide-in-from-top-2 max-h-60 overflow-y-auto">
                 {suggestions.map((item, idx) => {
                     const userNumber = extractNumber(searchText);
                     let displayMain = item.address.road || item.display_name.split(',')[0];
                     
                     if (item.address.house_number) {
                         displayMain += `, ${item.address.house_number}`;
                     } else if (userNumber && !displayMain.includes(userNumber)) {
                         displayMain += `, ${userNumber}`;
                     }

                     return (
                        <li 
                            key={idx}
                            onClick={() => handleSelectSuggestion(item)}
                            className="px-4 py-3 hover:bg-orange-50 cursor-pointer border-b border-gray-50 last:border-0 flex items-start gap-3 transition-colors text-left"
                        >
                            <MapPin className="text-orange-500 mt-0.5 shrink-0" size={16} />
                            <div className="flex-1">
                                <p className="text-sm font-bold text-gray-800 leading-tight">
                                    {displayMain}
                                </p>
                                <p className="text-[10px] text-gray-500 mt-0.5 leading-tight line-clamp-2">{item.display_name}</p>
                            </div>
                        </li>
                     );
                 })}
             </ul>
         )}
      </div>

      {/* CONTROLS (Top Right - Zoom & Layers) */}
      <div className={`map-custom-controls absolute top-4 right-2 z-[400] flex flex-col gap-2 items-end transition-opacity duration-300 opacity-100`}>
          
          {/* INDICADOR DE ZOOM */}
          <div className={`px-2 py-1 rounded text-[10px] font-bold shadow-sm border mb-1 backdrop-blur-sm transition-colors ${
             currentZoom >= 14 
             ? 'bg-green-100 text-green-800 border-green-200' 
             : 'bg-orange-100 text-orange-800 border-orange-200'
          }`}>
              Zoom: {currentZoom}
          </div>

          <div className="bg-white p-1.5 rounded-lg shadow-md border border-gray-200 flex flex-col gap-1">
            <button type="button" className={`px-2 py-1 text-[10px] font-bold rounded ${layer === 'hybrid' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`} onClick={() => { setLayer('hybrid'); }}>Híbrido</button>
            <button type="button" className={`px-2 py-1 text-[10px] font-bold rounded ${layer === 'sat' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`} onClick={() => { setLayer('sat'); }}>Satélite</button>
            <button type="button" className={`px-2 py-1 text-[10px] font-bold rounded ${layer === 'osm' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`} onClick={() => { setLayer('osm'); }}>Mapa</button>
          </div>
          
          <button type="button" onClick={handleLocateUser} disabled={isLocating} className="bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-10 h-10" title="Minha Localização">
            {isLocating ? <Loader2 size={20} className="animate-spin" /> : <Locate size={20} />}
          </button>
      </div>
      
      <MapContainer 
        center={[centerLat, centerLng]} 
        zoom={initialZoom} 
        style={{ height: '100%', width: '100%' }} 
        zoomSnap={0.5} 
        zoomDelta={0.5}
      >
        {layer === 'osm' && (<TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" crossOrigin="anonymous" />)}
        {layer === 'sat' && (<TileLayer attribution='Tiles &copy; Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" crossOrigin="anonymous" />)}
        {layer === 'hybrid' && (<TileLayer attribution='&copy; Google Maps' url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" crossOrigin="anonymous" />)}
        
        <MapController 
            lat={centerLat} 
            lng={centerLng} 
            zoom={initialZoom} 
            ignoreRecenter={ignoreRecenter} 
            shouldFlyToTarget={shouldFlyToTarget}
            locateTrigger={locateTrigger}
        />
        <MapInvalidator />
        
        {/* Lógica de Download Offline (sem UI) */}
        <OfflineDownloader layerType={layer} triggerRef={downloadTriggerRef} cancelRef={cancelDownloadRef} onStateChange={onDownloadStateChange} />
        
        {showMarker && <Marker position={[centerLat, centerLng]} />}
        <MapEventsHandler onSelect={onMapSelect} onZoom={onMapZoom} />
      </MapContainer>
      
      <div className={`map-instruction bg-blue-50 text-blue-800 text-xs p-2 text-center border-t border-blue-100 absolute bottom-0 w-full z-[400] opacity-100`}>
          Clique no mapa para definir a localização exata.
      </div>
    </div>
  );
});