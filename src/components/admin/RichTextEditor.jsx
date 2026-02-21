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
  Image as ImageIcon,
  Search,
  RefreshCw,
  X,
  Eraser,
  Undo2,
  Redo2,
  Loader2,
  Upload,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import {
  cleanPastedHtml,
  normalizeRichTextHtml,
  countWordsFromHtml,
  estimateReadTimeFromHtml,
} from '../../utils/richText';
import { useData } from '../../context/DataContext';

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

function escapeHtmlAttribute(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Напиши съдържанието на статията...',
  className = '',
}) {
  const { media, refreshMedia, uploadMedia } = useData();
  const editorRef = useRef(null);
  const savedRangeRef = useRef(null);
  const [selectionTick, setSelectionTick] = useState(0);
  const [blockTag, setBlockTag] = useState('P');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mediaQuery, setMediaQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);

  const filteredMedia = useMemo(() => {
    const q = mediaQuery.trim().toLowerCase();
    if (!q) return media;
    return media.filter((item) => (item.name || '').toLowerCase().includes(q));
  }, [media, mediaQuery]);

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
    if (selectedImage && !document.body.contains(selectedImage)) {
      setSelectedImage(null);
    }
  }, [selectedImage]);

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
    const handleEditorClick = (e) => {
      if (e.target.tagName === 'IMG') {
        setSelectedImage(e.target);
      } else {
        setSelectedImage(null);
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    const editor = editorRef.current;
    if (editor) {
      editor.addEventListener('click', handleEditorClick);
      editor.addEventListener('input', () => setSelectedImage(null));
    }
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (editor) {
        editor.removeEventListener('click', handleEditorClick);
        editor.removeEventListener('input', () => setSelectedImage(null));
      }
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

  const captureSelectionRange = useCallback(() => {
    if (typeof window === 'undefined') return;
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    savedRangeRef.current = range.cloneRange();
  }, []);

  const restoreSelectionRange = useCallback(() => {
    if (typeof window === 'undefined') return;
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection) return;

    selection.removeAllRanges();
    if (savedRangeRef.current) {
      selection.addRange(savedRangeRef.current);
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.addRange(range);
  }, []);

  const handleOpenImagePicker = useCallback(() => {
    captureSelectionRange();
    setPickerOpen(true);
  }, [captureSelectionRange]);

  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const uploaded = await uploadMedia(file);
      // DataContext.uploadMedia doesn't necessarily return the full object in all paths, let's refresh instead if needed,
      // but it currently returns the uploaded object summary from api.media.upload.
      // If uploadMedia throws no error, let's just refresh the list and maybe pick the file later, 
      // or if it returns { url, name } we can insert right away.
      if (uploaded && uploaded.url) {
        handleInsertImage(uploaded.url, uploaded.name || file.name);
      } else {
        await refreshMedia();
      }
    } catch (err) {
      console.error('Failed to upload via RichTextEditor:', err);
      alert('Грешка при качване на файла');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleInsertImage = useCallback((mediaUrl, mediaName = '') => {
    if (!mediaUrl || !editorRef.current) return;
    editorRef.current.focus();
    restoreSelectionRange();

    const src = escapeHtmlAttribute(mediaUrl);
    const alt = escapeHtmlAttribute(String(mediaName || '').trim().slice(0, 180));
    const imageHtml = `<img src="${src}" alt="${alt}" loading="lazy" decoding="async" style="width: 100%; height: auto; display: block; margin-left: auto; margin-right: auto;"><p><br></p>`;
    document.execCommand('insertHTML', false, imageHtml);

    emitChange();
    refreshSelectionState();
    setPickerOpen(false);
    setMediaQuery('');
  }, [emitChange, refreshSelectionState, restoreSelectionRange]);

  const handleImageResize = (width) => {
    if (!selectedImage) return;
    selectedImage.style.width = width;
    selectedImage.style.height = 'auto';
    emitChange();
    setSelectionTick((prev) => prev + 1);
  };

  const handleImageAlign = (align) => {
    if (!selectedImage) return;
    if (align === 'left') {
      selectedImage.style.float = 'left';
      selectedImage.style.margin = '0 1rem 1rem 0';
      selectedImage.style.display = '';
    } else if (align === 'right') {
      selectedImage.style.float = 'right';
      selectedImage.style.margin = '0 0 1rem 1rem';
      selectedImage.style.display = '';
    } else {
      selectedImage.style.float = 'none';
      selectedImage.style.display = 'block';
      selectedImage.style.marginLeft = 'auto';
      selectedImage.style.marginRight = 'auto';
      selectedImage.style.margin = '0 auto 1rem auto';
    }
    emitChange();
    setSelectionTick((prev) => prev + 1);
  };

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
          <ToolbarButton onClick={handleOpenImagePicker} title="Вмъкни снимка от Media Library">
            <ImageIcon className="w-4 h-4" />
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

      <div className="relative">
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

        {selectedImage && (
          <div
            className="absolute z-10 bg-white border border-gray-200 shadow-xl rounded-md p-1.5 flex items-center gap-1"
            style={{
              top: Math.max(0, selectedImage.offsetTop - 45) + 'px',
              left: Math.max(0, selectedImage.offsetLeft) + 'px',
            }}
          >
            <button type="button" onClick={() => handleImageResize('25%')} className="px-2 py-1 text-xs font-sans font-semibold text-gray-700 hover:bg-gray-100 rounded">25%</button>
            <button type="button" onClick={() => handleImageResize('50%')} className="px-2 py-1 text-xs font-sans font-semibold text-gray-700 hover:bg-gray-100 rounded">50%</button>
            <button type="button" onClick={() => handleImageResize('75%')} className="px-2 py-1 text-xs font-sans font-semibold text-gray-700 hover:bg-gray-100 rounded">75%</button>
            <button type="button" onClick={() => handleImageResize('100%')} className="px-2 py-1 text-xs font-sans font-semibold text-gray-700 hover:bg-gray-100 rounded">100%</button>
            <div className="w-px h-4 bg-gray-300 mx-1" />
            <button type="button" onClick={() => handleImageAlign('left')} className="p-1 text-gray-600 hover:text-zn-purple hover:bg-gray-100 rounded" title="Вляво">
              <AlignLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => handleImageAlign('center')} className="p-1 text-gray-600 hover:text-zn-purple hover:bg-gray-100 rounded" title="В центъра">
              <AlignCenter className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => handleImageAlign('right')} className="p-1 text-gray-600 hover:text-zn-purple hover:bg-gray-100 rounded" title="Вдясно">
              <AlignRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="admin-rich-editor-meta">
        <span>{wordCount} думи</span>
        <span>{readTime} мин четене</span>
        <span className="admin-rich-editor-shortcuts">Shortcut: Ctrl+B / Ctrl+I / Ctrl+U</span>
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4" onClick={() => setPickerOpen(false)}>
          <div className="bg-white max-w-5xl w-full max-h-[80vh] overflow-hidden border border-gray-200 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-200">
              <h3 className="font-display text-lg font-black text-gray-900 uppercase tracking-wider">Media Library</h3>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zn-purple text-white text-xs font-sans font-semibold hover:bg-zn-purple-dark transition-colors disabled:opacity-50"
                  title="Качи нова снимка от компютъра"
                >
                  {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {isUploading ? 'Качване...' : 'Качи снимка'}
                </button>
                <button
                  type="button"
                  onClick={refreshMedia}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 text-xs font-sans text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Обнови
                </button>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 border-b border-gray-200">
              <div className="relative max-w-md">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={mediaQuery}
                  onChange={(event) => setMediaQuery(event.target.value)}
                  placeholder="Търси по име на файл..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple"
                />
              </div>
            </div>

            <div className="p-4 overflow-y-auto max-h-[58vh]">
              {filteredMedia.length === 0 ? (
                <div className="text-center py-14 border border-dashed border-gray-300 bg-gray-50">
                  <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-sans text-gray-400">Няма снимки в библиотеката</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {filteredMedia.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleInsertImage(item.url, item.name)}
                      className="text-left border border-gray-200 hover:border-zn-purple/50 transition-colors overflow-hidden"
                    >
                      <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
                        <img
                          src={item.url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <div className="px-2.5 py-2">
                        <p className="text-[11px] font-sans font-semibold text-gray-700 truncate" title={item.name}>
                          {item.name}
                        </p>
                        <p className="text-[10px] font-sans text-gray-400 mt-0.5">
                          {(item.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
