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
  selectedCity?: City;
  onLocationSelect: (lat: number, lng: number, addressData?: any) => void;
}

// Component to handle map center updates when prop changes
// Now accepts a ref to check if it should ignore the update (prevent recenter on click)
const MapController = ({ lat, lng, ignoreRecenter }: { lat: number; lng: number, ignoreRecenter: React.MutableRefObject<boolean> }) => {
  const map = useMap();
  
  useEffect(() => {
    if (ignoreRecenter.current) {
        // If this update was triggered by a click, consume the flag and DO NOT move the map
        ignoreRecenter.current = false;
        return;
    }
    // Center the map view
    map.setView([lat, lng], 15); 
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

// Component to handle clicks - only notifies parent, doesn't manage marker state
const ClickHandler = ({ onSelect }: { onSelect: (lat: number, lng: number, fromGPS: boolean) => void }) => {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng, false);
    },
  });
  return null;
};

export const MapPicker: React.FC<MapPickerProps> = ({ centerLat, centerLng, onLocationSelect }) => {
  const [layer, setLayer] = useState<'osm' | 'sat' | 'hybrid'>('hybrid'); // Default to Hybrid
  const [isLocating, setIsLocating] = useState(false);
  const ignoreRecenter = useRef(false);

  const handleSelect = async (lat: number, lng: number, fromGPS = false) => {
    // Only ignore recenter if it's NOT from GPS (i.e. manual click)
    // If it is from GPS, we want the map to move.
    if (!fromGPS) {
        ignoreRecenter.current = true;
    } else {
        ignoreRecenter.current = false;
    }

    // Reverse Geocoding using OSM Nominatim
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      onLocationSelect(lat, lng, data.address);
    } catch (error) {
      console.error("Geocoding failed", error);
      onLocationSelect(lat, lng); 
    }
  };

  const handleLocateUser = () => {
      if (!navigator.geolocation) {
          alert("Geolocalização não suportada pelo seu navegador.");
          return;
      }

      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
          (position) => {
              const { latitude, longitude } = position.coords;
              handleSelect(latitude, longitude, true); // True = From GPS
              setIsLocating(false);
          },
          (error) => {
              console.error(error);
              alert("Erro ao obter localização. Verifique as permissões de GPS.");
              setIsLocating(false);
          },
          { enableHighAccuracy: true }
      );
  };

  return (
    <div id="map-print-container" className="relative w-full h-[400px] rounded-lg overflow-hidden border border-gray-300 z-0">
      
      {/* Top Right Controls Container - Added 'map-custom-controls' class for PDF capture exclusion */}
      <div className="map-custom-controls absolute top-2 right-2 z-[400] flex flex-col gap-2 items-end">
          {/* Layer Controls */}
          <div className="bg-white p-2 rounded shadow flex gap-2">
            <button 
                type="button"
                className={`px-3 py-1 text-xs font-bold rounded ${layer === 'hybrid' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                onClick={() => setLayer('hybrid')}
            >
                Híbrido
            </button>
            <button 
                type="button"
                className={`px-3 py-1 text-xs font-bold rounded ${layer === 'sat' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                onClick={() => setLayer('sat')}
            >
                Satélite
            </button>
            <button 
                type="button"
                className={`px-3 py-1 text-xs font-bold rounded ${layer === 'osm' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                onClick={() => setLayer('osm')}
            >
                Mapa
            </button>
          </div>

          {/* GPS Button */}
          <button
            type="button"
            onClick={handleLocateUser}
            disabled={isLocating}
            className="bg-orange-500 hover:bg-orange-600 text-white p-2 rounded shadow-lg flex items-center gap-2 text-xs font-bold uppercase transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Usar minha localização atual (GPS)"
          >
            {isLocating ? <Loader2 size={16} className="animate-spin" /> : <Locate size={16} />}
            Minha Localização
          </button>
      </div>

      <MapContainer center={[centerLat, centerLng]} zoom={15} style={{ height: '100%', width: '100%' }}>
        {layer === 'osm' && (
             <TileLayer
             attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
             url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
             crossOrigin="anonymous"
           />
        )}
        {layer === 'sat' && (
            <TileLayer
            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            crossOrigin="anonymous"
          />
        )}
        {layer === 'hybrid' && (
            <TileLayer
            attribution='&copy; Google Maps'
            url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
            crossOrigin="anonymous"
          />
        )}
       
        <MapController lat={centerLat} lng={centerLng} ignoreRecenter={ignoreRecenter} />
        <MapInvalidator />
        {/* The Marker is now controlled by props, so it always matches the form data (GPS or Manual) */}
        <Marker position={[centerLat, centerLng]} />
        <ClickHandler onSelect={handleSelect} />
      </MapContainer>
      <div className="map-instruction bg-blue-50 text-blue-800 text-xs p-2 text-center border-t border-blue-100 absolute bottom-0 w-full z-[400]">
        Clique no mapa para definir a localização exata e buscar o endereço automaticamente.
      </div>
    </div>
  );
};