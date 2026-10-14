/** Repository search contract — pure, importable from client components. */

import type { RecordAuthor } from "@/lib/repository/vocab";

export type RepositoryFacet = { value: string; label: string; count: number };

export type RepositorySearchFacets = {
  resourceType: RepositoryFacet[];
  status: RepositoryFacet[];
  year: RepositoryFacet[];
  collection: RepositoryFacet[];
  tag: RepositoryFacet[];
  subject: RepositoryFacet[];
  language: RepositoryFacet[];
  license: RepositoryFacet[];
  project: RepositoryFacet[];
};

export type RepositorySort = "relevance" | "recent" | "oldest" | "title" | "year" | "downloads";

export type RepositorySearchQuery = {
  q?: string;
  /** Includes every descendant collection. */
  collectionId?: string;
  resourceType?: string[];
  status?: string[];
  tag?: string[];
  subject?: string[];
  language?: string[];
  license?: string[];
  projectId?: string;
  submitterId?: string;
  yearFrom?: number;
  yearTo?: number;
  hasFiles?: boolean;
  sort?: RepositorySort;
  page?: number;
  pageSize?: number;
};

export type RepositoryRecordRow = {
  id: string;
  handle: string;
  title: string;
  subtitle: string | null;
  abstract: string;
  resourceType: string;
  resourceTypeLabel: string;
  authors: RecordAuthor[];
  authorsLabel: string;
  year: number | null;
  venue: string | null;
  publisher: string | null;
  doi: string | null;
  language: string;
  license: string | null;
  tags: string[];
  subjects: string[];
  status: string;
  visibility: string;
  version: number;
  collection: { id: string; name: string; slug: string; color: string } | null;
  project: { id: string; key: string; name: string; color: string } | null;
  submitter: { id: string; name: string } | null;
  fileCount: number;
  primaryFile: { id: string; fileName: string; mimeType: string; byteSize: number } | null;
  totalBytes: number;
  linkCount: number;
  viewCount: number;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
  /** Present only on semantic/keyword hits: the matching passage. */
  snippet?: string;
  score?: number;
};

export type RepositorySearchResult = {
  records: RepositoryRecordRow[];
  total: number;
  page: number;
  pageSize: number;
  facets: RepositorySearchFacets;
  /** True when the ranking came from the embedding index rather than keywords. */
  semantic: boolean;
};

export type RepositoryCollectionNode = {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  description: string;
  icon: string | null;
  color: string;
  visibility: string;
  order: number;
  recordCount: number;
  /** Includes descendants. */
  totalRecordCount: number;
  depth: number;
  children: RepositoryCollectionNode[];
};
