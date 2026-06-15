import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { FormElement } from '../../../types/formBuilder';
import { availableVariables } from '../../../utils/dataBinding';

interface EditableTextProps {
  element: FormElement;
  onUpdate: (updates: Partial<FormElement>) => void;
  isSelected: boolean;
  isPreviewMode?: boolean;
  previewData?: Record<string, string>;
}

export const EditableText: React.FC<EditableTextProps> = ({
  element,
  onUpdate,
  isSelected,
  isPreviewMode = false,
  previewData = {},
}) => {
  const controlSource = element.properties?.controlSource;

  // ── resolve display value ──────────────────────────────────────────────────
  const getPreviewValue = (): string => {
    if (element.type === 'textbox' && controlSource) {
      const value = previewData[controlSource];
      if (value !== undefined) return value;
      return availableVariables.find(v => v.key === controlSource)?.neutralValue ?? `{${controlSource}}`;
    }
    // label/text — ใช้ HTML content ตรงๆ
    return element.content || '';
  };

  const isMono = controlSource === 'documentNo' || controlSource === 'grandTotal';

  // ── wrapper styles ─────────────────────────────────────────────────────────
  const wrapperStyle: React.CSSProperties = {
    fontFamily: isMono ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' : (element.style?.fontFamily || 'sans-serif'),
    fontSize: element.style?.fontSize ? `${element.style.fontSize}px` : '12px',
    color: element.style?.color || '#000000',
    textAlign: (element.style?.textAlign as any) || 'left',
    fontWeight: element.style?.fontWeight || 'normal',
    fontStyle: 'normal', // บังคับห้ามใช้ตัวเอน (0%) ตามกฎ PSG UI Protocol V3.1
    width: '100%',
    height: '100%',
    padding: '2px 4px',
    overflow: 'hidden',
    lineHeight: 1.4,
  };

  // ── Preview Mode: static render ────────────────────────────────────────────
  if (isPreviewMode) {
    if (element.type === 'textbox' && controlSource) {
      return <div style={wrapperStyle}>{getPreviewValue()}</div>;
    }
    return (
      <div
        style={wrapperStyle}
        dangerouslySetInnerHTML={{ __html: element.content || '' }}
      />
    );
  }

  // ── Design Mode: textbox with bound source ─────────────────────────────────
  if (element.type === 'textbox' && controlSource) {
    const variable = availableVariables.find(v => v.key === controlSource);
    const displayValue = previewData[controlSource] || variable?.neutralValue || `{${controlSource}}`;

    return (
      <div style={wrapperStyle} className="relative w-full h-full">
        <span style={{ color: '#1D4ED8' }}>{displayValue}</span>
        {isSelected && variable && (
          <span className="absolute -top-5 left-0 px-1.5 py-0.5 bg-blue-600 text-white text-[9px] font-black rounded whitespace-nowrap z-30 pointer-events-none">
            ← {variable.label}
          </span>
        )}
      </div>
    );
  }

  // ── Design Mode: label/text — TipTap editor ────────────────────────────────
  return <TipTapEditor element={element} onUpdate={onUpdate} style={wrapperStyle} />;
};

// ── Separate TipTap component to avoid hook rule violations ─────────────────
const TipTapEditor = ({
  element,
  onUpdate,
  style,
}: {
  element: FormElement;
  onUpdate: (updates: Partial<FormElement>) => void;
  style: React.CSSProperties;
}) => {
  const editor = useEditor({
    extensions: [StarterKit, TextStyle, Color, FontFamily],
    content: element.content || '',
    onBlur: ({ editor }) => {
      onUpdate({ content: editor.getHTML() });
    },
  });

  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const newContent = element.content || '';
    if (editor.getHTML() !== newContent) {
      editor.commands.setContent(newContent);
    }
  }, [element.content, editor]);

  return (
    <div style={style} className="cursor-text w-full h-full [&_.ProseMirror]:outline-none [&_.ProseMirror]:w-full [&_.ProseMirror]:h-full [&_.ProseMirror_p]:m-0">
      <EditorContent editor={editor} />
    </div>
  );
};
