import React from 'react';
import { Rnd } from 'react-rnd';
import { FormElement } from '../../types/formBuilder';
import { EditableText } from './elements/EditableText';

interface CanvasProps {
  elements: FormElement[];
  onUpdateElement: (id: string, updates: Partial<FormElement>) => void;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  isPreviewMode?: boolean;
  previewData?: Record<string, string>;
}

export const Canvas: React.FC<CanvasProps> = ({
  elements,
  onUpdateElement,
  selectedElementId,
  onSelectElement,
  isPreviewMode = false,
  previewData = {},
}) => {
  return (
    <div
      id="printArea"
      className="relative bg-white shadow-2xl mx-auto origin-top print:shadow-none flex-shrink-0"
      style={{
        width: '794px',   // A4 @ 96dpi ≈ 210mm
        minHeight: '1123px', // A4 @ 96dpi ≈ 297mm
        backgroundImage: isPreviewMode
          ? 'none'
          : 'linear-gradient(rgba(203,213,225,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(203,213,225,0.4) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
      onClick={() => !isPreviewMode && onSelectElement(null)}
    >
      {elements.map((element) => {
        if (element.properties?.visible === false) return null;

        const isSelected = !isPreviewMode && selectedElementId === element.id;

        const rndStyle: React.CSSProperties = {
          backgroundColor: element.style?.backgroundColor || 'transparent',
          border: element.type !== 'line' && (element.style?.borderWidth ?? 0) > 0
            ? `${element.style?.borderWidth}px ${element.style?.borderStyle || 'solid'} ${element.style?.borderColor || '#000'}`
            : 'none',
          borderRadius: typeof element.style?.borderRadius === 'number' ? `${element.style.borderRadius}px` : element.style?.borderRadius,
          padding: element.style?.padding ? `${element.style.padding}px` : 0,
          display: 'flex',
          alignItems: 'flex-start',
          overflow: 'hidden',
        };

        if (isPreviewMode) {
          return (
            <div
              key={element.id}
              style={{
                position: 'absolute',
                left: element.position.x,
                top: element.position.y,
                width: element.size.width,
                height: element.size.height,
                ...rndStyle,
              }}
            >
              {renderElementContent(element, true, previewData, () => {})}
            </div>
          );
        }

        return (
          <Rnd
            key={element.id}
            size={{ width: element.size.width, height: element.size.height }}
            position={{ x: element.position.x, y: element.position.y }}
            // ไม่ snap grid — เลื่อนอิสระ pixel by pixel
            enableResizing={{
              top: true, right: true, bottom: true, left: true,
              topRight: true, bottomRight: true, bottomLeft: true, topLeft: true,
            }}
            dragHandleClassName="drag-handle"
            onDragStop={(_e: any, d: any) => {
              onUpdateElement(element.id, { position: { x: Math.max(0, d.x), y: Math.max(0, d.y) } });
            }}
            onResizeStop={(_e: any, _dir: any, ref: any, _delta: any, position: any) => {
              onUpdateElement(element.id, {
                size: {
                  width: parseInt(ref.style.width),
                  height: parseInt(ref.style.height),
                },
                position: { x: Math.max(0, position.x), y: Math.max(0, position.y) },
              });
            }}
            bounds="parent"
            onClick={(e: any) => {
              e.stopPropagation();
              onSelectElement(element.id);
            }}
            style={rndStyle}
            className={`group ${isSelected ? 'outline outline-2 outline-blue-500 z-20' : 'hover:outline hover:outline-1 hover:outline-blue-300'}`}
          >
            {/* Drag handle overlay (top bar) */}
            <div
              className={`drag-handle absolute top-0 left-0 right-0 h-4 cursor-move z-10 ${isSelected ? 'bg-blue-500/20' : 'opacity-0 group-hover:opacity-100 bg-blue-200/20'}`}
            />

            {renderElementContent(element, false, previewData, (updates) => onUpdateElement(element.id, updates), isSelected)}

            {/* Resize handle indicator */}
            {isSelected && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-se-resize z-10" />
            )}
          </Rnd>
        );
      })}
    </div>
  );
};

// ── Render ตาม type ────────────────────────────────────────────────────────────
function renderElementContent(
  element: FormElement,
  isPreviewMode: boolean,
  previewData: Record<string, string>,
  onUpdate: (updates: Partial<FormElement>) => void,
  isSelected = false,
) {
  switch (element.type) {
    case 'label':
    case 'textbox':
    case 'text':
      return (
        <EditableText
          element={element}
          onUpdate={onUpdate}
          isSelected={isSelected}
          isPreviewMode={isPreviewMode}
          previewData={previewData}
        />
      );

    case 'line':
      return (
        <div
          className="w-full"
          style={{
            borderTop: `${element.style?.borderWidth || 1}px ${element.style?.borderStyle || 'solid'} ${element.style?.borderColor || '#000000'}`,
            marginTop: '50%',
          }}
        />
      );

    case 'rectangle':
      return <div className="w-full h-full" />;

    case 'image':
      return (
        <img
          src={element.properties?.imageUrl || 'https://placehold.co/400x400/eeeeee/aaaaaa?text=Image'}
          alt="Element"
          className="w-full h-full pointer-events-none"
          style={{ objectFit: element.style?.objectFit || 'contain' }}
        />
      );

    default:
      return null;
  }
}
