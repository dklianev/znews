import { useMemo, useOptimistic, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePublicData } from '../../context/DataContext';
import { Check, Trash2, XCircle, Eye, AlertTriangle } from 'lucide-react';
import { useToast } from '../../components/admin/Toast';
import { useConfirm } from '../../components/admin/ConfirmDialog';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminFilterBar from '../../components/admin/AdminFilterBar';
import AdminSearchField from '../../components/admin/AdminSearchField';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { buildAdminSearchParams, readEnumSearchParam, readSearchParam } from '../../utils/adminSearchParams';

function collectCommentThreadIds(comments, rootId) {
  const list = Array.isArray(comments) ? comments : [];
  const numericRootId = Number.parseInt(String(rootId), 10);
  const stack = Number.isInteger(numericRootId) ? [numericRootId] : [];
  const ids = new Set();

  while (stack.length > 0) {
    const currentId = stack.pop();
    if (!Number.isInteger(currentId) || ids.has(currentId)) continue;
    ids.add(currentId);

    list.forEach((comment) => {
      const commentId = Number.parseInt(comment?.id, 10);
      const parentId = Number.parseInt(comment?.parentId, 10);
      if (Number.isInteger(commentId) && parentId === currentId && !ids.has(commentId)) {
        stack.push(commentId);
      }
    });
  }

  return ids;
}

