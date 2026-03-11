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
  Video,
} from 'lucide-react';
import {
  cleanPastedHtml,
  normalizeRichTextHtml,
  countWordsFromHtml,
  estimateReadTimeFromHtml,
} from '../../utils/richText';
import UploadWatermarkToggle from './UploadWatermarkToggle';
import { useAdminData } from '../../context/DataContext';
import useUploadWatermarkPreference from '../../hooks/useUploadWatermarkPreference';

const IMAGE_WIDTH_VALUES = new Set(['25', '50', '75', '100']);
const IMAGE_ALIGN_VALUES = new Set(['left', 'center', 'right']);

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
  const { media, refreshMedia, uploadMedia } = useAdminData();
  const editorRef = useRef(null);
  const savedRangeRef = useRef(null);
  const [selectionTick, setSelectionTick] = useState(0);
  const [blockTag, setBlockTag] = useState('P');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const [mediaQuery, setMediaQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [applyWatermark, setApplyWatermark] = useUploadWatermarkPreference();
  const selectedImageRef = useRef(null);

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

  useEffect(() => {
    selectedImageRef.current = selectedImage;
  }, [selectedImage]);

  const refreshSelectionState = useCallback(() => {
    setSelectionTick((prev) => prev + 1);
    setBlockTag(getCurrentBlockTag());
    if (typeof document === 'undefined') return;
    const activeImage = selectedImageRef.current;
    if (activeImage && !document.body.contains(activeImage)) {
      selectedImageRef.current = null;
      setSelectedImage(null);
    }
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
    const handleEditorClick = (e) => {
      if (e.target.tagName === 'IMG') {
        setSelectedImage(e.target);
      } else {
        setSelectedImage(null);
      }
    };
    const handleEditorInput = () => setSelectedImage(null);
    document.addEventListener('selectionchange', handleSelectionChange);
    const editor = editorRef.current;
    if (editor) {
      editor.addEventListener('click', handleEditorClick);
      editor.addEventListener('input', handleEditorInput);
    }
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (editor) {
        editor.removeEventListener('click', handleEditorClick);
        editor.removeEventListener('input', handleEditorInput);
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

  const transformSelectedText = useCallback((transformer) => {
    const editor = editorRef.current;
    if (!editor || typeof window === 'undefined' || typeof document === 'undefined') return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    const intersectsNode = (node) => {
      if (!node || !node.nodeValue) return false;
      try {
        if (typeof range.intersectsNode === 'function') {
          return range.intersectsNode(node);
        }
      } catch {
        // Fallback below.
      }
      const nodeRange = document.createRange();
      nodeRange.selectNodeContents(node);
      return range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0
        && range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0;
    };

    const seen = new Set();
    const textNodes = [];
    const pushTextNode = (node) => {
      if (!node || node.nodeType !== Node.TEXT_NODE) return;
      if (!node.nodeValue || !node.nodeValue.trim()) return;
      if (!intersectsNode(node) || seen.has(node)) return;
      seen.add(node);
      textNodes.push(node);
    };

    pushTextNode(range.commonAncestorContainer);
    const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT
    );
    let currentNode = walker.nextNode();
    while (currentNode) {
      pushTextNode(currentNode);
      currentNode = walker.nextNode();
    }

    if (textNodes.length === 0) return;

    textNodes.forEach((node) => {
      const text = node.nodeValue || '';
      let start = 0;
      let end = text.length;

      if (node === range.startContainer) start = range.startOffset;
      if (node === range.endContainer) end = range.endOffset;
      if (node === range.startContainer && node === range.endContainer) {
        start = range.startOffset;
        end = range.endOffset;
      }
      if (end <= start) return;

      const before = text.slice(0, start);
      const selected = text.slice(start, end);
      const after = text.slice(end);
      node.nodeValue = before + transformer(selected) + after;
    });

    emitChange();
    refreshSelectionState();
  }, [emitChange, refreshSelectionState]);

  const handleLowerCase = useCallback(() => {
    transformSelectedText((text) => text.toLocaleLowerCase('bg-BG'));
  }, [transformSelectedText]);

  const handleUpperCase = useCallback(() => {
    transformSelectedText((text) => text.toLocaleUpperCase('bg-BG'));
  }, [transformSelectedText]);

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

  const handleOpenEmbedPrompt = useCallback(() => {
    captureSelectionRange();
    setEmbedOpen(true);
    setEmbedUrl('');
  }, [captureSelectionRange]);

  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleInsertImage = useCallback((mediaUrl, mediaName = '') => {
    if (!mediaUrl || !editorRef.current) return;
    editorRef.current.focus();
    restoreSelectionRange();

    const src = escapeHtmlAttribute(mediaUrl);
    const alt = escapeHtmlAttribute(String(mediaName || '').trim().slice(0, 180));
    const imageHtml = `<img src="${src}" alt="${alt}" loading="lazy" decoding="async" data-width="100" data-align="center"><p><br></p>`;
    document.execCommand('insertHTML', false, imageHtml);

    emitChange();
    refreshSelectionState();
    setPickerOpen(false);
    setMediaQuery('');
  }, [emitChange, refreshSelectionState, restoreSelectionRange]);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const uploaded = await uploadMedia(file, { applyWatermark });
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

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    // Try to focus where the user dropped
    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (range) {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        captureSelectionRange();
      }
    } else if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos) {
        const range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        captureSelectionRange();
      }
    }

    setIsUploading(true);
    try {
      const uploaded = await uploadMedia(file, { applyWatermark });
      if (uploaded && uploaded.url) {
        handleInsertImage(uploaded.url, uploaded.name || file.name);
      } else {
        await refreshMedia();
      }
    } catch (err) {
      console.error('Failed to upload dropped file:', err);
      alert('Грешка при качване на файла');
    } finally {
      setIsUploading(false);
    }
  }, [applyWatermark, uploadMedia, refreshMedia, handleInsertImage, captureSelectionRange]);

  const handleInsertEmbed = useCallback((event) => {
    event.preventDefault();
    if (!embedUrl || !editorRef.current) return;

    let processedUrl = embedUrl.trim();
    try {
      const parsed = new URL(processedUrl);
      if (parsed.hostname.includes('youtube.com') && parsed.searchParams.has('v')) {
        processedUrl = `https://www.youtube.com/embed/${parsed.searchParams.get('v')}`;
      } else if (parsed.hostname.includes('youtu.be')) {
        processedUrl = `https://www.youtube.com/embed${parsed.pathname}`;
      } else if (parsed.hostname.includes('vimeo.com')) {
        const match = parsed.pathname.match(/^\/(\d+)/);
        if (match) processedUrl = `https://player.vimeo.com/video/${match[1]}`;
      }
    } catch {
      // Ignored
    }

    editorRef.current.focus();
    restoreSelectionRange();

    const src = escapeHtmlAttribute(processedUrl);
    const iframeHtml = `<iframe src="${src}" width="100%" height="400" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" class="rounded-md shadow-md border-2 border-[#1C1428] my-6"></iframe><p><br></p>`;
    document.execCommand('insertHTML', false, iframeHtml);

    emitChange();
    refreshSelectionState();
    setEmbedOpen(false);
    setEmbedUrl('');
  }, [embedUrl, emitChange, refreshSelectionState, restoreSelectionRange]);

  const handleImageResize = (width) => {
    if (!selectedImage) return;
    const normalizedWidth = String(width || '').replace('%', '').trim();
    if (!IMAGE_WIDTH_VALUES.has(normalizedWidth)) return;
    selectedImage.setAttribute('data-width', normalizedWidth);
    emitChange();
    setSelectionTick((prev) => prev + 1);
  };

  const handleImageAlign = (align) => {
    if (!selectedImage) return;
    const normalizedAlign = String(align || '').trim().toLowerCase();
    if (!IMAGE_ALIGN_VALUES.has(normalizedAlign)) return;
    selectedImage.setAttribute('data-align', normalizedAlign);
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
          <ToolbarButton onClick={handleUpperCase} title="UPPERCASE за избрания текст">
            <span className="text-[11px] font-sans font-bold leading-none">AA</span>
          </ToolbarButton>
          <ToolbarButton onClick={handleLowerCase} title="lowercase за избрания текст">
            <span className="text-[11px] font-sans font-bold leading-none">aa</span>
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
          <UploadWatermarkToggle checked={applyWatermark} onChange={setApplyWatermark} />
        </div>

        <span className="admin-rich-editor-divider" />

        <div className="admin-rich-editor-group">
          <ToolbarButton onClick={handleOpenImagePicker} title="Вмъкни изображение от медийната библиотека">
            <ImageIcon className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={handleOpenEmbedPrompt} title="Вмъкни видео (YouTube, Vimeo)">
            <Video className="w-4 h-4" />
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

      <div className="relative flex-1 min-h-0">
        <div
          ref={editorRef}
          className={`admin-rich-editor-content h-full ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={emitChange}
          onBlur={handleBlur}
          onPaste={handlePaste}
          onKeyUp={refreshSelectionState}
          onMouseUp={refreshSelectionState}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />

        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-20">
            <div className="flex items-center gap-2 px-4 py-2 bg-white shadow-lg rounded-full border border-gray-200 text-sm font-sans font-semibold text-zn-purple">
              <Loader2 className="w-4 h-4 animate-spin" /> Качване на изображение...
            </div>
          </div>
        )}

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

      <div className="admin-rich-editor-meta flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className={wordCount < 100 ? 'text-red-500 font-bold font-sans' : wordCount < 300 ? 'text-orange-500 font-sans font-semibold' : 'text-green-600 font-sans font-semibold'}>
            {wordCount} думи {wordCount < 100 ? '(Твърде кратко)' : wordCount < 300 ? '(Препоръка: 300+ за SEO)' : '✓ Отлична дължина'}
          </span>
          <span className="text-gray-500 font-sans">{readTime} мин четене</span>
        </div>
        <span className="admin-rich-editor-shortcuts hidden sm:inline">Shortcut: Ctrl+B / Ctrl+I / Ctrl+U</span>
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4" onClick={() => setPickerOpen(false)}>
          <div className="bg-white max-w-5xl w-full max-h-[80vh] overflow-hidden border border-gray-200 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-200">
              <h3 className="font-display text-lg font-black text-gray-900 uppercase tracking-wider">Медийна библиотека</h3>
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

      {embedOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4" onClick={() => setEmbedOpen(false)}>
          <div className="bg-white max-w-md w-full border border-gray-200 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-display text-base font-bold text-gray-900 uppercase tracking-wider">Вграждане на видео</h3>
              <button type="button" onClick={() => setEmbedOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleInsertEmbed} className="p-4">
              <label className="block text-sm font-sans font-semibold text-gray-700 mb-2">
                URL адрес на видеото (YouTube, Vimeo)
              </label>
              <input
                type="url"
                required
                value={embedUrl}
                onChange={(e) => setEmbedUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-3 py-2 border border-gray-300 mb-4 focus:outline-none focus:border-zn-purple font-sans text-sm"
              />
              <div className="flex justify-end gap-2 text-sm font-sans">
                <button type="button" onClick={() => setEmbedOpen(false)} className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50">
                  Отказ
                </button>
                <button type="submit" className="px-4 py-2 bg-zn-purple text-white font-semibold hover:bg-zn-purple-dark transition-colors">
                  Вмъкни
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
