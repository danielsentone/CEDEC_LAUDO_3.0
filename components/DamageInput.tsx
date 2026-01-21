import React, { useState } from 'react';
import { DamageType, DamageEntry } from '../types';
import { Camera, Trash2, Plus } from 'lucide-react';

interface DamageInputProps {
  value: DamageEntry[];
  onChange: (value: DamageEntry[]) => void;
}

export const DamageInput: React.FC<DamageInputProps> = ({ value, onChange }) => {
  const availableTypes = Object.values(DamageType);

  const handleAddDamage = (type: DamageType) => {
    if (value.some(v => v.type === type)) return;
    onChange([...value, { type, description: '', photos: [] }]);
  };

  const handleRemoveDamage = (type: DamageType) => {
    onChange(value.filter(v => v.type !== type));
  };

  const handleUpdateDescription = (type: DamageType, desc: string) => {
    onChange(value.map(v => v.type === type ? { ...v, description: desc } : v));
  };

  const handlePhotoUpload = (type: DamageType, files: FileList | null) => {
    if (!files) return;
    
    // Convert to base64
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        onChange(value.map(v => {
            if (v.type === type) {
                return { ...v, photos: [...v.photos, base64String] };
            }
            return v;
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (type: DamageType, photoIndex: number) => {
    onChange(value.map(v => {
        if (v.type === type) {
            const newPhotos = [...v.photos];
            newPhotos.splice(photoIndex, 1);
            return { ...v, photos: newPhotos };
        }
        return v;
    }));
  };

  // Shared input style
  const inputClass = "w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm p-3 border bg-white text-black";

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
        <label className="block text-sm font-bold text-blue-900 mb-3 uppercase">Selecione os Danos Observados:</label>
        <div className="flex flex-wrap gap-2">
          {availableTypes.map(type => {
            const isSelected = value.some(v => v.type === type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => isSelected ? handleRemoveDamage(type) : handleAddDamage(type)}
                className={`px-3 py-2 rounded-md text-xs font-bold transition-all shadow-sm ${
                  isSelected 
                    ? 'bg-orange-500 text-white border border-orange-600 ring-2 ring-orange-200' 
                    : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-100 hover:border-orange-300 hover:text-orange-600'
                }`}
              >
                {isSelected ? '✓ ' : '+ '} {type}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        {value.map((item) => (
          <div key={item.type} className="border border-gray-300 rounded-lg p-4 bg-gray-50 shadow-sm animate-in fade-in slide-in-from-bottom-2">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-bold text-lg text-blue-900 border-l-4 border-orange-500 pl-3 uppercase">{item.type}</h4>
              <button 
                type="button"
                onClick={() => handleRemoveDamage(item.type)}
                className="text-gray-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition-colors"
                title="Remover este dano"
              >
                <Trash2 size={20} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                Descrição do Dano
              </label>
              <textarea
                rows={3}
                className={inputClass}
                placeholder={`Descreva os detalhes dos danos em: ${item.type}...`}
                value={item.description}
                onChange={(e) => handleUpdateDescription(item.type, e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                <Camera size={16} className="text-orange-600" /> Fotos (Evidências)
              </label>
              
              <div className="flex flex-wrap gap-3">
                {item.photos.map((photo, idx) => (
                    <div key={idx} className="relative w-28 h-28 group rounded-lg overflow-hidden border border-gray-300 shadow-sm">
                        <img src={photo} alt="Evidence" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                                type="button"
                                onClick={() => removePhoto(item.type, idx)}
                                className="bg-red-600 text-white rounded-full p-2 hover:bg-red-700"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
                
                <label className="w-28 h-28 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-white hover:border-orange-400 hover:text-orange-600 transition-all text-gray-400 bg-gray-50">
                    <Plus size={24} />
                    <span className="text-[10px] mt-1 font-bold uppercase">Adicionar</span>
                    <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handlePhotoUpload(item.type, e.target.files)}
                    />
                </label>
              </div>
            </div>
          </div>
        ))}
        {value.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-200 text-gray-400">
                <AlertTriangle className="mx-auto mb-2 text-gray-300" size={32} />
                <p className="font-medium">Nenhum dano selecionado.</p> 
                <p className="text-sm mt-1">Clique nos botões acima para iniciar o levantamento.</p>
            </div>
        )}
      </div>
    </div>
  );
};
import { AlertTriangle } from 'lucide-react';