export default function ManageComments() {
  const { comments, articles, updateComment, deleteComment } = usePublicData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const toast = useToast();
  const confirm = useConfirm();
  const filter = readEnumSearchParam(searchParams, 'status', ['all', 'pending', 'approved'], 'all');
  const searchQuery = readSearchParam(searchParams, 'q', '');
  const [optimisticComments, applyCommentMutation] = useOptimistic(
    comments,
    (currentComments, mutation) => {
      if (mutation?.type === 'reset') {
        return Array.isArray(mutation.comments) ? mutation.comments : [];
      }

      const list = Array.isArray(currentComments) ? currentComments : [];
      const numericId = Number.parseInt(String(mutation?.id), 10);
      if (!Number.isInteger(numericId)) return list;

      if (mutation.type === 'delete') {
        const threadIds = collectCommentThreadIds(list, numericId);
        return list.filter((comment) => !threadIds.has(Number.parseInt(comment?.id, 10)));
      }

      if (mutation.type === 'approval') {
        const nextApproved = mutation.approved === true;
        const hiddenThreadIds = nextApproved ? null : collectCommentThreadIds(list, numericId);

        return list.map((comment) => {
          const commentId = Number.parseInt(comment?.id, 10);
          if (!Number.isInteger(commentId)) return comment;
          if (commentId === numericId) return { ...comment, approved: nextApproved };
          if (!nextApproved && hiddenThreadIds?.has(commentId)) return { ...comment, approved: false };
          return comment;
        });
      }

      return list;
    },
  );

  const filteredComments = useMemo(() => {
    let result = optimisticComments;
    if (filter === 'pending') result = result.filter((c) => !c.approved);
    else if (filter === 'approved') result = result.filter((c) => c.approved);

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((c) =>
        (c.author || '').toLowerCase().includes(q) ||
        (c.text || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [filter, optimisticComments, searchQuery]);

  const sortedComments = useMemo(
    () => [...filteredComments].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [filteredComments],
  );
  const pendingCount = useMemo(
    () => optimisticComments.filter((comment) => !comment.approved).length,
    [optimisticComments],
  );
  const approvedCount = useMemo(
    () => optimisticComments.filter((comment) => comment.approved).length,
    [optimisticComments],
  );
  const commentsById = useMemo(
    () => new Map(optimisticComments.map((comment) => [Number(comment.id), comment])),
    [optimisticComments],
  );

  const getArticleTitle = (id) => articles.find((article) => article.id === id)?.title || `Статия #${id}`;
  const getParentLabel = (parentId) => {
    const parent = commentsById.get(Number(parentId));
    if (!parent) return `#${parentId}`;
    return `${parent.author || 'Анонимен'} (#${parent.id})`;
  };

  const isCommentBusy = (id) => busyId === Number.parseInt(String(id), 10);

  const resetOptimisticComments = () => {
    applyCommentMutation({ type: 'reset', comments });
  };

  const runOptimisticApproval = async (id, approved) => {
    const numericId = Number.parseInt(String(id), 10);
    if (!Number.isInteger(numericId)) return;

    setBusyId(numericId);
    setError('');
    applyCommentMutation({ type: 'approval', id: numericId, approved });

    try {
      await updateComment(numericId, { approved });
      toast.success(approved ? 'Коментарът е одобрен' : 'Коментарът е скрит');
    } catch (e) {
      resetOptimisticComments();
      setError(e?.message || (approved ? 'Грешка при одобрение' : 'Грешка при скриване'));
      toast.error(approved ? 'Грешка при одобрение' : 'Грешка при скриване');
    } finally {
      setBusyId(null);
    }
  };

  const runOptimisticDelete = async (id) => {
    const numericId = Number.parseInt(String(id), 10);
    if (!Number.isInteger(numericId)) return;

    const confirmed = await confirm({
      title: 'Изтриване на коментар',
      message: 'Коментарът и всички отговори към него ще бъдат изтрити безвъзвратно.',
      confirmLabel: 'Изтрий',
      variant: 'danger',
    });
    if (!confirmed) return;

    setBusyId(numericId);
    setError('');
    applyCommentMutation({ type: 'delete', id: numericId });

    try {
      await deleteComment(numericId);
      toast.success('Коментарът е изтрит');
    } catch (e) {
      resetOptimisticComments();
      setError(e?.message || 'Грешка при изтриване');
      toast.error('Грешка при изтриване');
    } finally {
      setBusyId(null);
    }
  };

  const setListSearchParams = (updates) => {
    setSearchParams(
      (current) => buildAdminSearchParams(current, updates),
      { replace: true },
    );
  };

  const filterBtn = (value, label, count) => (
    <button
      type="button"
      onClick={() => setListSearchParams({ status: value, q: searchQuery })}
      className={`px-3 py-1.5 text-xs font-sans font-semibold uppercase tracking-wider border transition-colors ${filter === value
        ? 'bg-zn-hot text-white border-zn-hot'
        : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700'
        }`}
    >
      {label} ({count})
    </button>
  );

  return (
    <div className="p-8">
      <AdminPageHeader
        title="Коментари"
        description="Управление на потребителски коментари"
        meta={pendingCount > 0 ? (
          <span className="inline-flex px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
            {pendingCount} чакащи
          </span>
        ) : null}
      />

      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 px-4 py-3 text-sm font-sans text-red-800 flex items-start gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      <AdminFilterBar>
        {filterBtn('all', 'Всички', optimisticComments.length)}
        {filterBtn('pending', 'Чакащи', pendingCount)}
        {filterBtn('approved', 'Одобрени', approvedCount)}

        <AdminSearchField
          value={searchQuery}
          onChange={(event) => setListSearchParams({ status: filter, q: event.target.value })}
          placeholder="Търси по автор или текст..."
          ariaLabel="Търси коментар по автор или текст"
          className="ml-auto min-w-[260px]"
          inputClassName="py-1.5"
        />
      </AdminFilterBar>

      <div className="space-y-2">
        {sortedComments.map((comment) => {
          const busy = isCommentBusy(comment.id);
          return (
            <div
              key={comment.id}
              className={`bg-white border p-4 flex items-start gap-4 group ${comment.approved ? 'border-gray-200' : 'border-amber-300 bg-amber-50/30'
                }`}
              aria-busy={busy}
            >
              <div className="text-2xl shrink-0">{comment.avatar}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-sans font-semibold text-sm text-gray-900">{comment.author}</span>
                  <span className="text-[10px] font-sans text-gray-400">{comment.date}</span>
                  {!comment.approved && (
                    <span className="px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase bg-amber-100 text-amber-700">За преглед</span>
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
                      Отговор на {getParentLabel(comment.parentId)}
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
              <div className={`flex items-center gap-1 shrink-0 transition-opacity ${busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                {!comment.approved && (
                  <button
                    type="button"
                    onClick={() => void runOptimisticApproval(comment.id, true)}
                    disabled={busy}
                    className="p-1.5 text-gray-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
                    title="Одобри"
                    aria-label="Одобри коментар"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                {comment.approved && (
                  <button
                    type="button"
                    onClick={() => void runOptimisticApproval(comment.id, false)}
                    disabled={busy}
                    className="p-1.5 text-gray-400 hover:text-amber-600 transition-colors disabled:opacity-50"
                    title="Скрий"
                    aria-label="Скрий коментар"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
                <a href={`/article/${comment.articleId}`} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-zn-hot transition-colors" title="Виж статията" aria-label="Виж статията">
                  <Eye className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => void runOptimisticDelete(comment.id)}
                  disabled={busy}
                  className="p-1.5 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                  title="Изтрий"
                  aria-label="Изтрий коментар"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
        {sortedComments.length === 0 && (
          <AdminEmptyState
            title="Няма коментари"
            description={searchQuery.trim()
              ? 'Няма коментари, които да съвпадат с текущото търсене.'
              : filter === 'all'
                ? 'Все още няма постъпили коментари.'
                : 'Няма коментари в избрания филтър.'}
          />
        )}
      </div>
    </div>
  );
}
