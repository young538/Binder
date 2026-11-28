import type { WikiIndexResponse, WikiPageDetail, WikiRawFile } from '../wiki';
import { notifyMutation } from './events';
import { http } from './http';

export const getWikiIndex = (): Promise<WikiIndexResponse> =>
  http.get<WikiIndexResponse>('/api/wiki');

export const getWikiPage = (path: string): Promise<WikiPageDetail> =>
  http.get<WikiPageDetail>(`/api/wiki/page?path=${encodeURIComponent(path)}`);

export const captureWikiRawNote = async (data: {
  title: string;
  content: string;
  sourceUrl?: string;
  tags?: string[];
}): Promise<WikiRawFile> => {
  const row = await http.post<WikiRawFile>('/api/wiki/raw', data);
  notifyMutation('wiki');
  return row;
};

export const uploadWikiRawFile = async (file: File): Promise<WikiRawFile> => {
  const form = new FormData();
  form.set('file', file);
  const res = await fetch('/api/wiki/raw', {
    method: 'POST',
    body: form,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : '파일 업로드에 실패했습니다.');
  }
  notifyMutation('wiki');
  return payload as WikiRawFile;
};
