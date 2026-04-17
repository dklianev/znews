import { useEffect, useMemo, useRef, useState } from 'react';
import { useAdminData, useArticlesData, useSessionData, useTaxonomyData } from '../../context/DataContext';
import { Plus, Pencil, Trash2, X, Save, AlertTriangle, Search, Phone, Mail } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import AdminImageField from '../../components/admin/AdminImageField';
import { useToast } from '../../components/admin/Toast';
import { useConfirm } from '../../components/admin/ConfirmDialog';
import useUnsavedChangesGuard from '../../hooks/useUnsavedChangesGuard';
import { buildAdminSearchParams, readEnumSearchParam, readSearchParam } from '../../utils/adminSearchParams';

const BASE_ROLES = Object.freeze(['admin', 'editor', 'reporter', 'photographer', 'intern']);
const ROLE_LABELS = Object.freeze({
  admin: 'Администратор',
  editor: 'Редактор',
  reporter: 'Репортер',
  photographer: 'Фотограф',
  intern: 'Стажант',
});

const AVATARS = ['👨‍💼', '👩‍💻', '👨‍🎤', '👩‍🎓', '🕵️', '👮', '👨‍⚕️', '👩‍🍳', '🧑‍💻', '👑', '📸', '✍️'];

const emptyForm = {
  name: '',
  username: '',
  password: '',
  role: 'reporter',
  profession: '',
  avatar: '👤',
};

const EMPTY_USER_FIELD_ERRORS = Object.freeze({
  name: '',
  username: '',
  password: '',
  role: '',
});

function normalizeUserFieldErrors(payload) {
  const source = payload?.fieldErrors && typeof payload.fieldErrors === 'object'
    ? payload.fieldErrors
    : null;

  if (!source) return EMPTY_USER_FIELD_ERRORS;

  return {
    name: typeof source.name === 'string' ? source.name : '',
    username: typeof source.username === 'string' ? source.username : '',
    password: typeof source.password === 'string' ? source.password : '',
    role: typeof source.role === 'string' ? source.role : '',
  };
}

function validateUserForm(form, isNew) {
  const nextErrors = { ...EMPTY_USER_FIELD_ERRORS };
  const normalizedName = String(form.name || '').trim();
  const normalizedUsername = String(form.username || '').trim();
  const password = typeof form.password === 'string' ? form.password : '';
  const role = String(form.role || '').trim();

  if (!normalizedName) nextErrors.name = 'Името е задължително.';
  if (!normalizedUsername) nextErrors.username = 'Потребителското име е задължително.';
  if (!role) nextErrors.role = 'Ролята е задължителна.';

  if (isNew && password.length < 8) {
    nextErrors.password = 'Паролата трябва да е поне 8 символа.';
  } else if (!isNew && password.length > 0 && password.length < 8) {
    nextErrors.password = 'Новата парола трябва да е поне 8 символа.';
  }

  return nextErrors;
}

function getFirstUserErrorField(fieldErrors) {
  if (fieldErrors.name) return 'name';
  if (fieldErrors.username) return 'username';
  if (fieldErrors.password) return 'password';
  if (fieldErrors.role) return 'role';
  return '';
}

function serializeUserEditorState(form) {
  return JSON.stringify({
    name: String(form?.name || ''),
    username: String(form?.username || ''),
    password: String(form?.password || ''),
    role: String(form?.role || ''),
    profession: String(form?.profession || ''),
    avatar: String(form?.avatar || ''),
  });
}

function serializeAuthorEditorState(form) {
  return JSON.stringify({
    name: String(form?.name || ''),
    avatar: String(form?.avatar || ''),
    avatarImage: String(form?.avatarImage || ''),
    avatarImageMeta: form?.avatarImageMeta || null,
    role: String(form?.role || ''),
    bio: String(form?.bio || ''),
    phone: String(form?.phone || ''),
    email: String(form?.email || ''),
  });
}

