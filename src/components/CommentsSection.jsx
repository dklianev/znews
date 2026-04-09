import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle, Send, User, ThumbsUp, ThumbsDown, CornerDownRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePublicData } from '../context/DataContext';
import { formatNewsDate } from '../utils/newsDate';
import { useOptimisticList } from '../hooks/useOptimisticList';

const AVATAR_COLORS = ['bg-zn-purple', 'bg-zn-hot', 'bg-blue-700', 'bg-emerald-700', 'bg-amber-700', 'bg-violet-700', 'bg-rose-700', 'bg-teal-700'];
const COMMENT_AUTHOR_MAX_LEN = 50;
const COMMENT_TEXT_MAX_LEN = 1200;
const COMMENT_REACTIONS_STORAGE_KEY = 'zn_comment_reactions_v1';
const MAX_REPLY_INDENT_PX = 54;
const EMPTY_COMMENT_FIELD_ERRORS = Object.freeze({
  articleId: '',
  author: '',
  text: '',
  parentId: '',
});

const COMMENT_COPY = Object.freeze({
  replyBadge: '\u041e\u0442\u0433\u043e\u0432\u043e\u0440',
  likeAria: '\u0425\u0430\u0440\u0435\u0441\u0430\u0439 \u043a\u043e\u043c\u0435\u043d\u0442\u0430\u0440\u0430',
  dislikeAria: '\u041d\u0435 \u0445\u0430\u0440\u0435\u0441\u0432\u0430\u0439 \u043a\u043e\u043c\u0435\u043d\u0442\u0430\u0440\u0430',
  replyToggleAria: '\u041e\u0442\u0433\u043e\u0432\u043e\u0440\u0438 \u043d\u0430 \u043a\u043e\u043c\u0435\u043d\u0442\u0430\u0440\u0430',
  replyShow: '\u041e\u0442\u0433\u043e\u0432\u043e\u0440\u0438',
  replyHide: '\u0421\u043a\u0440\u0438\u0439',
  replySuccess: '\u041e\u0442\u0433\u043e\u0432\u043e\u0440\u044a\u0442 \u0435 \u0438\u0437\u043f\u0440\u0430\u0442\u0435\u043d \u0438 \u0447\u0430\u043a\u0430 \u043e\u0434\u043e\u0431\u0440\u0435\u043d\u0438\u0435.',
  namePlaceholder: '\u0422\u0432\u043e\u0435\u0442\u043e \u0438\u043c\u0435...',
  replyPlaceholder: '\u0422\u0432\u043e\u044f\u0442 \u043e\u0442\u0433\u043e\u0432\u043e\u0440...',
  commentPlaceholder: '\u0422\u0432\u043e\u044f\u0442 \u043a\u043e\u043c\u0435\u043d\u0442\u0430\u0440...',
  authorRequired: '\u0418\u043c\u0435\u0442\u043e \u0435 \u0437\u0430\u0434\u044a\u043b\u0436\u0438\u0442\u0435\u043b\u043d\u043e.',
  textRequired: '\u041a\u043e\u043c\u0435\u043d\u0442\u0430\u0440\u044a\u0442 \u0435 \u0437\u0430\u0434\u044a\u043b\u0436\u0438\u0442\u0435\u043b\u0435\u043d.',
  submitPending: '\u0418\u0437\u043f\u0440\u0430\u0449\u0430\u043d\u0435...',
  submit: '\u0418\u0437\u043f\u0440\u0430\u0442\u0438',
  commentsHeading: '\u041a\u043e\u043c\u0435\u043d\u0442\u0430\u0440\u0438',
  newCommentHeading: '\u041d\u043e\u0432 \u043a\u043e\u043c\u0435\u043d\u0442\u0430\u0440',
  moderationNotice: '\u041a\u043e\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0442\u0435 \u0441\u0435 \u043f\u0440\u0435\u0433\u043b\u0435\u0436\u0434\u0430\u0442 \u043f\u0440\u0435\u0434\u0438 \u043f\u0443\u0431\u043b\u0438\u043a\u0443\u0432\u0430\u043d\u0435.',
  commentSuccess: '\u041a\u043e\u043c\u0435\u043d\u0442\u0430\u0440\u044a\u0442 \u0435 \u0438\u0437\u043f\u0440\u0430\u0442\u0435\u043d \u0438 \u0447\u0430\u043a\u0430 \u043e\u0434\u043e\u0431\u0440\u0435\u043d\u0438\u0435.',
  nameAria: '\u0422\u0432\u043e\u0435\u0442\u043e \u0438\u043c\u0435',
  commentAria: '\u041a\u043e\u043c\u0435\u043d\u0442\u0430\u0440',
  loadingComments: '\u0417\u0430\u0440\u0435\u0436\u0434\u0430\u043d\u0435 \u043d\u0430 \u043a\u043e\u043c\u0435\u043d\u0442\u0430\u0440\u0438',
  emptyComments: '\u0412\u0441\u0435 \u043e\u0449\u0435 \u043d\u044f\u043c\u0430 \u043a\u043e\u043c\u0435\u043d\u0442\u0430\u0440\u0438. \u0411\u044a\u0434\u0438 \u043f\u044a\u0440\u0432\u0438\u044f\u0442!',
  tooManyComments: '\u0422\u0432\u044a\u0440\u0434\u0435 \u043c\u043d\u043e\u0433\u043e \u043a\u043e\u043c\u0435\u043d\u0442\u0430\u0440\u0438 \u0438\u0437\u043f\u0440\u0430\u0449\u0430\u0448 \u0437\u0430 \u043a\u0440\u0430\u0442\u043a\u043e \u0432\u0440\u0435\u043c\u0435. \u041e\u043f\u0438\u0442\u0430\u0439 \u0441\u043b\u0435\u0434 \u043c\u0430\u043b\u043a\u043e.',
  parentMissing: '\u0420\u043e\u0434\u0438\u0442\u0435\u043b\u0441\u043a\u0438\u044f\u0442 \u043a\u043e\u043c\u0435\u043d\u0442\u0430\u0440 \u0432\u0435\u0447\u0435 \u043d\u0435 \u0435 \u043d\u0430\u043b\u0438\u0447\u0435\u043d \u0437\u0430 \u043e\u0442\u0433\u043e\u0432\u043e\u0440.',
  replyFallbackError: '\u041e\u0442\u0433\u043e\u0432\u043e\u0440\u044a\u0442 \u043d\u0435 \u043c\u043e\u0436\u0430 \u0434\u0430 \u0431\u044a\u0434\u0435 \u0438\u0437\u043f\u0440\u0430\u0442\u0435\u043d. \u041e\u043f\u0438\u0442\u0430\u0439 \u043f\u0430\u043a.',
  commentFallbackError: '\u041a\u043e\u043c\u0435\u043d\u0442\u0430\u0440\u044a\u0442 \u043d\u0435 \u043c\u043e\u0436\u0430 \u0434\u0430 \u0431\u044a\u0434\u0435 \u0438\u0437\u043f\u0440\u0430\u0442\u0435\u043d. \u041e\u043f\u0438\u0442\u0430\u0439 \u043f\u0430\u043a.',
  reactionFallbackError: '\u0420\u0435\u0430\u043a\u0446\u0438\u044f\u0442\u0430 \u043d\u0435 \u043c\u043e\u0436\u0430 \u0434\u0430 \u0431\u044a\u0434\u0435 \u0437\u0430\u043f\u0438\u0441\u0430\u043d\u0430.',
});

