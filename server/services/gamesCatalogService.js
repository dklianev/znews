export function createGamesCatalogService({
  GameDefinition,
  stripDocumentMetadata,
}) {
  async function listPublicGames() {
    const items = await GameDefinition.find({ active: true }).sort('sortOrder').lean();
    return items.map((item) => stripDocumentMetadata(item));
  }

  return {
    listPublicGames,
  };
}
