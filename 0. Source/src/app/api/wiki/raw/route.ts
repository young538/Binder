import { authenticated } from '@/lib/server/http';
import { WikiService } from '@/lib/server/wiki/service';

export const POST = authenticated(async (session, request: Request) => {
  const service = new WikiService(session.userId, session.username);
  const contentType = (request.headers.get('content-type') ?? '').toLowerCase();

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return Response.json({ error: '업로드할 파일이 필요합니다.' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = service.uploadRawFile({ fileName: file.name, buffer });
    return Response.json(saved, { status: 201 });
  }

  let body: {
    title?: string;
    content?: string;
    sourceUrl?: string;
    tags?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '올바른 JSON 요청이 필요합니다.' }, { status: 400 });
  }

  const saved = service.captureRawNote({
    title: typeof body.title === 'string' ? body.title : '',
    content: typeof body.content === 'string' ? body.content : '',
    sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : undefined,
    tags: Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === 'string') : undefined,
  });
  return Response.json(saved, { status: 201 });
});