function authorTooLongMessage(maxLength) {
  return `\u0418\u043c\u0435\u0442\u043e \u0435 \u0442\u0432\u044a\u0440\u0434\u0435 \u0434\u044a\u043b\u0433\u043e (\u043c\u0430\u043a\u0441. ${maxLength} \u0437\u043d\u0430\u043a\u0430).`;
}

function textTooLongMessage(maxLength) {
  return `\u0421\u044a\u043e\u0431\u0449\u0435\u043d\u0438\u0435\u0442\u043e \u0435 \u0442\u0432\u044a\u0440\u0434\u0435 \u0434\u044a\u043b\u0433\u043e (\u043c\u0430\u043a\u0441. ${maxLength} \u0437\u043d\u0430\u043a\u0430).`;
}

function replyCountLabel(count) {
  return `\u041e\u0442\u0433\u043e\u0432\u043e\u0440\u0438 ${count}`;
}

function commentsHeading(count) {
  return `\u041a\u043e\u043c\u0435\u043d\u0442\u0430\u0440\u0438 (${count})`;
}

function maxCharactersLabel(maxLength) {
  return `\u041c\u0430\u043a\u0441. ${maxLength} \u0437\u043d\u0430\u043a\u0430`;
}

function normalizeCommentFieldErrors(payload) {
  const fieldErrors = payload?.fieldErrors;
  if (!fieldErrors || typeof fieldErrors !== 'object') return EMPTY_COMMENT_FIELD_ERRORS;

  return {
    articleId: typeof fieldErrors.articleId === 'string' ? fieldErrors.articleId : '',
    author: typeof fieldErrors.author === 'string' ? fieldErrors.author : '',
    text: typeof fieldErrors.text === 'string' ? fieldErrors.text : '',
    parentId: typeof fieldErrors.parentId === 'string' ? fieldErrors.parentId : '',
  };
}