export default function ManageProfiles() {
  const { authors, addAuthor, updateAuthor, deleteAuthor } = useTaxonomyData();
  const { articles } = useArticlesData();
  const { users, ensureUsersLoaded, addUser, updateUser, deleteUser, permissions, createRole } = useAdminData();
  const { session } = useSessionData();
  const canManageUsers = session?.role === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [newRoleKey, setNewRoleKey] = useState('');
  const [newRoleError, setNewRoleError] = useState('');
  const [creatingRole, setCreatingRole] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [userFormError, setUserFormError] = useState('');
  const [userFieldErrors, setUserFieldErrors] = useState(EMPTY_USER_FIELD_ERRORS);
  const toast = useToast();
  const confirm = useConfirm();
  const tab = readEnumSearchParam(searchParams, 'tab', ['users', 'authors'], 'users');
  const searchQuery = readSearchParam(searchParams, 'q', '');
  const nameRef = useRef(null);
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const roleRef = useRef(null);
  const initialUserFormRef = useRef(serializeUserEditorState(emptyForm));
  const initialAuthorFormRef = useRef(serializeAuthorEditorState({ name: '', avatar: '👤', avatarImage: '', avatarImageMeta: null, role: '', bio: '', phone: '', email: '' }));

  useEffect(() => {
    if (tab !== 'users') return;
    void ensureUsersLoaded();
  }, [tab, ensureUsersLoaded]);

  const setListSearchParams = (updates) => {
    setSearchParams(
      (current) => buildAdminSearchParams(current, updates),
      { replace: true },
    );
  };

  const isValidRoleKey = (role) => /^[a-z][a-z0-9_-]{1,31}$/.test(role);

  const roleOptions = useMemo(() => {
    const permsRoles = Array.isArray(permissions)
      ? permissions.map((permission) => permission?.role).filter(Boolean)
      : [];
    const extraRoles = [...new Set(permsRoles.filter((role) => !BASE_ROLES.includes(role)))]
      .sort((a, b) => a.localeCompare(b));
    return [...BASE_ROLES, ...extraRoles].map((value) => ({
      value,
      label: ROLE_LABELS[value] || value,
    }));
  }, [permissions]);

  const [authorForm, setAuthorForm] = useState({ name: '', avatar: '👤', avatarImage: '', avatarImageMeta: null, role: '', bio: '', phone: '', email: '' });
  const [editingAuthor, setEditingAuthor] = useState(null);
  const isUserEditorDirty = useMemo(
    () => Boolean(editing) && serializeUserEditorState(form) !== initialUserFormRef.current,
    [editing, form],
  );
  const isAuthorEditorDirty = useMemo(
    () => Boolean(editingAuthor) && serializeAuthorEditorState(authorForm) !== initialAuthorFormRef.current,
    [authorForm, editingAuthor],
  );
  const { confirmDiscardChanges } = useUnsavedChangesGuard({
    isDirty: isUserEditorDirty || isAuthorEditorDirty,
    confirm,
  });

  const focusUserField = (field) => {
    if (field === 'name') nameRef.current?.focus();
    if (field === 'username') usernameRef.current?.focus();
    if (field === 'password') passwordRef.current?.focus();
    if (field === 'role') roleRef.current?.focus();
  };

  const clearUserFieldError = (field) => {
    setUserFieldErrors((prev) => {
      if (!prev[field]) return prev;
      return { ...prev, [field]: '' };
    });
  };

  const resetUserEditor = () => {
    setEditing(null);
    setForm(emptyForm);
    initialUserFormRef.current = serializeUserEditorState(emptyForm);
    setUserFormError('');
    setUserFieldErrors(EMPTY_USER_FIELD_ERRORS);
    setNewRoleError('');
    setNewRoleKey('');
  };

  const openCreateUser = async () => {
    const canProceed = await confirmDiscardChanges();
    if (!canProceed) return;
    setEditing('new');
    setForm(emptyForm);
    initialUserFormRef.current = serializeUserEditorState(emptyForm);
    setUserFormError('');
    setUserFieldErrors(EMPTY_USER_FIELD_ERRORS);
    setNewRoleError('');
    setNewRoleKey('');
  };

  const openEditUser = async (user) => {
    const canProceed = await confirmDiscardChanges();
    if (!canProceed) return;
    const nextForm = {
      name: user.name || '',
      username: user.username || '',
      password: '',
      role: user.role || 'reporter',
      profession: user.profession || '',
      avatar: user.avatar || '👤',
    };
    setEditing(user.id);
    setForm(nextForm);
    initialUserFormRef.current = serializeUserEditorState(nextForm);
    setUserFormError('');
    setUserFieldErrors(EMPTY_USER_FIELD_ERRORS);
    setNewRoleError('');
    setNewRoleKey('');
  };

  const handleSaveUser = async () => {
    const isNew = editing === 'new';
    const nextFieldErrors = validateUserForm(form, isNew);
    const firstField = getFirstUserErrorField(nextFieldErrors);

    if (firstField) {
      setUserFieldErrors(nextFieldErrors);
      setUserFormError('Поправи маркираните полета и опитай отново.');
      focusUserField(firstField);
      return;
    }

    setSavingUser(true);
    setUserFormError('');
    setUserFieldErrors(EMPTY_USER_FIELD_ERRORS);

    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        username: form.username.trim(),
        role: form.role.trim(),
        profession: form.profession.trim(),
        password: form.password,
      };

      if (!payload.password && !isNew) {
        delete payload.password;
      }

      if (isNew) {
        await addUser(payload);
        toast.success('Потребителят е създаден');
      } else {
        await updateUser(editing, payload);
        toast.success('Потребителят е обновен');
      }

      resetUserEditor();
    } catch (error) {
      const payloadFieldErrors = normalizeUserFieldErrors(error?.payload);
      const message = payloadFieldErrors.name
        || payloadFieldErrors.username
        || payloadFieldErrors.password
        || payloadFieldErrors.role
        || error?.message
        || 'Грешка при запис.';

      setUserFieldErrors(payloadFieldErrors);
      setUserFormError(message);
      focusUserField(getFirstUserErrorField(payloadFieldErrors));
      toast.error('Грешка при запис');
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (id) => {
    if (id === 1) return toast.warning('Не можеш да изтриеш главния админ!');
    const confirmed = await confirm({
      title: 'Изтриване на потребител',
      message: 'Потребителят ще бъде изтрит безвъзвратно.',
      confirmLabel: 'Изтрий',
      variant: 'danger',
    });
    if (!confirmed) return;
    await deleteUser(id);
    toast.success('Потребителят е изтрит');
  };

  const handleEnsureRole = async () => {
    const role = newRoleKey.trim().toLowerCase();
    if (!role) return;
    if (creatingRole) return;

    setNewRoleError('');

    if (role === 'admin' || BASE_ROLES.includes(role)) {
      setNewRoleError('Тази роля е системна. Избери име за нова роля.');
      return;
    }
    if (!isValidRoleKey(role)) {
      setNewRoleError('Невалидна роля. Ползвай само малки букви, цифри, "_" или "-".');
      return;
    }

    setCreatingRole(true);
    try {
      const ensured = await createRole(role);
      setForm((prev) => ({ ...prev, role: ensured.role }));
      clearUserFieldError('role');
      setUserFormError('');
      setNewRoleKey('');
    } catch (error) {
      setNewRoleError(error?.message || 'Грешка при създаване на роля');
    } finally {
      setCreatingRole(false);
    }
  };

  const resetAuthorEditor = () => {
    const nextForm = { name: '', avatar: '👤', avatarImage: '', avatarImageMeta: null, role: '', bio: '', phone: '', email: '' };
    setEditingAuthor(null);
    setAuthorForm(nextForm);
    initialAuthorFormRef.current = serializeAuthorEditorState(nextForm);
  };

  const openCreateAuthor = async () => {
    const canProceed = await confirmDiscardChanges();
    if (!canProceed) return;
    const nextForm = { name: '', avatar: '👤', avatarImage: '', avatarImageMeta: null, role: '', bio: '', phone: '', email: '' };
    setEditingAuthor('new');
    setAuthorForm(nextForm);
    initialAuthorFormRef.current = serializeAuthorEditorState(nextForm);
  };

  const openEditAuthor = async (author) => {
    const canProceed = await confirmDiscardChanges();
    if (!canProceed) return;
    const nextForm = {
      name: author.name || '',
      avatar: author.avatar || '👤',
      avatarImage: author.avatarImage || '',
      avatarImageMeta: author.avatarImageMeta || null,
      role: author.role || '',
      bio: author.bio || '',
      phone: author.phone || '',
      email: author.email || '',
    };
    setEditingAuthor(author.id);
    setAuthorForm(nextForm);
    initialAuthorFormRef.current = serializeAuthorEditorState(nextForm);
  };

  const handleSaveAuthor = async () => {
    if (!authorForm.name) return;
    if (editingAuthor === 'new') {
      await addAuthor(authorForm);
      toast.success('Авторът е създаден');
    } else {
      await updateAuthor(editingAuthor, authorForm);
      toast.success('Авторът е обновен');
    }
    resetAuthorEditor();
  };

  const handleDeleteAuthor = async (id) => {
    const confirmed = await confirm({
      title: 'Изтриване на автор',
      message: 'Авторът ще бъде изтрит безвъзвратно.',
      confirmLabel: 'Изтрий',
      variant: 'danger',
    });
    if (!confirmed) return;
    await deleteAuthor(id);
    toast.success('Авторът е изтрит');
  };

  const handleTabChange = async (nextTab) => {
    if (nextTab === tab) return;
    const canProceed = await confirmDiscardChanges();
    if (!canProceed) return;
    setListSearchParams({ tab: nextTab, q: searchQuery });
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const filteredAuthors = useMemo(() => {
    if (!searchQuery.trim()) return authors;
    const q = searchQuery.trim().toLowerCase();
    return authors.filter((a) =>
      (a.name || '').toLowerCase().includes(q) ||
      (a.role || '').toLowerCase().includes(q)
    );
  }, [authors, searchQuery]);

  const inputCls = 'w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple';
  const labelCls = 'block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-1';
  const userValidationEntries = Object.entries(userFieldErrors).filter(([, message]) => Boolean(message));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Профили</h1>
          <p className="text-sm font-sans text-gray-500 mt-1">Управление на потребители и автори</p>
        </div>
      </div>

      <div className="flex gap-0 mb-6 border-b border-gray-200">
        {[
          { id: 'users', label: 'Потребители (акаунти)' },
          { id: 'authors', label: 'Автори (репортери)' },
        ].map((currentTab) => (
          <button
            key={currentTab.id}
            onClick={() => void handleTabChange(currentTab.id)}
            className={`px-5 py-3 text-sm font-sans font-medium border-b-2 transition-colors ${
              tab === currentTab.id
                ? 'border-zn-purple text-zn-hot'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {currentTab.label}
          </button>
        ))}
      </div>

      <div className="mb-5 relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setListSearchParams({ tab, q: e.target.value })}
          placeholder={tab === 'users' ? 'Търси по име, username или роля...' : 'Търси по име или позиция...'}
          className="pl-9 pr-3 py-1.5 text-sm font-sans bg-white border border-gray-200 outline-none focus:border-zn-purple w-64"
        />
      </div>

      {tab === 'users' && (
        <>
          {canManageUsers ? (
            <button
              onClick={() => void openCreateUser()}
              className="mb-4 flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold hover:bg-zn-purple-dark transition-colors"
            >
              <Plus className="w-4 h-4" />
              Нов потребител
            </button>
          ) : null}

          {editing && canManageUsers ? (
            <div className="bg-white border border-gray-200 p-6 mb-6">
              <h3 className="font-sans font-semibold text-gray-900 mb-4">
                {editing === 'new' ? 'Нов потребител' : 'Редактирай потребител'}
              </h3>

              {(userFormError || userValidationEntries.length > 0) ? (
                <div className="mb-4 bg-red-50 border border-red-200 px-4 py-3 text-sm font-sans text-red-800 flex items-start gap-2" role="alert">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    {userFormError ? <p className="break-words">{userFormError}</p> : null}
                    {userValidationEntries.length > 0 ? (
                      <ul className="list-disc pl-4">
                        {userValidationEntries.map(([field, message]) => (
                          <li key={field}>
                            <button
                              type="button"
                              className="text-left underline decoration-dotted underline-offset-2"
                              onClick={() => focusUserField(field)}
                            >
                              {message}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Име</label>
                  <input
                    ref={nameRef}
                    className={`${inputCls} ${userFieldErrors.name ? '!border-red-400 bg-red-50/30' : ''}`}
                    value={form.name}
                    onChange={(event) => {
                      setForm({ ...form, name: event.target.value });
                      clearUserFieldError('name');
                      setUserFormError('');
                    }}
                    placeholder="Иван Иванов"
                    aria-invalid={userFieldErrors.name ? 'true' : 'false'}
                    aria-describedby={userFieldErrors.name ? 'user-name-error' : undefined}
                  />
                  {userFieldErrors.name ? <p id="user-name-error" className="mt-1 text-xs font-sans text-red-600">{userFieldErrors.name}</p> : null}
                </div>

                <div>
                  <label className={labelCls}>Потребителско име</label>
                  <input
                    ref={usernameRef}
                    className={`${inputCls} ${userFieldErrors.username ? '!border-red-400 bg-red-50/30' : ''}`}
                    value={form.username}
                    onChange={(event) => {
                      setForm({ ...form, username: event.target.value });
                      clearUserFieldError('username');
                      setUserFormError('');
                    }}
                    placeholder="ivan"
                    aria-invalid={userFieldErrors.username ? 'true' : 'false'}
                    aria-describedby={userFieldErrors.username ? 'user-username-error' : undefined}
                  />
                  {userFieldErrors.username ? <p id="user-username-error" className="mt-1 text-xs font-sans text-red-600">{userFieldErrors.username}</p> : null}
                </div>

                <div>
                  <label className={labelCls}>Парола</label>
                  <input
                    ref={passwordRef}
                    className={`${inputCls} ${userFieldErrors.password ? '!border-red-400 bg-red-50/30' : ''}`}
                    type="password"
                    value={form.password}
                    onChange={(event) => {
                      setForm({ ...form, password: event.target.value });
                      clearUserFieldError('password');
                      setUserFormError('');
                    }}
                    placeholder="••••••••"
                    aria-invalid={userFieldErrors.password ? 'true' : 'false'}
                    aria-describedby={userFieldErrors.password ? 'user-password-error' : undefined}
                  />
                  {userFieldErrors.password ? <p id="user-password-error" className="mt-1 text-xs font-sans text-red-600">{userFieldErrors.password}</p> : null}
                </div>

                <div>
                  <label className={labelCls}>Роля</label>
                  <select
                    ref={roleRef}
                    className={`${inputCls} ${userFieldErrors.role ? '!border-red-400 bg-red-50/30' : ''}`}
                    value={form.role}
                    onChange={(event) => {
                      setForm({ ...form, role: event.target.value });
                      clearUserFieldError('role');
                      setUserFormError('');
                    }}
                    aria-invalid={userFieldErrors.role ? 'true' : 'false'}
                    aria-describedby={userFieldErrors.role ? 'user-role-error' : undefined}
                  >
                    {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                  </select>
                  {userFieldErrors.role ? <p id="user-role-error" className="mt-1 text-xs font-sans text-red-600">{userFieldErrors.role}</p> : null}
                  <div className="mt-2">
                    <div className="flex gap-2">
                      <input
                        className={inputCls}
                        value={newRoleKey}
                        onChange={(event) => setNewRoleKey(event.target.value)}
                        placeholder="Нова роля (напр. moderator)"
                      />
                      <button
                        type="button"
                        onClick={handleEnsureRole}
                        disabled={creatingRole}
                        className="px-3 py-2 bg-gray-900 text-white text-xs font-sans font-semibold hover:bg-black transition-colors disabled:opacity-50"
                        title="Добави роля"
                      >
                        {creatingRole ? '...' : 'Добави'}
                      </button>
                    </div>
                    {newRoleError ? <p className="mt-1 text-xs font-sans text-red-600">{newRoleError}</p> : null}
                    <p className="mt-1 text-[10px] font-sans text-gray-400">
                      Ролята създава нов ред в „Права“, с изключени разрешения по подразбиране.
                    </p>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Професия</label>
                  <input
                    className={inputCls}
                    value={form.profession}
                    onChange={(event) => setForm({ ...form, profession: event.target.value })}
                    placeholder="Разследващ репортер"
                  />
                </div>

                <div>
                  <label className={labelCls}>Аватар</label>
                  <div className="flex flex-wrap gap-1.5">
                    {AVATARS.map((avatar) => (
                      <button
                        key={avatar}
                        type="button"
                        onClick={() => setForm({ ...form, avatar })}
                        className={`w-8 h-8 text-lg flex items-center justify-center border transition-colors ${
                          form.avatar === avatar ? 'border-zn-purple bg-zn-purple/10' : 'border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {avatar}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  onClick={handleSaveUser}
                  disabled={savingUser}
                  className="flex items-center gap-2 px-5 py-2 bg-zn-purple text-white text-sm font-sans font-semibold hover:bg-zn-purple-dark transition-colors disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {savingUser ? 'Запис...' : 'Запази'}
                </button>
                <button
                  onClick={() => void resetUserEditor()}
                  className="flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 text-sm font-sans hover:bg-gray-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Отказ
                </button>
              </div>
            </div>
          ) : null}

          <div className="bg-white border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Потребител</th>
                  <th className="text-left px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Username</th>
                  <th className="text-left px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Роля</th>
                  <th className="text-left px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Професия</th>
                  <th className="text-right px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{user.avatar || '👤'}</span>
                        <span className="text-sm font-sans font-medium text-gray-900">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-sans text-gray-500">{user.username}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-[10px] font-sans font-bold uppercase tracking-wider ${
                        user.role === 'admin' ? 'bg-zn-purple text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                      >
                        {roleOptions.find((role) => role.value === user.role)?.label || user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-sans text-gray-500">{user.profession || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canManageUsers ? (
                          <>
                            <button
                              onClick={() => void openEditUser(user)}
                              className="p-1.5 text-gray-400 hover:text-zn-hot transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {user.id !== 1 ? (
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-xs font-sans text-gray-300 px-1.5">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'authors' && (
        <>
          <button
            onClick={() => void openCreateAuthor()}
            className="mb-4 flex items-center gap-2 px-4 py-2 bg-zn-hot text-white text-sm font-sans font-semibold hover:bg-zn-hot transition-colors"
          >
            <Plus className="w-4 h-4" />
            Нов автор
          </button>

          {editingAuthor ? (
            <div className="bg-white border border-gray-200 p-6 mb-6">
              <h3 className="font-sans font-semibold text-gray-900 mb-4">
                {editingAuthor === 'new' ? 'Нов автор' : 'Редактирай автор'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Име</label>
                  <input
                    className={inputCls}
                    value={authorForm.name}
                    onChange={(event) => setAuthorForm({ ...authorForm, name: event.target.value })}
                    placeholder="Мария Георгиева"
                  />
                </div>
                <div>
                  <label className={labelCls}>Позиция</label>
                  <input
                    className={inputCls}
                    value={authorForm.role}
                    onChange={(event) => setAuthorForm({ ...authorForm, role: event.target.value })}
                    placeholder="Разследващ журналист"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className={labelCls}><Phone className="w-3.5 h-3.5 inline mr-1" />Телефон</label>
                  <input
                    className={inputCls}
                    value={authorForm.phone || ''}
                    onChange={(event) => setAuthorForm({ ...authorForm, phone: event.target.value })}
                    placeholder="+359 88 123 4567"
                  />
                </div>
                <div>
                  <label className={labelCls}><Mail className="w-3.5 h-3.5 inline mr-1" />Имейл</label>
                  <input
                    className={inputCls}
                    value={authorForm.email || ''}
                    onChange={(event) => setAuthorForm({ ...authorForm, email: event.target.value })}
                    placeholder="maria@znews.bg"
                    type="email"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className={labelCls}>Био</label>
                <textarea
                  className={inputCls + ' resize-y min-h-[60px]'}
                  value={authorForm.bio || ''}
                  onChange={(event) => setAuthorForm({ ...authorForm, bio: event.target.value })}
                  placeholder="Кратко описание на автора..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className={labelCls}>Аватар (емоджи)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {AVATARS.map((avatar) => (
                      <button
                        key={avatar}
                        type="button"
                        onClick={() => setAuthorForm({ ...authorForm, avatar })}
                        className={`w-8 h-8 text-lg flex items-center justify-center border transition-colors ${
                          authorForm.avatar === avatar ? 'border-zn-purple bg-zn-purple/10' : 'border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {avatar}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <AdminImageField
                    label="Снимка на автора"
                    value={authorForm.avatarImage || ''}
                    onChange={(val) => setAuthorForm({ ...authorForm, avatarImage: val })}
                    imageMeta={authorForm.avatarImageMeta}
                    onChangeMeta={(meta) => setAuthorForm({ ...authorForm, avatarImageMeta: meta })}
                    previewClassName="h-32"
                    helperText="Снимка от медийната библиотека (замества емоджи аватара)"
                    editorAspectPresets={[{ label: '1:1', value: 1 }]}
                    defaultEditorMode="focal"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={handleSaveAuthor} className="flex items-center gap-2 px-5 py-2 bg-zn-hot text-white text-sm font-sans font-semibold hover:bg-zn-hot transition-colors">
                  <Save className="w-4 h-4" /> Запази
                </button>
                <button onClick={() => void resetAuthorEditor()} className="flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 text-sm font-sans hover:bg-gray-50 transition-colors">
                  <X className="w-4 h-4" /> Отказ
                </button>
              </div>
            </div>
          ) : null}

          <div className="bg-white border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Автор</th>
                  <th className="text-left px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Позиция</th>
                  <th className="text-left px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Статии</th>
                  <th className="text-right px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuthors.map((author) => (
                  <tr key={author.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {author.avatarImage ? (
                          <img src={author.avatarImage} alt={author.name} className="w-8 h-8 rounded-full object-cover border border-gray-200" />
                        ) : (
                          <span className="text-lg">{author.avatar}</span>
                        )}
                        <span className="text-sm font-sans font-medium text-gray-900">{author.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-sans text-gray-500">{author.role}</td>
                    <td className="px-4 py-3 text-sm font-sans text-gray-500">{articles.filter((article) => article.authorId === author.id).length}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => void openEditAuthor(author)}
                          className="p-1.5 text-gray-400 hover:text-zn-hot transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAuthor(author.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
