export interface User {
  id: number;
  nome?: string;
  name: string;
  email?: string;
  empresa_id?: number;
  is_master: boolean;
  pdv: boolean;
  permissions: string[];
  [key: string]: any;
}

export interface AuthSession {
  token: string;
  user: User;
}
