export type ProjectFileLink = {
  targetType: string;
  targetId: string;
  label: string;
};

export type ProjectFileRow = {
  id: string;
  title: string;
  kind: string;
  fileName: string | null;
  externalFolder: string | null;
  externalSource: string | null;
  updatedAt: string;
  links: ProjectFileLink[];
};
