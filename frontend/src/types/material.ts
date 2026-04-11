export interface TrainingMaterial {
  id: string;
  name: string;
  product: string;
  therapeutic_area: string;
  tags: string;
  is_archived: boolean;
  current_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  versions?: MaterialVersion[];
}

export interface MaterialVersion {
  id: string;
  material_id: string;
  version_number: number;
  filename: string;
  file_size: number;
  content_type: string;
  download_url: string;
  is_active: boolean;
  created_at: string;
}

export interface MaterialCreate {
  name: string;
  product: string;
  therapeutic_area?: string;
  tags?: string;
}

export interface MaterialUpdate {
  name?: string;
  product?: string;
  therapeutic_area?: string;
  tags?: string;
}

export interface PaginatedMaterials {
  items: TrainingMaterial[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
