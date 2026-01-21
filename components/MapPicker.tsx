import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { City } from '../types';

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
    // Only center if it wasn't a manual click interaction
    map.setView([lat, lng], 15); 
  }, [lat, lng, map, ignoreRecenter]);

  return null;
};

// Component to handle clicks
const LocationMarker = ({ onSelect }: { onSelect: (lat: number, lng: number) => void }) => {
  const [position, setPosition] = useState<L.LatLng | null>(null);
  
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });

  return position === null ? null : (
    <Marker position={position} />
  );
};

export const MapPicker: React.FC<MapPickerProps> = ({ centerLat, centerLng, onLocationSelect }) => {
  const [layer, setLayer] = useState<'osm' | 'sat' | 'hybrid'>('sat'); // Default to Sat for visual report
  const ignoreRecenter = useRef(false);

  const handleSelect = async (lat: number, lng: number) => {
    // Flag that the next update is due to user interaction, so don't recenter the map view
    ignoreRecenter.current = true;

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

  return (
    <div id="map-print-container" className="relative w-full h-[400px] rounded-lg overflow-hidden border border-gray-300">
      <div className="absolute top-2 right-2 z-[1000] bg-white p-2 rounded shadow flex gap-2">
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
        <LocationMarker onSelect={handleSelect} />
      </MapContainer>
      <div className="bg-blue-50 text-blue-800 text-xs p-2 text-center border-t border-blue-100">
        Clique no mapa para definir a localização exata e buscar o endereço automaticamente.
      </div>
    </div>
  );
};