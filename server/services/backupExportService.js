export function createBackupExportService(deps) {
  const {
    Ad,
    Article,
    ArticleRevision,
    Author,
    Breaking,
    Category,
    Comment,
    CommentReaction,
    Court,
    DEFAULT_HERO_SETTINGS,
    DEFAULT_SITE_SETTINGS,
    Event,
    Gallery,
    GameDefinition,
    GamePuzzle,
    HeroSettings,
    Job,
    Permission,
    Poll,
    SettingsRevision,
    SiteSettings,
    User,
    Wanted,
    cleanExportItem,
    streamJsonArray,
    writeJsonChunk,
  } = deps;

  function createExportCursor(Model, sort = null) {
    let query = Model.find();
    if (sort && typeof sort === 'object') {
      query = query.sort(sort);
    }
    return query.cursor();
  }

  async function streamBackupExport(res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=znews-backup-' + Date.now() + '.json');

    const sections = [
      { key: 'articles', cursor: createExportCursor(Article) },
      { key: 'articleRevisions', cursor: createExportCursor(ArticleRevision, { createdAt: -1 }) },
      { key: 'settingsRevisions', cursor: createExportCursor(SettingsRevision, { createdAt: -1 }) },
      { key: 'authors', cursor: createExportCursor(Author) },
      { key: 'categories', cursor: createExportCursor(Category) },
      { key: 'ads', cursor: createExportCursor(Ad) },
      { key: 'users', cursor: createExportCursor(User) },
      { key: 'wanted', cursor: createExportCursor(Wanted) },
      { key: 'jobs', cursor: createExportCursor(Job) },
      { key: 'court', cursor: createExportCursor(Court) },
      { key: 'events', cursor: createExportCursor(Event) },
      { key: 'polls', cursor: createExportCursor(Poll) },
      { key: 'comments', cursor: createExportCursor(Comment) },
      { key: 'commentReactions', cursor: createExportCursor(CommentReaction) },
      { key: 'gallery', cursor: createExportCursor(Gallery) },
      { key: 'games', cursor: createExportCursor(GameDefinition) },
      { key: 'gamePuzzles', cursor: createExportCursor(GamePuzzle) },
      { key: 'permissions', cursor: createExportCursor(Permission) },
    ];

    await writeJsonChunk(res, '{');
    await writeJsonChunk(res, '"exportDate":' + JSON.stringify(new Date().toISOString()));

    const breaking = (await Breaking.findOne().lean())?.items || [];
    await writeJsonChunk(res, ',"breaking":' + JSON.stringify(breaking));

    for (const section of sections) {
      await writeJsonChunk(res, ',"' + section.key + '":[');
      await streamJsonArray(res, section.cursor, cleanExportItem);
      await writeJsonChunk(res, ']');
    }

    const heroSettings = cleanExportItem(await HeroSettings.findOne({ key: 'main' }).lean()) || { key: 'main', ...DEFAULT_HERO_SETTINGS };
    const siteSettings = cleanExportItem(await SiteSettings.findOne({ key: 'main' }).lean()) || { key: 'main', ...DEFAULT_SITE_SETTINGS };
    await writeJsonChunk(res, ',"heroSettings":' + JSON.stringify(heroSettings));
    await writeJsonChunk(res, ',"siteSettings":' + JSON.stringify(siteSettings));
    await writeJsonChunk(res, '}');
    res.end();
  }

  return {
    createExportCursor,
    streamBackupExport,
  };
}
