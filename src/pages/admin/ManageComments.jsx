import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { MessageCircle, Check, Trash2, XCircle, Eye, AlertTriangle } from 'lucide-react';
import { useToast } from '../../components/admin/Toast';

export default function ManageComments() {
  const { comments, articles, updateComment, deleteComment } = useData();
  const [filter, setFilter] = useState('all'); // all | pending | approved
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const toast = useToast();

  const filtered = filter === 'all' ? comments
    : filter === 'pending' ? comments.filter(c => !c.approved)
      : comments.filter(c => c.approved);

  const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));
  const pendingCount = comments.filter(c => !c.approved).length;
  const commentsById = new Map(comments.map(comment => [Number(comment.id), comment]));

  const getArticleTitle = (id) => articles.find(a => a.id === id)?.title || `Статия #${id}`;
  const getParentLabel = (parentId) => {
    const parent = commentsById.get(Number(parentId));
    if (!parent) return `#${parentId}`;
    return `${parent.author || 'Коментар'} (#${parent.id})`;
  };

  const handleApprove = async (id) => {
    setBusyId(id);
    setError('');
    try {
      await updateComment(id, { approved: true });
      toast.success('Коментарът е одобрен');
    } catch (e) {
      setError(e?.message || 'Грешка при одобрение');
      toast.error('Грешка при одобрение');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id) => {
    setBusyId(id);
    setError('');
    try {
      await updateComment(id, { approved: false });
      toast.success('Коментарът е скрит');
    } catch (e) {
      setError(e?.message || 'Грешка при скриване');
      toast.error('Грешка при скриване');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Изтрий коментара?')) return;
    setBusyId(id);
    setError('');
    try {
      await deleteComment(id);
      toast.success('Коментарът е изтрит');
    } catch (e) {
      setError(e?.message || 'Грешка при изтриване');
      toast.error('Грешка при изтриване');
    } finally {
      setBusyId(null);
    }
  };

  const filterBtn = (value, label, count) => (
    <button
      onClick={() => setFilter(value)}
      className={`px-3 py-1.5 text-xs font-sans font-semibold uppercase tracking-wider border transition-colors ${filter === value ? 'bg-zn-hot text-white border-zn-hot' : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700'
        }`}
    >
      {label} ({count})
    </button>
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Коментари</h1>
          <p className="text-sm font-sans text-gray-500 mt-1">
            Модерация на потребителски коментари
            {pendingCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                {pendingCount} чакащи
              </span>
            )}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 px-4 py-3 text-sm font-sans text-red-800 flex items-start gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {filterBtn('all', 'Всички', comments.length)}
        {filterBtn('pending', 'Чакащи', pendingCount)}
        {filterBtn('approved', 'Одобрени', comments.filter(c => c.approved).length)}
      </div>

      {/* Comments list */}
      <div className="space-y-2">
        {sorted.map(comment => (
          <div key={comment.id} className={`bg-white border p-4 flex items-start gap-4 group ${comment.approved ? 'border-gray-200' : 'border-amber-300 bg-amber-50/30'
            }`}>
            <div className="text-2xl shrink-0">{comment.avatar}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-sans font-semibold text-sm text-gray-900">{comment.author}</span>
                <span className="text-[10px] font-sans text-gray-400">{comment.date}</span>
                {!comment.approved && (
                  <span className="px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase bg-amber-100 text-amber-700">Чака одобрение</span>
                )}
                {comment.approved && (
                  <span className="px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase bg-emerald-100 text-emerald-700">Одобрен</span>
                )}
              </div>
              <p className="text-sm font-sans text-gray-700 mb-1">{comment.text}</p>
              <p className="text-[10px] font-sans text-gray-400">
                Към: <a href={`/article/${comment.articleId}`} target="_blank" rel="noopener noreferrer" className="text-zn-hot hover:underline">
                  {getArticleTitle(comment.articleId)}
                </a>
              </p>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                {Number.isInteger(Number(comment.parentId)) && (
                  <span className="px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase bg-sky-100 text-sky-700">
                    Отговор към {getParentLabel(comment.parentId)}
                  </span>
                )}
                <span className="px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase bg-gray-100 text-gray-600">
                  Like: {Math.max(0, Number.parseInt(comment.likes, 10) || 0)}
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase bg-gray-100 text-gray-600">
                  Dislike: {Math.max(0, Number.parseInt(comment.dislikes, 10) || 0)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              {!comment.approved && (
                <button onClick={() => handleApprove(comment.id)} disabled={busyId === comment.id} className="p-1.5 text-gray-400 hover:text-emerald-600 transition-colors disabled:opacity-50" title="Одобри">
                  <Check className="w-4 h-4" />
                </button>
              )}
              {comment.approved && (
                <button onClick={() => handleReject(comment.id)} disabled={busyId === comment.id} className="p-1.5 text-gray-400 hover:text-amber-600 transition-colors disabled:opacity-50" title="Скрий">
                  <XCircle className="w-4 h-4" />
                </button>
              )}
              <a href={`/article/${comment.articleId}`} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-zn-hot transition-colors" title="Виж статията">
                <Eye className="w-4 h-4" />
              </a>
              <button onClick={() => handleDelete(comment.id)} disabled={busyId === comment.id} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50" title="Изтрий">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="text-center py-12 text-sm font-sans text-gray-400">Няма коментари в тази категория</div>
        )}
      </div>
    </div>
  );
}
