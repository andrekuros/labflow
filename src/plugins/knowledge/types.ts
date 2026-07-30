export type KnowledgeSearchResult = {
  articles: { id: string; title: string; snippet: string; score: number; adminOnly?: boolean }[];
};