function clearCommentFieldError(fieldErrors, key) {
  if (!fieldErrors[key]) return fieldErrors;
  return {
    ...fieldErrors,
    [key]: '',
  };
}

function getFirstCommentFieldError(fieldErrors) {
  return fieldErrors.author || fieldErrors.text || fieldErrors.parentId || fieldErrors.articleId || '';
}

function mapCommentErrorMessage(message, fallbackMessage, fieldErrors = EMPTY_COMMENT_FIELD_ERRORS) {
  const normalized = String(message || '');
  if (normalized.includes('Too many comments')) return COMMENT_COPY.tooManyComments;
  if (normalized.includes('Comment too long')) return textTooLongMessage(COMMENT_TEXT_MAX_LEN);
  if (normalized.includes('Author too long')) return authorTooLongMessage(COMMENT_AUTHOR_MAX_LEN);
  if (normalized.includes('Parent comment')) return COMMENT_COPY.parentMissing;
  return normalized || getFirstCommentFieldError(fieldErrors) || fallbackMessage;
}

function getAvatarColor(name) {
  const charCode = (name || 'A').charCodeAt(0);
  return AVATAR_COLORS[charCode % AVATAR_COLORS.length];
}

function normalizeReaction(value) {
  if (value === 'like' || value === 'dislike') return value;
  return null;
}

function readStoredReactions() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(COMMENT_REACTIONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    const sanitized = {};
    Object.entries(parsed).forEach(([key, value]) => {
      const normalized = normalizeReaction(value);
      if (normalized) sanitized[key] = normalized;
    });
    return sanitized;
  } catch {
    return {};
  }
}

