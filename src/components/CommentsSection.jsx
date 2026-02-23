import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle, Send, User, ThumbsUp, ThumbsDown, CornerDownRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../context/DataContext';

const AVATAR_COLORS = ['bg-zn-purple', 'bg-zn-hot', 'bg-blue-700', 'bg-emerald-700', 'bg-amber-700', 'bg-violet-700', 'bg-rose-700', 'bg-teal-700'];
const COMMENT_AUTHOR_MAX_LEN = 50;
const COMMENT_TEXT_MAX_LEN = 1200;
const COMMENT_REACTIONS_STORAGE_KEY = 'zn_comment_reactions_v1';
const MAX_REPLY_INDENT_PX = 54;

function getAvatarColor(name) {
  const charCode = (name || 'A').charCodeAt(0);
  return AVATAR_COLORS[charCode % AVATAR_COLORS.length];
}

function formatCommentDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return raw;
  return parsed.toISOString().slice(0, 10);
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

function CommentItem({
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

  const likeCount = Math.max(0, Number.parseInt(comment.likes, 10) || 0);
  const dislikeCount = Math.max(0, Number.parseInt(comment.dislikes, 10) || 0);
  const replyCount = Array.isArray(comment.replies) ? comment.replies.length : 0;
  const hasReplies = replyCount > 0;
  const selectedReaction = normalizeReaction(reactionByComment[String(comment.id)]);
  const isReacting = Number(reactingId) === Number(comment.id);
  const indentPx = Math.min(level * 18, MAX_REPLY_INDENT_PX);

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    setReplyError('');

    const author = replyName.trim();
    const text = replyText.trim();
    if (!author || !text) return;
    if (author.length > COMMENT_AUTHOR_MAX_LEN) {
      setReplyError(`Името е твърде дълго (макс. ${COMMENT_AUTHOR_MAX_LEN} знака).`);
      return;
    }
    if (text.length > COMMENT_TEXT_MAX_LEN) {
      setReplyError(`Коментарът е твърде дълъг (макс. ${COMMENT_TEXT_MAX_LEN} знака).`);
      return;
    }

    setSubmittingReply(true);
    try {
      await onReplySubmit(comment.id, { author, text });
      setReplyName('');
      setReplyText('');
      setReplySubmitted(true);
      setShowReplyForm(false);
      setTimeout(() => setReplySubmitted(false), 5000);
    } catch (err) {
      const msg = String(err?.message || '');
      if (msg.includes('Too many comments')) {
        setReplyError('Твърде много коментари за кратко време. Опитай пак след малко.');
      } else if (msg.includes('Comment too long')) {
        setReplyError(`Коментарът е твърде дълъг (макс. ${COMMENT_TEXT_MAX_LEN} знака).`);
      } else if (msg.includes('Author too long')) {
        setReplyError(`Името е твърде дълго (макс. ${COMMENT_AUTHOR_MAX_LEN} знака).`);
      } else if (msg.includes('Parent comment')) {
        setReplyError('Оригиналният коментар вече не е наличен за отговор.');
      } else {
        setReplyError(msg || 'Отговорът не можа да бъде изпратен. Опитай отново.');
      }
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
                Отговор
              </span>
            )}
            <span className="font-display font-black text-sm text-zn-text uppercase tracking-wider">{comment.author}</span>
            <span className="text-[10px] font-display text-zn-text-muted uppercase tracking-wider">{formatCommentDate(comment.date)}</span>
          </div>
          <p className="font-sans text-sm text-zn-text leading-relaxed whitespace-pre-wrap">{comment.text}</p>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onReact(comment.id, 'like')}
              disabled={isReacting}
              className={`inline-flex h-8 items-center gap-1.5 px-2.5 border text-[11px] sm:text-xs font-display font-black uppercase tracking-wider transition-colors disabled:opacity-50 ${selectedReaction === 'like' ? 'bg-emerald-100 border-emerald-400 text-emerald-700' : 'bg-[#F7F3EA] border-[#1C1428]/20 text-zn-text-muted hover:text-zn-text hover:border-[#1C1428]/40'}`}
              aria-label="Харесай коментара"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>{likeCount}</span>
            </button>
            <button
              type="button"
              onClick={() => onReact(comment.id, 'dislike')}
              disabled={isReacting}
              className={`inline-flex h-8 items-center gap-1.5 px-2.5 border text-[11px] sm:text-xs font-display font-black uppercase tracking-wider transition-colors disabled:opacity-50 ${selectedReaction === 'dislike' ? 'bg-red-100 border-red-400 text-red-700' : 'bg-[#F7F3EA] border-[#1C1428]/20 text-zn-text-muted hover:text-zn-text hover:border-[#1C1428]/40'}`}
              aria-label="Не харесвам коментара"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              <span>{dislikeCount}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowReplyForm(prev => !prev)}
              className="inline-flex h-8 items-center gap-1.5 px-2.5 border border-[#1C1428]/20 bg-white text-[11px] sm:text-xs font-display font-black uppercase tracking-wider text-zn-text-muted hover:text-zn-text hover:border-[#1C1428]/40 transition-colors"
              aria-label="Отговори на коментара"
            >
              <CornerDownRight className="w-3.5 h-3.5" />
              <span>{showReplyForm ? 'Отказ' : 'Отговори'}</span>
            </button>
            {hasReplies && (
              <span className="comment-meta-chip">
                Отговори {replyCount}
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
                <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-700 text-[11px] font-display font-black uppercase tracking-wider">
                  Отговорът е изпратен и чака одобрение.
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showReplyForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3 overflow-hidden space-y-2.5 bg-[#FBF8F1] border border-[#1C1428]/15 p-3"
                onSubmit={handleReplySubmit}
              >
                {replyError && (
                  <div className="p-2.5 bg-red-50 border border-red-300 text-red-700 text-[11px] font-display font-black uppercase tracking-wider">
                    {replyError}
                  </div>
                )}
                <div className="relative">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zn-text-muted" />
                  <input
                    type="text"
                    value={replyName}
                    onChange={e => setReplyName(e.target.value)}
                    placeholder="Твоето име..."
                    required
                    maxLength={COMMENT_AUTHOR_MAX_LEN}
                    className="w-full pl-8 pr-3 py-2 bg-white border border-[#1C1428]/20 text-zn-text placeholder-zn-text-dim font-sans text-xs outline-none focus:border-zn-purple"
                  />
                </div>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Напиши отговор..."
                  required
                  rows="2"
                  maxLength={COMMENT_TEXT_MAX_LEN}
                  className="w-full px-3 py-2 bg-white border border-[#1C1428]/20 text-zn-text placeholder-zn-text-dim font-sans text-xs outline-none focus:border-zn-purple resize-none"
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[10px] font-display font-bold uppercase tracking-wider text-zn-text-muted">
                  <span>{replyText.length}/{COMMENT_TEXT_MAX_LEN}</span>
                  <button
                    type="submit"
                    disabled={submittingReply}
                    className="comment-submit-btn w-full sm:w-auto px-3 py-1.5 text-[11px]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submittingReply ? 'Изпращане...' : 'Изпрати'}
                  </button>
                </div>
              </motion.form>
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
}

export default function CommentsSection({ articleId }) {
  const { comments, addComment, reactToComment, loadCommentsForArticle } = useData();
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [error, setError] = useState('');
  const [reactionError, setReactionError] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [reactingId, setReactingId] = useState(null);
  const [reactionByComment, setReactionByComment] = useState(readStoredReactions);

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
    } catch { }
  }, [reactionByComment]);

  const articleComments = useMemo(() => {
    return comments
      .filter(c => Number(c.articleId) === Number(articleId) && c.approved)
      .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
  }, [articleId, comments]);

  const threadedComments = useMemo(() => buildCommentTree(articleComments), [articleComments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const author = name.trim();
    const body = text.trim();

    if (!author || !body) return;
    if (author.length > COMMENT_AUTHOR_MAX_LEN) {
      setError(`Името е твърде дълго (макс. ${COMMENT_AUTHOR_MAX_LEN} знака).`);
      return;
    }
    if (body.length > COMMENT_TEXT_MAX_LEN) {
      setError(`Коментарът е твърде дълъг (макс. ${COMMENT_TEXT_MAX_LEN} знака).`);
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
      setTimeout(() => setSubmitted(false), 5000);
    } catch (err) {
      const msg = String(err?.message || '');
      if (msg.includes('Too many comments')) {
        setError('Твърде много коментари за кратко време. Опитай пак след малко.');
      } else if (msg.includes('Comment too long')) {
        setError(`Коментарът е твърде дълъг (макс. ${COMMENT_TEXT_MAX_LEN} знака).`);
      } else if (msg.includes('Author too long')) {
        setError(`Името е твърде дълго (макс. ${COMMENT_AUTHOR_MAX_LEN} знака).`);
      } else {
        setError(msg || 'Коментарът не можа да бъде изпратен. Опитайте отново.');
      }
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
    try {
      await reactToComment(commentId, desiredReaction);
      setReactionByComment((prev) => {
        const next = { ...prev };
        if (desiredReaction === 'none') delete next[key];
        else next[key] = desiredReaction;
        return next;
      });
    } catch (err) {
      setReactionError(err?.message || 'Реакцията не можа да бъде записана.');
    } finally {
      setReactingId(null);
    }
  }, [reactionByComment, reactToComment]);

  return (
    <section className="mt-10 pt-8 border-t-2 border-zn-border/50">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-1">
        <MessageCircle className="w-5 h-5 text-zn-purple" />
        <h2 className="font-display font-black text-xl text-zn-text tracking-wider uppercase">
          Коментари ({articleComments.length})
        </h2>
      </div>
      <div className="h-1 bg-gradient-to-r from-zn-purple to-zn-hot mt-2 mb-6" />

      {/* Comment form */}
      <form onSubmit={handleSubmit} className="mb-8 newspaper-page comic-panel comic-dots p-5 relative overflow-hidden">
        <div className="absolute -top-2 right-6 w-12 h-4 bg-yellow-200/70 border border-black/5 transform rotate-3 z-10" style={{boxShadow:'1px 1px 2px rgba(0,0,0,0.1)'}} />
        <h3 className="font-display font-black uppercase text-sm text-zn-text mb-3 tracking-widest relative z-[2]">Остави коментар</h3>
        <p className="relative z-[2] text-xs font-sans text-zn-text-muted mb-3">
          Коментарът се публикува след одобрение от редактор.
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
              <div className="mb-3 p-3 bg-emerald-50 border-2 border-emerald-300 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-400/30 dark:text-emerald-200 text-sm font-display font-bold uppercase tracking-wider relative z-[2]">
                Коментарът е изпратен и очаква одобрение.
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
              <div className="mb-3 p-3 bg-red-50 border-2 border-red-300 text-red-700 dark:bg-red-950/30 dark:border-red-400/30 dark:text-red-200 text-sm font-display font-bold uppercase tracking-wider relative z-[2]">
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
              <div className="mb-3 p-3 bg-red-50 border-2 border-red-300 text-red-700 dark:bg-red-950/30 dark:border-red-400/30 dark:text-red-200 text-sm font-display font-bold uppercase tracking-wider relative z-[2]">
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
              onChange={e => setName(e.target.value)}
              placeholder="Твоето име..."
              required
              maxLength={COMMENT_AUTHOR_MAX_LEN}
              aria-label="Твоето име"
              className="w-full pl-9 pr-3 py-2.5 bg-white border-2 border-[#1C1428]/20 text-zn-text placeholder-zn-text-dim font-sans text-sm outline-none focus:border-zn-purple transition-colors"
            />
          </div>
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Напиши коментар..."
          required
          rows="3"
          maxLength={COMMENT_TEXT_MAX_LEN}
          aria-label="Коментар"
          className="w-full px-3 py-2.5 bg-white border-2 border-[#1C1428]/20 text-zn-text placeholder-zn-text-dim font-sans text-sm outline-none focus:border-zn-purple resize-none mb-3 relative z-[2]"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-1 relative z-[2]">
          <div className="flex items-center justify-between text-[10px] font-display font-bold uppercase tracking-wider text-zn-text-muted w-full sm:w-auto gap-4">
            <span>Макс. {COMMENT_TEXT_MAX_LEN} знака</span>
            <span className={text.length > COMMENT_TEXT_MAX_LEN * 0.9 ? 'text-zn-hot' : ''}>
              {text.length}/{COMMENT_TEXT_MAX_LEN}
            </span>
          </div>
          <button
            type="submit"
            disabled={submittingComment}
            className="comment-submit-btn w-full sm:w-auto relative z-[2]"
          >
            <Send className="w-4 h-4" />
            {submittingComment ? 'Изпращане...' : 'Изпрати'}
          </button>
        </div>
      </form>

      {/* Comments list */}
      {loadingComments && articleComments.length === 0 ? (
        <div className="space-y-3" aria-label="Зареждане на коментари">
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
      ) : articleComments.length === 0 ? (
        <p className="text-center py-8 text-sm font-display font-bold text-zn-text-muted uppercase tracking-wider">
          Все още няма коментари. Бъди първият!
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
