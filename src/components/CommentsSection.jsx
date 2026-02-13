import { useState } from 'react';
import { MessageCircle, Send, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useData } from '../context/DataContext';

const AVATAR_COLORS = ['bg-zn-purple', 'bg-zn-hot', 'bg-blue-700', 'bg-emerald-700', 'bg-amber-700', 'bg-violet-700', 'bg-rose-700', 'bg-teal-700'];

function getAvatarColor(name) {
  const charCode = (name || 'A').charCodeAt(0);
  return AVATAR_COLORS[charCode % AVATAR_COLORS.length];
}

export default function CommentsSection({ articleId }) {
  const { comments, addComment } = useData();
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const articleComments = comments
    .filter(c => c.articleId === articleId && c.approved)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !text.trim()) return;
    try {
      await addComment({
        articleId,
        author: name.trim(),
        avatar: name.trim().charAt(0).toUpperCase(),
        text: text.trim(),
        date: new Date().toISOString().slice(0, 10),
        approved: false, // requires admin approval
      });
      setName('');
      setText('');
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 5000);
    } catch {
      setError('Коментарът не можа да бъде изпратен. Опитайте отново.');
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
        {submitted && (
          <div className="mb-3 p-3 bg-emerald-50 border-2 border-emerald-300 text-emerald-700 text-sm font-display font-bold uppercase tracking-wider relative z-[2]">
            Коментарът е изпратен и очаква одобрение.
          </div>
        )}
        {error && (
          <div className="mb-3 p-3 bg-red-50 border-2 border-red-300 text-red-700 text-sm font-display font-bold uppercase tracking-wider relative z-[2]">
            {error}
          </div>
        )}
        <div className="flex gap-3 mb-3 relative z-[2]">
          <div className="relative flex-1">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zn-text-muted" />
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Твоето име..."
              required
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
          className="w-full px-3 py-2.5 bg-white border-2 border-[#1C1428]/20 text-zn-text placeholder-zn-text-dim font-sans text-sm outline-none focus:border-zn-purple resize-none mb-3 relative z-[2]"
        />
        <button
          type="submit"
          className="btn-hot inline-flex items-center gap-2 px-5 py-2.5 text-sm relative z-[2]"
        >
          <Send className="w-4 h-4" />
          Изпрати
        </button>
      </form>

      {/* Comments list */}
      {articleComments.length === 0 ? (
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
