import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Rnd } from 'react-rnd';
import { FormElement } from '../../types/formBuilder';
import { EditableText } from './elements/EditableText';

interface DraggableElementProps {
  element: FormElement;
  isSelected: boolean;
  isPreviewMode: boolean;
  previewData: Record<string, string>;
  onUpdateElement: (id: string, updates: Partial<FormElement>) => void;
  onSelectElement: (id: string, e: React.MouseEvent) => void;
  renderElementContent: (
    element: FormElement,
    isPreviewMode: boolean,
    previewData: Record<string, string>,
    onUpdate: (updates: Partial<FormElement>) => void,
    isSelected?: boolean
  ) => React.ReactNode;
}

export const DraggableElement: React.FC<DraggableElementProps> = ({
  element,
  isSelected,
  isPreviewMode,
  previewData,
  onUpdateElement,
  onSelectElement,
  renderElementContent,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: element.id,
    disabled: isPreviewMode,
    data: { element },
  });

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

  // If in preview mode, render statically
  if (isPreviewMode) {
    return (
      <div
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

  // Calculate position with active drag transform
  const style: React.CSSProperties = {
    position: 'absolute',
    left: element.position.x + (transform?.x || 0),
    top: element.position.y + (transform?.y || 0),
    zIndex: isSelected ? 20 : 1,
    // Add box shadow when dragging
    boxShadow: isDragging ? '0 10px 25px rgba(0,0,0,0.2)' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`absolute origin-top-left ${isSelected ? 'z-20' : 'z-10'}`}
      onClick={(e) => onSelectElement(element.id, e)}
    >
      <Rnd
        size={{ width: element.size.width, height: element.size.height }}
        position={{ x: 0, y: 0 }} // Position is handled by parent div
        disableDragging={true} // Dragging is handled by dnd-kit
        enableResizing={{
          top: true, right: true, bottom: true, left: true,
          topRight: true, bottomRight: true, bottomLeft: true, topLeft: true,
        }}
        onResizeStop={(_e: any, _dir: any, ref: any) => {
          onUpdateElement(element.id, {
            size: {
              width: parseInt(ref.style.width),
              height: parseInt(ref.style.height),
            },
          });
        }}
        bounds="parent"
        style={rndStyle}
        className={`group ${isSelected ? 'outline outline-2 outline-blue-500' : 'hover:outline hover:outline-1 hover:outline-blue-300'}`}
      >
        {/* Drag handle overlay (top bar) */}
        <div
          {...listeners}
          {...attributes}
          className={`drag-handle absolute top-0 left-0 right-0 h-4 cursor-move z-10 ${isSelected ? 'bg-blue-500/20' : 'opacity-0 group-hover:opacity-100 bg-blue-200/20'}`}
        />

        {renderElementContent(element, false, previewData, (updates) => onUpdateElement(element.id, updates), isSelected)}

        {/* Resize handle indicator */}
        {isSelected && (
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-se-resize z-10" />
        )}
      </Rnd>
    </div>
  );
};
