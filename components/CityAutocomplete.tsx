import React, { useState, useEffect, useRef } from 'react';
import { City } from '../types';
import { Check, ChevronsUpDown, X } from 'lucide-react';

interface CityAutocompleteProps {
  cities: City[];
  selectedCity: string;
  onSelect: (cityName: string) => void;
  disabled?: boolean;
}

export const CityAutocomplete: React.FC<CityAutocompleteProps> = ({ cities, selectedCity, onSelect, disabled }) => {
  const [inputValue, setInputValue] = useState(selectedCity || '');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredCities, setFilteredCities] = useState<City[]>(cities);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sincroniza o input quando a seleção externa muda (ex: carregamento inicial)
  useEffect(() => {
    setInputValue(selectedCity || '');
  }, [selectedCity]);

  // Filtra a lista conforme digita
  useEffect(() => {
    if (!inputValue) {
      setFilteredCities(cities);
    } else {
      const lower = inputValue.toLowerCase();
      // Prioriza cidades que começam com o texto digitado, depois as que contém
      const filtered = cities.filter(c => c.name.toLowerCase().includes(lower)).sort((a, b) => {
         const aStarts = a.name.toLowerCase().startsWith(lower);
         const bStarts = b.name.toLowerCase().startsWith(lower);
         if (aStarts && !bStarts) return -1;
         if (!aStarts && bStarts) return 1;
         return 0;
      });
      setFilteredCities(filtered);
    }
  }, [inputValue, cities]);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Se o usuário digitou algo mas não selecionou, tenta reverter para o selecionado ou limpar se não houver match exato
        if (inputValue && selectedCity && inputValue !== selectedCity) {
             const exactMatch = cities.find(c => c.name.toLowerCase() === inputValue.toLowerCase());
             if (exactMatch) {
                 onSelect(exactMatch.name);
             } else {
                 setInputValue(selectedCity || '');
             }
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef, inputValue, selectedCity, onSelect, cities]);

  const handleSelect = (city: City) => {
    setInputValue(city.name);
    onSelect(city.name);
    setIsOpen(false);
  };

  const handleClear = () => {
      setInputValue('');
      onSelect('');
      setIsOpen(true);
      setFilteredCities(cities);
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative">
        <input
          type="text"
          disabled={disabled}
          className={`w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 py-2 pl-3 pr-10 border bg-white text-black ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''}`}
          placeholder="Digite para buscar o município..."
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => !disabled && setIsOpen(true)}
        />
        {!disabled && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
             {inputValue && (
                 <button 
                    type="button" 
                    onClick={handleClear}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                 >
                     <X size={14} />
                 </button>
             )}
             <ChevronsUpDown className="h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
        )}
      </div>

      {isOpen && !disabled && (
        <ul className="absolute z-[100] mt-1 max-h-80 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
          {filteredCities.length === 0 ? (
            <li className="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-500 italic">
              Nenhum município encontrado.
            </li>
          ) : (
            filteredCities.map((city) => (
              <li
                key={city.name}
                className={`relative cursor-pointer select-none py-2 pl-3 pr-9 hover:bg-orange-100 ${
                    selectedCity === city.name ? 'bg-orange-50 text-orange-900 font-medium' : 'text-gray-900'
                }`}
                onClick={() => handleSelect(city)}
              >
                <span className="block truncate">{city.name}</span>
                {selectedCity === city.name && (
                  <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-orange-600">
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};