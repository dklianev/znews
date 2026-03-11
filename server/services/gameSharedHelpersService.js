export function createGameSharedHelpers(deps) {
  const {
    GameDefinition,
    GamePuzzle,
    JWT_SECRET,
    SUPPORTED_GAME_SLUGS,
    SUPPORTED_GAME_TYPES,
    User,
    hasOwn,
    hasPermissionForSection,
    jwt,
    normalizeText,
    publicError,
  } = deps;

  function badRequest(message) {
    const error = new Error(message);
    error.status = 400;
    return error;
  }

  function statusAwarePublicError(error) {
    return error?.status && error.status < 500
      ? (error.message || 'Request failed')
      : publicError(error);
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function parseBooleanFlag(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    return fallback;
  }

  function toSafeInteger(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function sanitizeStringArray(values, maxLen = 120, options = {}) {
    const { uppercase = false } = options;
    if (!Array.isArray(values)) return [];
    return values
      .map((value) => normalizeText(String(value || ''), maxLen))
      .filter(Boolean)
      .map((value) => (uppercase ? value.toUpperCase() : value));
  }

  function getTodayGameDate() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Sofia',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const [{ value: year }, , { value: month }, , { value: day }] = formatter.formatToParts(new Date());
    return `${year}-${month}-${day}`;
  }

  function getPuzzleActiveUntilDate(puzzle) {
    const activeUntilDate = normalizeText(puzzle?.activeUntilDate, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(activeUntilDate || '')) return activeUntilDate;
    return normalizeText(puzzle?.puzzleDate, 10);
  }

  function buildActiveGamePuzzleDateExpr(date) {
    return {
      $and: [
        { $lte: ['$puzzleDate', date] },
        { $gte: [{ $ifNull: ['$activeUntilDate', '$puzzleDate'] }, date] },
      ],
    };
  }

  async function findActivePublishedGamePuzzle(gameSlug, date) {
    return GamePuzzle.findOne({
      gameSlug,
      status: 'published',
      $expr: buildActiveGamePuzzleDateExpr(date),
      $or: [
        { publishAt: { $exists: false } },
        { publishAt: null },
        { publishAt: { $lte: new Date() } },
      ],
    })
      .sort({ puzzleDate: -1, activeUntilDate: -1, publishAt: -1, id: -1 })
      .lean();
  }

  function stripPuzzleForPublic(puzzle) {
    const safePuzzle = { ...(puzzle || {}) };
    delete safePuzzle.editorNotes;
    delete safePuzzle.solution;
    return safePuzzle;
  }

  async function canManageGamesFromRequest(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return false;

    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findOne({ id: decoded.userId }).lean();
      if (!user) return false;
      if (user.role === 'admin') return true;
      return await hasPermissionForSection(user, 'games');
    } catch {
      return false;
    }
  }

  async function resolveGameAccess(req, rawSlug) {
    const slug = normalizeText(rawSlug, 64).toLowerCase();
    const canManageGames = await canManageGamesFromRequest(req);
    const game = await GameDefinition.findOne({ slug }).lean();

    return {
      slug,
      game,
      canManageGames,
      isPubliclyAvailable: Boolean(game?.active),
    };
  }

  function sanitizeGameDefinitionInput(input, existingGame = null) {
    if (!isPlainObject(input)) throw badRequest('Invalid game payload.');

    const slug = existingGame
      ? existingGame.slug
      : normalizeText(input.slug, 64).toLowerCase();
    const type = existingGame
      ? existingGame.type
      : normalizeText(input.type, 32).toLowerCase();
    const title = normalizeText(hasOwn(input, 'title') ? input.title : existingGame?.title, 120);
    const description = normalizeText(hasOwn(input, 'description') ? input.description : existingGame?.description, 500);
    const icon = normalizeText(hasOwn(input, 'icon') ? input.icon : existingGame?.icon, 64);
    const theme = normalizeText(hasOwn(input, 'theme') ? input.theme : existingGame?.theme, 32);
    const active = hasOwn(input, 'active')
      ? parseBooleanFlag(input.active, true)
      : Boolean(existingGame?.active);
    const sortOrder = hasOwn(input, 'sortOrder')
      ? toSafeInteger(input.sortOrder, 0)
      : toSafeInteger(existingGame?.sortOrder, 0);

    if (!title) throw badRequest('Game title is required.');
    if (!SUPPORTED_GAME_SLUGS.has(slug)) throw badRequest('Unsupported game slug.');
    if (!SUPPORTED_GAME_TYPES.has(type)) throw badRequest('Unsupported game type.');
    if (slug !== type) throw badRequest('Game slug must match the supported game type.');

    if (existingGame) {
      if (hasOwn(input, 'slug') && normalizeText(input.slug, 64).toLowerCase() !== existingGame.slug) {
        throw badRequest('Game slug cannot be changed.');
      }
      if (hasOwn(input, 'type') && normalizeText(input.type, 32).toLowerCase() !== existingGame.type) {
        throw badRequest('Game type cannot be changed.');
      }
    }

    return {
      slug,
      title,
      type,
      description,
      icon,
      active,
      sortOrder,
      theme,
      updatedAt: new Date(),
    };
  }
  return {
    badRequest,
    findActivePublishedGamePuzzle,
    getPuzzleActiveUntilDate,
    getTodayGameDate,
    isPlainObject,
    parseBooleanFlag,
    resolveGameAccess,
    sanitizeGameDefinitionInput,
    sanitizeStringArray,
    statusAwarePublicError,
    stripPuzzleForPublic,
    toSafeInteger,
  };
}
