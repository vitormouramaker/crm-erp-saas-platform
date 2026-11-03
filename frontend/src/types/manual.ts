export type ManualArticleStatus = "draft" | "published" | "inactive";

export type ManualModule = {
  id: string;
  title: string;
  description: string;
  order: number;
  requiredPermissions?: string[];
};

export type ManualArticle = {
  id: string;
  moduleId: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  steps: string[];
  keywords: string[];
  relatedRoute?: string;
  requiredPermissions?: string[];
  minPlanId?: number;
  featured: boolean;
  order: number;
  status: ManualArticleStatus;
  updatedAt: string;
};

export type ManualArticleInput = Omit<ManualArticle, "id" | "updatedAt"> & {
  id?: string;
};
