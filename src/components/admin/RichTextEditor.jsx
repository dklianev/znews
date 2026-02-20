import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Unlink,
  Eraser,
  Undo2,
  Redo2,
} from 'lucide-react';
import {
  cleanPastedHtml,
  normalizeRichTextHtml,
  countWordsFromHtml,
  estimateReadTimeFromHtml,
} from '../../utils/richText';

function ToolbarButton({ onClick, title, children, active = false, disabled = false }) {
  return (
    <button
      type="button"
      onMouseDown={(event) => {
        event.preventDefault();
        if (!disabled) onClick();
      }}
      title={title}
      disabled={disabled}
      className={`admin-rich-editor-btn ${active ? 'admin-rich-editor-btn-active' : ''}`}
    >
      {children}
    </button>
  );
}

function getCurrentBlockTag() {
  if (typeof document === 'undefined') return 'P';
  try {
    const raw = document.queryCommandValue('formatBlock');
    const normalized = String(raw || '')
      .replace(/[<>]/g, '')
      .trim()
      .toUpperCase();
    if (['P', 'H2', 'H3', 'H4', 'BLOCKQUOTE'].includes(normalized)) return normalized;
  } catch { }
  return 'P';
}

function queryState(command) {
  if (typeof document === 'undefined') return false;
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Напиши съдържанието на статията...',
  className = '',
}) {
  const editorRef = useRef(null);
  const [selectionTick, setSelectionTick] = useState(0);
  const [blockTag, setBlockTag] = useState('P');

  useEffect(() => {
    if (!editorRef.current) return;
    const next = value || '<p></p>';
    if (editorRef.current.innerHTML !== next) {
      editorRef.current.innerHTML = next;
    }
  }, [value]);

  const refreshSelectionState = useCallback(() => {
    setSelectionTick((prev) => prev + 1);
    setBlockTag(getCurrentBlockTag());
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const handleSelectionChange = () => {
      const editor = editorRef.current;
      const selection = window.getSelection();
      if (!editor || !selection?.anchorNode) return;
      if (editor.contains(selection.anchorNode)) {
        refreshSelectionState();
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [refreshSelectionState]);

  const emitChange = useCallback(() => {
    if (!editorRef.current) return;
    onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const execCommand = useCallback((command, valueArg = null) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('styleWithCSS', false, false);
    document.execCommand(command, false, valueArg);
    emitChange();
    refreshSelectionState();
  }, [emitChange, refreshSelectionState]);

  const handleSetBlock = useCallback((tagName) => {
    execCommand('formatBlock', tagName);
  }, [execCommand]);

  const handleLink = useCallback(() => {
    if (!editorRef.current) return;
    const selection = window.getSelection();
    const rawAnchor = selection?.anchorNode;
    const anchorEl = rawAnchor?.nodeType === Node.ELEMENT_NODE
      ? rawAnchor
      : rawAnchor?.parentElement;
    const existingHref = anchorEl?.closest?.('a')?.getAttribute('href') || 'https://';
    const href = window.prompt('Въведи линк (https://...):', existingHref);
    if (!href) return;
    execCommand('createLink', href.trim());
  }, [execCommand]);

  const handlePaste = (event) => {
    const html = event.clipboardData?.getData('text/html');
    const text = event.clipboardData?.getData('text/plain');
    if (html) {
      event.preventDefault();
      const cleaned = normalizeRichTextHtml(cleanPastedHtml(html));
      document.execCommand('insertHTML', false, cleaned);
      emitChange();
      refreshSelectionState();
      return;
    }
    if (text) {
      event.preventDefault();
      document.execCommand('insertText', false, text);
      emitChange();
      refreshSelectionState();
    }
  };

  const handleBlur = () => {
    if (!editorRef.current) return;
    const normalized = normalizeRichTextHtml(editorRef.current.innerHTML);
    if (editorRef.current.innerHTML !== normalized) {
      editorRef.current.innerHTML = normalized;
    }
    onChange(normalized);
    refreshSelectionState();
  };

  const wordCount = useMemo(() => countWordsFromHtml(value || ''), [value]);
  const readTime = useMemo(() => estimateReadTimeFromHtml(value || ''), [value]);
  const isBold = queryState('bold');
  const isItalic = queryState('italic');
  const isUnderline = queryState('underline');
  const isStrike = queryState('strikeThrough');
  const isUl = queryState('insertUnorderedList');
  const isOl = queryState('insertOrderedList');

  return (
    <div className={`admin-rich-editor ${className}`} data-selection-tick={selectionTick}>
      <div className="admin-rich-editor-toolbar">
        <div className="admin-rich-editor-group">
          <label className="admin-rich-editor-label" htmlFor="rt-block-style">Стил</label>
          <select
            id="rt-block-style"
            value={blockTag}
            onChange={(event) => handleSetBlock(event.target.value)}
            className="admin-rich-editor-select"
          >
            <option value="P">Параграф</option>
            <option value="H2">Заглавие H2</option>
            <option value="H3">Заглавие H3</option>
            <option value="H4">Заглавие H4</option>
            <option value="BLOCKQUOTE">Цитат</option>
          </select>
        </div>

        <span className="admin-rich-editor-divider" />

        <div className="admin-rich-editor-group">
          <ToolbarButton onClick={() => execCommand('bold')} title="Bold (Ctrl+B)" active={isBold}>
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('italic')} title="Italic (Ctrl+I)" active={isItalic}>
            <Italic className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('underline')} title="Underline (Ctrl+U)" active={isUnderline}>
            <Underline className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('strikeThrough')} title="Strikethrough" active={isStrike}>
            <Strikethrough className="w-4 h-4" />
          </ToolbarButton>
        </div>

        <span className="admin-rich-editor-divider" />

        <div className="admin-rich-editor-group">
          <ToolbarButton onClick={() => handleSetBlock('P')} title="Нормален текст" active={blockTag === 'P'}>
            <Pilcrow className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => handleSetBlock('H2')} title="Подзаглавие H2" active={blockTag === 'H2'}>
            <Heading2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => handleSetBlock('H3')} title="Подзаглавие H3" active={blockTag === 'H3'}>
            <Heading3 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => handleSetBlock('BLOCKQUOTE')} title="Цитат" active={blockTag === 'BLOCKQUOTE'}>
            <Quote className="w-4 h-4" />
          </ToolbarButton>
        </div>

        <span className="admin-rich-editor-divider" />

        <div className="admin-rich-editor-group">
          <ToolbarButton onClick={() => execCommand('insertUnorderedList')} title="Списък" active={isUl}>
            <List className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('insertOrderedList')} title="Номериран списък" active={isOl}>
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={handleLink} title="Добави/редактирай линк">
            <LinkIcon className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('unlink')} title="Премахни линк">
            <Unlink className="w-4 h-4" />
          </ToolbarButton>
        </div>

        <span className="admin-rich-editor-divider" />

        <div className="admin-rich-editor-group">
          <ToolbarButton onClick={() => execCommand('undo')} title="Undo (Ctrl+Z)">
            <Undo2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('redo')} title="Redo (Ctrl+Y)">
            <Redo2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('removeFormat')} title="Изчисти форматиране">
            <Eraser className="w-4 h-4" />
          </ToolbarButton>
        </div>
      </div>

      <div
        ref={editorRef}
        className="admin-rich-editor-content"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emitChange}
        onBlur={handleBlur}
        onPaste={handlePaste}
        onKeyUp={refreshSelectionState}
        onMouseUp={refreshSelectionState}
      />

      <div className="admin-rich-editor-meta">
        <span>{wordCount} думи</span>
        <span>{readTime} мин четене</span>
        <span className="admin-rich-editor-shortcuts">Shortcut: Ctrl+B / Ctrl+I / Ctrl+U</span>
      </div>
    </div>
  );
}
