import { http } from './http';

export interface Me {
  userId: string;
  username: string;
}

export const getMe = async (): Promise<Me> => http.get<Me>('/api/auth/me');

export const logout = async (): Promise<void> => {
  await http.post<{ ok: boolean }>('/api/auth/logout');
};

export const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  await http.post<{ ok: boolean }>('/api/auth/password', { currentPassword, newPassword });
};
