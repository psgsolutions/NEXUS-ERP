import React from 'react';
import { Type, Square, Minus, PaintBucket, Type as FontIcon, Baseline, Plus } from 'lucide-react';
import { FormElement } from '../../types/formBuilder';
import { availableVariables } from '../../utils/dataBinding';

interface ToolbarProps {
  onAddElement: (type: FormElement['type']) => void;
  selectedElementId: string | null;
  onUpdateSelected: (updates: Partial<FormElement>) => void;
  selectedElement?: FormElement;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onAddElement,
  selectedElementId,
  onUpdateSelected,
  selectedElement
}) => {
  return (
    <div className="w-80 bg-gray-900 border-r border-gray-800 p-6 flex flex-col h-full overflow-y-auto">
      <h2 className="text-xl font-bold text-cyan-400 mb-6 font-mono tracking-widest uppercase">Builder Tools</h2>
      
      {/* Add Elements Section */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Add Elements</h3>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => onAddElement('text')}
            className="flex items-center gap-2 h-9 px-4 rounded-full bg-gray-800 hover:bg-gray-700 hover:text-cyan-400 text-gray-300 transition-colors text-sm"
          >
            <Type className="w-4 h-4" /> Text
          </button>
          <button 
            onClick={() => onAddElement('rectangle')}
            className="flex items-center gap-2 h-9 px-4 rounded-full bg-gray-800 hover:bg-gray-700 hover:text-cyan-400 text-gray-300 transition-colors text-sm"
          >
            <Square className="w-4 h-4" /> Box
          </button>
          <button 
            onClick={() => onAddElement('line')}
            className="flex items-center gap-2 h-9 px-4 rounded-full bg-gray-800 hover:bg-gray-700 hover:text-cyan-400 text-gray-300 transition-colors text-sm"
          >
            <Minus className="w-4 h-4" /> Line
          </button>
          <button 
            onClick={() => onAddElement('table')}
            className="flex items-center gap-2 h-9 px-4 rounded-full bg-gray-800 hover:bg-gray-700 hover:text-cyan-400 text-gray-300 transition-colors text-sm"
          >
            <Baseline className="w-4 h-4" /> Table
          </button>
        </div>
      </div>

      {/* Variables Section */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Data Variables</h3>
        <div className="flex flex-col gap-2">
          {availableVariables.map(v => (
            <div key={v.key} className="flex items-center justify-between text-xs p-2 bg-gray-800/50 rounded-lg border border-gray-800">
              <span className="text-gray-300">{v.label}</span>
              <span className="font-mono text-cyan-500 bg-cyan-950/50 px-2 py-1 rounded">
                {`{${v.key}}`}
              </span>
            </div>
          ))}
          <p className="text-xs text-gray-500 mt-1 italic">Type these variables into Text blocks</p>
        </div>
      </div>

      {/* Properties Section (only if selected) */}
      {selectedElementId && selectedElement && (
        <div className="mt-auto border-t border-gray-800 pt-6">
          <h3 className="text-sm font-semibold text-cyan-400 mb-4 uppercase tracking-wider flex items-center gap-2">
            <PaintBucket className="w-4 h-4" /> Properties
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Text Color</label>
              <input 
                type="color" 
                value={selectedElement.style?.color || '#000000'} 
                onChange={(e) => onUpdateSelected({ style: { ...selectedElement.style, color: e.target.value } })}
                className="w-full h-9 rounded cursor-pointer bg-transparent border border-gray-700"
              />
            </div>
            
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Background Color</label>
              <input 
                type="color" 
                value={selectedElement.style?.backgroundColor || '#ffffff'} 
                onChange={(e) => onUpdateSelected({ style: { ...selectedElement.style, backgroundColor: e.target.value } })}
                className="w-full h-9 rounded cursor-pointer bg-transparent border border-gray-700"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Border Color</label>
              <input 
                type="color" 
                value={selectedElement.style?.borderColor || '#000000'} 
                onChange={(e) => onUpdateSelected({ style: { ...selectedElement.style, borderColor: e.target.value } })}
                className="w-full h-9 rounded cursor-pointer bg-transparent border border-gray-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Font Size</label>
                <input 
                  type="number" 
                  value={selectedElement.style?.fontSize || 16} 
                  onChange={(e) => onUpdateSelected({ style: { ...selectedElement.style, fontSize: Number(e.target.value) } })}
                  className="w-full h-9 bg-gray-800 border border-gray-700 rounded px-2 text-white text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Border Width</label>
                <input 
                  type="number" 
                  value={selectedElement.style?.borderWidth || 0} 
                  onChange={(e) => onUpdateSelected({ style: { ...selectedElement.style, borderWidth: Number(e.target.value) } })}
                  className="w-full h-9 bg-gray-800 border border-gray-700 rounded px-2 text-white text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
            
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Font Family</label>
              <select 
                value={selectedElement.style?.fontFamily || 'sans-serif'}
                onChange={(e) => onUpdateSelected({ style: { ...selectedElement.style, fontFamily: e.target.value } })}
                className="w-full h-9 bg-gray-800 border border-gray-700 rounded px-2 text-white text-sm focus:border-cyan-500 focus:outline-none"
              >
                <option value="sans-serif">Sans-Serif</option>
                <option value="serif">Serif</option>
                <option value="monospace">Monospace (Code)</option>
              </select>
            </div>
            
            <button
               onClick={() => onUpdateSelected({ id: 'delete' })} // handled in layout
               className="w-full h-9 mt-4 rounded-full border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium"
            >
              Delete Element
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
