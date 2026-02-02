import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { City } from '../types';
import { Locate, Loader2 } from 'lucide-react';

// Fix Leaflet marker icons in React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapPickerProps {
  centerLat: number;
  centerLng: number;
  initialZoom?: number;
  selectedCity?: City;
  onLocationSelect: (lat: number, lng: number, addressData?: any) => void;
  onZoomChange?: (zoom: number) => void;
  showMarker?: boolean;
}

// Component to handle map center updates when prop changes
const MapController = ({ lat, lng, zoom, ignoreRecenter }: { lat: number; lng: number, zoom: number, ignoreRecenter: React.MutableRefObject<boolean> }) => {
  const map = useMap();
  const prevCoords = useRef({ lat, lng });
  
  useEffect(() => {
    // Se a mudança de coordenadas for significativa (ex: mudou de cidade ou usou GPS)
    // E NÃO for uma interação manual do usuário (ignoreRecenter = false), nós centralizamos.
    const coordsChanged = Math.abs(prevCoords.current.lat - lat) > 0.0001 || Math.abs(prevCoords.current.lng - lng) > 0.0001;
    
    if (coordsChanged && !ignoreRecenter.current) {
        map.setView([lat, lng], map.getZoom()); // Mantém o zoom atual ao reposicionar se possível ou usa zoom prop
        prevCoords.current = { lat, lng };
    } else if (coordsChanged) {
        prevCoords.current = { lat, lng };
    }
    // Removido zoom da dependência para evitar snaps indesejados ao apenas dar zoom
  }, [lat, lng, map, ignoreRecenter]);

  return null;
};

// Component to fix rendering issues by invalidating size
const MapInvalidator = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
        map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

// Component to handle clicks and zoom changes
const MapEventsHandler = ({ onSelect, onZoom }: { onSelect: (lat: number, lng: number) => void, onZoom: (zoom: number) => void }) => {
  const map = useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
    zoomend() {
      onZoom(map.getZoom());
    }
  });
  return null;
};

export const MapPicker: React.FC<MapPickerProps> = ({ centerLat, centerLng, initialZoom = 15, onLocationSelect, onZoomChange, showMarker = true }) => {
  const [layer, setLayer] = useState<'osm' | 'sat' | 'hybrid'>('hybrid');
  const [isLocating, setIsLocating] = useState(false);
  
  // Ref para controlar se a próxima atualização de lat/lng deve centralizar o mapa ou não.
  const ignoreRecenter = useRef(false);

  const handleSelect = async (lat: number, lng: number, fromGPS = false) => {
    if (!fromGPS) {
        ignoreRecenter.current = true;
    } else {
        ignoreRecenter.current = false;
    }

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      onLocationSelect(lat, lng, data.address);
    } catch (error) {
      onLocationSelect(lat, lng); 
    }
    
    setTimeout(() => {
        ignoreRecenter.current = false;
    }, 1000);
  };

  const handleLocateUser = () => {
      if (!navigator.geolocation) {
          alert("Geolocalização não suportada.");
          return;
      }
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
          (position) => {
              const { latitude, longitude } = position.coords;
              handleSelect(latitude, longitude, true);
              setIsLocating(false);
          },
          (error) => {
              alert("Erro ao obter localização.");
              setIsLocating(false);
          },
          { enableHighAccuracy: true }
      );
  };

  return (
    <div id="map-print-container" className="relative w-full h-[400px] rounded-lg overflow-hidden border border-gray-300 z-0">
      <div className="map-custom-controls absolute top-2 right-2 z-[400] flex flex-col gap-2 items-end">
          <div className="bg-white p-2 rounded shadow flex gap-2">
            <button type="button" className={`px-3 py-1 text-xs font-bold rounded ${layer === 'hybrid' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setLayer('hybrid')}>Híbrido</button>
            <button type="button" className={`px-3 py-1 text-xs font-bold rounded ${layer === 'sat' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setLayer('sat')}>Satélite</button>
            <button type="button" className={`px-3 py-1 text-xs font-bold rounded ${layer === 'osm' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setLayer('osm')}>Mapa</button>
          </div>
          <button type="button" onClick={handleLocateUser} disabled={isLocating} className="bg-orange-500 hover:bg-orange-600 text-white p-2 rounded shadow-lg flex items-center gap-2 text-xs font-bold uppercase transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed" title="GPS">
            {isLocating ? <Loader2 size={16} className="animate-spin" /> : <Locate size={16} />} Minha Localização
          </button>
      </div>
      <MapContainer center={[centerLat, centerLng]} zoom={initialZoom} style={{ height: '100%', width: '100%' }} zoomSnap={0.5} zoomDelta={0.5}>
        {layer === 'osm' && (<TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" crossOrigin="anonymous" />)}
        {layer === 'sat' && (<TileLayer attribution='Tiles &copy; Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" crossOrigin="anonymous" />)}
        {layer === 'hybrid' && (<TileLayer attribution='&copy; Google Maps' url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" crossOrigin="anonymous" />)}
        <MapController lat={centerLat} lng={centerLng} zoom={initialZoom} ignoreRecenter={ignoreRecenter} />
        <MapInvalidator />
        {showMarker && <Marker position={[centerLat, centerLng]} />}
        <MapEventsHandler onSelect={(lat, lng) => handleSelect(lat, lng)} onZoom={(zoom) => onZoomChange?.(zoom)} />
      </MapContainer>
      <div className="map-instruction bg-blue-50 text-blue-800 text-xs p-2 text-center border-t border-blue-100 absolute bottom-0 w-full z-[400]">Clique no mapa para definir a localização exata.</div>
    </div>
  );
};