import { useEffect, useState } from 'react';
import { MessageCircle, Send, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../context/DataContext';

const AVATAR_COLORS = ['bg-zn-purple', 'bg-zn-hot', 'bg-blue-700', 'bg-emerald-700', 'bg-amber-700', 'bg-violet-700', 'bg-rose-700', 'bg-teal-700'];
const COMMENT_AUTHOR_MAX_LEN = 50;
const COMMENT_TEXT_MAX_LEN = 1200;

function getAvatarColor(name) {
  const charCode = (name || 'A').charCodeAt(0);
  return AVATAR_COLORS[charCode % AVATAR_COLORS.length];
}

export default function CommentsSection({ articleId }) {
  const { comments, addComment, loadCommentsForArticle } = useData();
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

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

  const articleComments = comments
    .filter(c => Number(c.articleId) === Number(articleId) && c.approved)
    .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

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
    }
  };

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
      <form onSubmit={handleSubmit} className="mb-8 newspaper-page comic-panel comic-dots p-5 relative">
        <div className="absolute -top-2 right-6 w-12 h-4 bg-yellow-200/70 border border-black/5 transform rotate-3 z-10" style={{boxShadow:'1px 1px 2px rgba(0,0,0,0.1)'}} />
        <h3 className="font-display font-black uppercase text-sm text-zn-text mb-3 tracking-widest relative z-[2]">Остави коментар</h3>
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
        <div className="flex items-center justify-between text-[10px] font-display font-bold uppercase tracking-wider text-zn-text-muted mb-3 relative z-[2]">
          <span>Макс. {COMMENT_TEXT_MAX_LEN} знака</span>
          <span className={text.length > COMMENT_TEXT_MAX_LEN * 0.9 ? 'text-zn-hot' : ''}>
            {text.length}/{COMMENT_TEXT_MAX_LEN}
          </span>
        </div>
        <button
          type="submit"
          className="btn-hot inline-flex items-center gap-2 px-5 py-2.5 text-sm relative z-[2]"
        >
          <Send className="w-4 h-4" />
          Изпрати
        </button>
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
          {articleComments.map((comment, index) => (
            <motion.div
              key={comment.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.06 }}
              className="flex gap-3 p-3 border-l-3 border-l-zn-purple bg-white comic-panel"
            >
              <div className={`w-10 h-10 ${getAvatarColor(comment.author)} text-white flex items-center justify-center font-display font-black text-sm shrink-0 border-2 border-[#1C1428]`}>
                {(comment.author || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-display font-black text-sm text-zn-text uppercase tracking-wider">{comment.author}</span>
                  <span className="text-[10px] font-display text-zn-text-muted uppercase tracking-wider">{comment.date}</span>
                </div>
                <p className="font-sans text-sm text-zn-text leading-relaxed">{comment.text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
