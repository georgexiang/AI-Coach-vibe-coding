export interface SystemEnum {
  id: string;
  category: string;
  value: string;
  label_en: string;
  label_zh: string;
  sort_order: number;
  is_active: boolean;
}

export interface SystemEnumCreate {
  category: string;
  value: string;
  label_en: string;
  label_zh?: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface SystemEnumUpdate {
  label_en?: string;
  label_zh?: string;
  sort_order?: number;
  is_active?: boolean;
}