function buildCommentTree(items) {
  const list = Array.isArray(items) ? items : [];
  const nodes = list.map(comment => ({
    ...comment,
    replies: [],
  }));
  const byId = new Map();
  nodes.forEach((node) => {
    const id = Number.parseInt(node?.id, 10);
    if (Number.isInteger(id)) byId.set(id, node);
  });

  const roots = [];
  nodes.forEach((node) => {
    const selfId = Number.parseInt(node?.id, 10);
    const parentId = Number.parseInt(node?.parentId, 10);
    if (
      Number.isInteger(parentId)
      && parentId !== selfId
      && byId.has(parentId)
    ) {
      byId.get(parentId).replies.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortReplies = (replyList) => {
    replyList.sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
    replyList.forEach(item => sortReplies(item.replies));
  };

  roots.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
  roots.forEach(item => sortReplies(item.replies));
  return roots;
}

function applyOptimisticReaction(items, mutation) {
  if (!Array.isArray(items)) return [];
  if (!mutation || mutation.type !== 'reaction') return items;

  const targetId = Number(mutation.commentId);
  return items.map((comment) => {
    if (Number(comment?.id) !== targetId) return comment;

    let likes = Math.max(0, Number.parseInt(comment.likes, 10) || 0);
    let dislikes = Math.max(0, Number.parseInt(comment.dislikes, 10) || 0);

    if (mutation.previousReaction === 'like') likes = Math.max(0, likes - 1);
    if (mutation.previousReaction === 'dislike') dislikes = Math.max(0, dislikes - 1);
    if (mutation.desiredReaction === 'like') likes += 1;
    if (mutation.desiredReaction === 'dislike') dislikes += 1;

    return {
      ...comment,
      likes,
      dislikes,
      userReaction: mutation.desiredReaction === 'none' ? null : mutation.desiredReaction,
    };
  });
}

const CommentItem = memo(function CommentItem({
  comment,
  level,
  reactingId,
  reactionByComment,
  onReact,
  onReplySubmit,
}) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyName, setReplyName] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyError, setReplyError] = useState('');
  const [replySubmitted, setReplySubmitted] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyFieldErrors, setReplyFieldErrors] = useState(EMPTY_COMMENT_FIELD_ERRORS);

  const likeCount = Math.max(0, Number.parseInt(comment.likes, 10) || 0);
  const dislikeCount = Math.max(0, Number.parseInt(comment.dislikes, 10) || 0);
  const replyCount = Array.isArray(comment.replies) ? comment.replies.length : 0;
  const hasReplies = replyCount > 0;
  const selectedReaction = normalizeReaction(reactionByComment[String(comment.id)]);
  const isReacting = Number(reactingId) === Number(comment.id);
  const indentPx = Math.min(level * 18, MAX_REPLY_INDENT_PX);

  const handleReplySubmit = async (event) => {
    event.preventDefault();
    setReplyError('');
    setReplyFieldErrors(EMPTY_COMMENT_FIELD_ERRORS);

    const author = replyName.trim();
    const text = replyText.trim();
    if (!author || !text) {
      const nextFieldErrors = {
        ...EMPTY_COMMENT_FIELD_ERRORS,
        author: author ? '' : COMMENT_COPY.authorRequired,
        text: text ? '' : COMMENT_COPY.textRequired,
      };
      setReplyFieldErrors(nextFieldErrors);
      setReplyError(mapCommentErrorMessage('', COMMENT_COPY.replyFallbackError, nextFieldErrors));
      return;
    }
    if (author.length > COMMENT_AUTHOR_MAX_LEN) {
      setReplyFieldErrors((prev) => ({ ...prev, author: authorTooLongMessage(COMMENT_AUTHOR_MAX_LEN) }));
      setReplyError(authorTooLongMessage(COMMENT_AUTHOR_MAX_LEN));
      return;
    }
    if (text.length > COMMENT_TEXT_MAX_LEN) {
      setReplyFieldErrors((prev) => ({ ...prev, text: textTooLongMessage(COMMENT_TEXT_MAX_LEN) }));
      setReplyError(textTooLongMessage(COMMENT_TEXT_MAX_LEN));
      return;
    }

    setSubmittingReply(true);
    try {
      await onReplySubmit(comment.id, { author, text });
      setReplyName('');
      setReplyText('');
      setReplySubmitted(true);
      setShowReplyForm(false);
      window.setTimeout(() => setReplySubmitted(false), 5000);
    } catch (error) {
      const nextFieldErrors = normalizeCommentFieldErrors(error?.payload);
      setReplyFieldErrors(nextFieldErrors);
      setReplyError(mapCommentErrorMessage(error?.message, COMMENT_COPY.replyFallbackError, nextFieldErrors));
    } finally {
      setSubmittingReply(false);
    }
  };

  return (
    <div style={{ marginLeft: `${indentPx}px` }}>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className={`group/comment flex gap-3 p-3.5 sm:p-4 bg-white comic-panel shadow-[2px_2px_0_rgba(28,20,40,0.18)] ${level > 0 ? 'border-l-2 border-l-zn-hot/70 bg-[#FBF8F1]' : 'border-l-3 border-l-zn-purple'}`}
      >
        <div className={`w-10 h-10 ${getAvatarColor(comment.author)} text-white flex items-center justify-center font-display font-black text-sm shrink-0 border-2 border-[#1C1428]`}>
          {(comment.author || 'A').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {level > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-display font-black uppercase tracking-wider text-zn-hot">
                <CornerDownRight className="w-3 h-3" />
                {COMMENT_COPY.replyBadge}
              </span>
            )}
            <span className="font-display font-black text-sm text-zn-text uppercase tracking-wider">{comment.author}</span>
            <span className="text-[10px] font-display text-zn-text-muted tracking-wider normal-case">{formatNewsDate(comment.date)}</span>
          </div>
          <p className="font-sans text-sm text-zn-text leading-relaxed whitespace-pre-wrap">{comment.text}</p>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onReact(comment.id, 'like')}
              disabled={isReacting}
              className={`inline-flex h-8 items-center gap-1.5 px-2.5 border text-[11px] sm:text-xs font-display font-black uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF8F1] disabled:opacity-50 ${selectedReaction === 'like' ? 'bg-emerald-100 border-emerald-400 text-emerald-700' : 'bg-[#F7F3EA] border-[#1C1428]/20 text-zn-text-muted hover:text-zn-text hover:border-[#1C1428]/40'}`}
              aria-label={COMMENT_COPY.likeAria}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>{likeCount}</span>
            </button>
            <button
              type="button"
              onClick={() => onReact(comment.id, 'dislike')}
              disabled={isReacting}
              className={`inline-flex h-8 items-center gap-1.5 px-2.5 border text-[11px] sm:text-xs font-display font-black uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF8F1] disabled:opacity-50 ${selectedReaction === 'dislike' ? 'bg-red-100 border-red-400 text-red-700' : 'bg-[#F7F3EA] border-[#1C1428]/20 text-zn-text-muted hover:text-zn-text hover:border-[#1C1428]/40'}`}
              aria-label={COMMENT_COPY.dislikeAria}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              <span>{dislikeCount}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowReplyForm(prev => !prev)}
              className="inline-flex h-8 items-center gap-1.5 px-2.5 border border-[#1C1428]/20 bg-white text-[11px] sm:text-xs font-display font-black uppercase tracking-wider text-zn-text-muted hover:text-zn-text hover:border-[#1C1428]/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF8F1]"
              aria-label={COMMENT_COPY.replyToggleAria}
            >
              <CornerDownRight className="w-3.5 h-3.5" />
              <span>{showReplyForm ? COMMENT_COPY.replyHide : COMMENT_COPY.replyShow}</span>
            </button>
            {hasReplies && (
              <span className="comment-meta-chip">
                {replyCountLabel(replyCount)}
              </span>
            )}
          </div>

          <AnimatePresence>
            {replySubmitted && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-700 text-[11px] font-display font-black uppercase tracking-wider" role="status">
                  {COMMENT_COPY.replySuccess}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {showReplyForm && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0, y: -4 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 12, y: 0 }}
                exit={{ opacity: 0, height: 0, marginTop: 0, y: -4 }}
                transition={{
                  height: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
                  marginTop: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
                  opacity: { duration: 0.16, ease: 'easeOut' },
                  y: { duration: 0.16, ease: 'easeOut' },
                }}
                className="overflow-hidden"
              >
                <form
                  className="space-y-2.5 bg-[#FBF8F1] border border-[#1C1428]/15 p-3"
                  onSubmit={handleReplySubmit}
                >
                  {replyError && (
                    <div className="p-2.5 bg-red-50 border border-red-300 text-red-700 text-[11px] font-display font-black uppercase tracking-wider" role="alert">
                      {replyError}
                    </div>
                  )}
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zn-text-muted" />
                    <input
                      type="text"
                      value={replyName}
                      onChange={(event) => {
                        setReplyName(event.target.value);
                        setReplyFieldErrors((prev) => clearCommentFieldError(prev, 'author'));
                      }}
                      placeholder={COMMENT_COPY.namePlaceholder}
                      required
                      maxLength={COMMENT_AUTHOR_MAX_LEN}
                      aria-invalid={replyFieldErrors.author ? 'true' : 'false'}
                      aria-describedby={replyFieldErrors.author ? `reply-author-error-${comment.id}` : undefined}
                      className={`w-full pl-8 pr-3 py-2 bg-white border text-zn-text placeholder-zn-text-dim font-sans text-xs outline-none transition-colors focus:border-zn-purple focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF8F1] ${replyFieldErrors.author ? 'border-red-400' : 'border-[#1C1428]/20'}`}
                    />
                  </div>
                  {replyFieldErrors.author && (
                    <p
                      id={`reply-author-error-${comment.id}`}
                      className="text-[10px] font-display font-black uppercase tracking-wider text-red-700"
                    >
                      {replyFieldErrors.author}
                    </p>
                  )}
                  <textarea
                    value={replyText}
                    onChange={(event) => {
                      setReplyText(event.target.value);
                      setReplyFieldErrors((prev) => clearCommentFieldError(prev, 'text'));
                    }}
                    placeholder={COMMENT_COPY.replyPlaceholder}
                    required
                    rows="2"
                    maxLength={COMMENT_TEXT_MAX_LEN}
                    aria-invalid={replyFieldErrors.text ? 'true' : 'false'}
                    aria-describedby={replyFieldErrors.text ? `reply-text-error-${comment.id}` : undefined}
                    className={`w-full px-3 py-2 bg-white border text-zn-text placeholder-zn-text-dim font-sans text-xs outline-none transition-colors focus:border-zn-purple focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF8F1] resize-none ${replyFieldErrors.text ? 'border-red-400' : 'border-[#1C1428]/20'}`}
                  />
                  {replyFieldErrors.text && (
                    <p
                      id={`reply-text-error-${comment.id}`}
                      className="text-[10px] font-display font-black uppercase tracking-wider text-red-700"
                    >
                      {replyFieldErrors.text}
                    </p>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[10px] font-display font-bold uppercase tracking-wider text-zn-text-muted">
                    <span>{replyText.length}/{COMMENT_TEXT_MAX_LEN}</span>
                    <button
                      type="submit"
                      disabled={submittingReply}
                      className="comment-submit-btn w-full sm:w-auto px-3 py-1.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF8F1]"
                      aria-busy={submittingReply}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {submittingReply ? COMMENT_COPY.submitPending : COMMENT_COPY.submit}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {Array.isArray(comment.replies) && comment.replies.length > 0 && (
        <div className="space-y-2 mt-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              level={level + 1}
              reactingId={reactingId}
              reactionByComment={reactionByComment}
              onReact={onReact}
              onReplySubmit={onReplySubmit}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default function CommentsSection({ articleId }) {
  const { comments, addComment, reactToComment, loadCommentsForArticle } = usePublicData();
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [error, setError] = useState('');
  const [reactionError, setReactionError] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [reactingId, setReactingId] = useState(null);
  const [reactionByComment, setReactionByComment] = useState(readStoredReactions);
  const [commentFieldErrors, setCommentFieldErrors] = useState(EMPTY_COMMENT_FIELD_ERRORS);

  useEffect(() => {
    let cancelled = false;
    setLoadingComments(true);
    loadCommentsForArticle(articleId)
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingComments(false);
      });
    return () => {
      cancelled = true;
    };
  }, [articleId, loadCommentsForArticle]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(COMMENT_REACTIONS_STORAGE_KEY, JSON.stringify(reactionByComment));
    } catch {
      // Ignore storage failures in private mode or blocked storage contexts.
    }
  }, [reactionByComment]);

  const articleComments = useMemo(() => {
    return comments
      .filter(c => Number(c.articleId) === Number(articleId) && c.approved)
      .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
  }, [articleId, comments]);

  const [optimisticComments, { apply: addOptimisticReaction }] = useOptimisticList(articleComments, applyOptimisticReaction);

  const threadedComments = useMemo(() => buildCommentTree(optimisticComments), [optimisticComments]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setCommentFieldErrors(EMPTY_COMMENT_FIELD_ERRORS);
    const author = name.trim();
    const body = text.trim();

    if (!author || !body) {
      const nextFieldErrors = {
        ...EMPTY_COMMENT_FIELD_ERRORS,
        author: author ? '' : COMMENT_COPY.authorRequired,
        text: body ? '' : COMMENT_COPY.textRequired,
      };
      setCommentFieldErrors(nextFieldErrors);
      setError(mapCommentErrorMessage('', COMMENT_COPY.commentFallbackError, nextFieldErrors));
      return;
    }
    if (author.length > COMMENT_AUTHOR_MAX_LEN) {
      setCommentFieldErrors((prev) => ({ ...prev, author: authorTooLongMessage(COMMENT_AUTHOR_MAX_LEN) }));
      setError(authorTooLongMessage(COMMENT_AUTHOR_MAX_LEN));
      return;
    }
    if (body.length > COMMENT_TEXT_MAX_LEN) {
      setCommentFieldErrors((prev) => ({ ...prev, text: textTooLongMessage(COMMENT_TEXT_MAX_LEN) }));
      setError(textTooLongMessage(COMMENT_TEXT_MAX_LEN));
      return;
    }

    setSubmittingComment(true);
    try {
      await addComment({
        articleId,
        author,
        text: body,
      });
      setName('');
      setText('');
      setSubmitted(true);
      window.setTimeout(() => setSubmitted(false), 5000);
    } catch (submitError) {
      const nextFieldErrors = normalizeCommentFieldErrors(submitError?.payload);
      setCommentFieldErrors(nextFieldErrors);
      setError(mapCommentErrorMessage(submitError?.message, COMMENT_COPY.commentFallbackError, nextFieldErrors));
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleReplySubmit = useCallback(async (parentId, payload) => {
    await addComment({
      articleId,
      parentId,
      author: payload.author,
      text: payload.text,
    });
  }, [addComment, articleId]);

  const handleReaction = useCallback(async (commentId, nextReaction) => {
    const key = String(commentId);
    const currentReaction = normalizeReaction(reactionByComment[key]);
    const desiredReaction = currentReaction === nextReaction ? 'none' : nextReaction;

    setReactionError('');
    setReactingId(commentId);
    addOptimisticReaction({
      type: 'reaction',
      commentId,
      previousReaction: currentReaction,
      desiredReaction,
    });
    setReactionByComment((prev) => {
      const next = { ...prev };
      if (desiredReaction === 'none') delete next[key];
      else next[key] = desiredReaction;
      return next;
    });

    try {
      await reactToComment(commentId, desiredReaction);
    } catch (reactionFailure) {
      addOptimisticReaction({
        type: 'reaction',
        commentId,
        previousReaction: desiredReaction,
        desiredReaction: currentReaction || 'none',
      });
      loadCommentsForArticle(articleId).catch(() => {});
      setReactionByComment((prev) => {
        const next = { ...prev };
        if (currentReaction) next[key] = currentReaction;
        else delete next[key];
        return next;
      });
      setReactionError(reactionFailure?.message || COMMENT_COPY.reactionFallbackError);
    } finally {
      setReactingId(null);
    }
  }, [addOptimisticReaction, articleId, loadCommentsForArticle, reactionByComment, reactToComment]);

  return (
    <section className="mt-10 pt-8 border-t-2 border-zn-border/50">
      <div className="flex items-center gap-2 mb-1">
        <MessageCircle className="w-5 h-5 text-zn-purple" />
        <h2 className="font-display font-black text-xl text-zn-text tracking-wider uppercase">
          {commentsHeading(optimisticComments.length)}
        </h2>
      </div>
      <div className="h-1 bg-gradient-to-r from-zn-purple to-zn-hot mt-2 mb-6" />

      <form onSubmit={handleSubmit} className="mb-8 newspaper-page comic-panel comic-dots p-5 relative overflow-hidden">
        <div className="absolute -top-2 right-6 w-12 h-4 bg-yellow-200/70 border border-black/5 transform rotate-3 z-10" style={{ boxShadow: '1px 1px 2px rgba(0,0,0,0.1)' }} />
        <h3 className="font-display font-black uppercase text-sm text-zn-text mb-3 tracking-widest relative z-[2]">{COMMENT_COPY.newCommentHeading}</h3>
        <p className="relative z-[2] text-xs font-sans text-zn-text-muted mb-3">
          {COMMENT_COPY.moderationNotice}
        </p>
        <AnimatePresence>
          {submitted && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mb-3 p-3 bg-emerald-50 border-2 border-emerald-300 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-400/30 dark:text-emerald-200 text-sm font-display font-bold uppercase tracking-wider relative z-[2]" role="status">
                {COMMENT_COPY.commentSuccess}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mb-3 p-3 bg-red-50 border-2 border-red-300 text-red-700 dark:bg-red-950/30 dark:border-red-400/30 dark:text-red-200 text-sm font-display font-bold uppercase tracking-wider relative z-[2]" role="alert">
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {reactionError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mb-3 p-3 bg-red-50 border-2 border-red-300 text-red-700 dark:bg-red-950/30 dark:border-red-400/30 dark:text-red-200 text-sm font-display font-bold uppercase tracking-wider relative z-[2]" role="alert">
                {reactionError}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex gap-3 mb-3 relative z-[2]">
          <div className="relative flex-1">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zn-text-muted" />
            <input
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setCommentFieldErrors((prev) => clearCommentFieldError(prev, 'author'));
              }}
              placeholder={COMMENT_COPY.namePlaceholder}
              required
              maxLength={COMMENT_AUTHOR_MAX_LEN}
              aria-label={COMMENT_COPY.nameAria}
              aria-invalid={commentFieldErrors.author ? 'true' : 'false'}
              aria-describedby={commentFieldErrors.author ? 'comment-author-error' : undefined}
              className={`w-full pl-9 pr-3 py-2.5 bg-white border-2 text-zn-text placeholder-zn-text-dim font-sans text-sm outline-none focus:border-zn-purple focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF8F1] transition-colors ${commentFieldErrors.author ? 'border-red-400' : 'border-[#1C1428]/20'}`}
            />
          </div>
        </div>
        {commentFieldErrors.author && (
          <p
            id="comment-author-error"
            className="mb-3 text-[10px] font-display font-black uppercase tracking-wider text-red-700 relative z-[2]"
          >
            {commentFieldErrors.author}
          </p>
        )}
        <textarea
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setCommentFieldErrors((prev) => clearCommentFieldError(prev, 'text'));
          }}
          placeholder={COMMENT_COPY.commentPlaceholder}
          required
          rows="3"
          maxLength={COMMENT_TEXT_MAX_LEN}
          aria-label={COMMENT_COPY.commentAria}
          aria-invalid={commentFieldErrors.text ? 'true' : 'false'}
          aria-describedby={commentFieldErrors.text ? 'comment-text-error' : undefined}
          className={`w-full px-3 py-2.5 bg-white border-2 text-zn-text placeholder-zn-text-dim font-sans text-sm outline-none focus:border-zn-purple focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF8F1] resize-none mb-3 relative z-[2] ${commentFieldErrors.text ? 'border-red-400' : 'border-[#1C1428]/20'}`}
        />
        {commentFieldErrors.text && (
          <p
            id="comment-text-error"
            className="mb-3 text-[10px] font-display font-black uppercase tracking-wider text-red-700 relative z-[2]"
          >
            {commentFieldErrors.text}
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-1 relative z-[2]">
          <div className="flex items-center justify-between text-[10px] font-display font-bold uppercase tracking-wider text-zn-text-muted w-full sm:w-auto gap-4">
            <span>{maxCharactersLabel(COMMENT_TEXT_MAX_LEN)}</span>
            <span className={text.length > COMMENT_TEXT_MAX_LEN * 0.9 ? 'text-zn-hot' : ''}>
              {text.length}/{COMMENT_TEXT_MAX_LEN}
            </span>
          </div>
          <button
            type="submit"
            disabled={submittingComment}
            className="comment-submit-btn w-full sm:w-auto relative z-[2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF8F1]"
            aria-busy={submittingComment}
          >
            <Send className="w-4 h-4" />
            {submittingComment ? COMMENT_COPY.submitPending : COMMENT_COPY.submit}
          </button>
        </div>
      </form>

      {loadingComments && optimisticComments.length === 0 ? (
        <div className="space-y-3" aria-label={COMMENT_COPY.loadingComments}>
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="flex gap-3 p-3 border-l-3 border-l-zn-purple bg-white comic-panel animate-pulse"
            >
              <div className="w-10 h-10 shrink-0 border-2 border-[#1C1428]/20 bg-zn-text/10" />
              <div className="flex-1 min-w-0">
                <div className="h-3 w-32 bg-zn-text/10 rounded mb-2" />
                <div className="h-3 w-full bg-zn-text/10 rounded mb-1" />
                <div className="h-3 w-5/6 bg-zn-text/10 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : optimisticComments.length === 0 ? (
        <p className="text-center py-8 text-sm font-display font-bold text-zn-text-muted uppercase tracking-wider">
          {COMMENT_COPY.emptyComments}
        </p>
      ) : (
        <div className="space-y-3">
          {threadedComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              level={0}
              reactingId={reactingId}
              reactionByComment={reactionByComment}
              onReact={handleReaction}
              onReplySubmit={handleReplySubmit}
            />
          ))}
        </div>
      )}
    </section>
  );
}
