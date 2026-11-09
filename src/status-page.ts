import type { DeletionState, StatusStore } from './deletion.js';

type Lang = 'en' | 'ar';

const text = {
  en: {
    title: 'Data deletion request',
    code: 'Confirmation code',
    states: {
      pending: ['In progress', 'Your request was received and the deletion is not finished yet.'],
      completed: ['Completed', 'Your data has been deleted.'],
      failed: ['Failed', 'The deletion did not finish. Please contact the app owner.'],
    },
    notFound: ['Not found', 'No deletion request matches this confirmation code.'],
    missing: ['Code missing', 'Open the link you received with the confirmation code.'],
  },
  ar: {
    title: 'طلب حذف البيانات',
    code: 'رمز التأكيد',
    states: {
      pending: ['قيد التنفيذ', 'تم استلام طلبك ولم يكتمل الحذف بعد.'],
      completed: ['اكتمل', 'تم حذف بياناتك.'],
      failed: ['فشل', 'لم يكتمل الحذف. يرجى التواصل مع صاحب التطبيق.'],
    },
    notFound: ['غير موجود', 'لا يوجد طلب حذف مطابق لرمز التأكيد هذا.'],
    missing: ['الرمز مفقود', 'افتح الرابط الذي وصلك مع رمز التأكيد.'],
  },
} as const;

const marks: Record<DeletionState | 'none', { color: string; symbol: string }> = {
  completed: { color: '#0E8A4B', symbol: '&#10003;' },
  pending: { color: '#F2A93B', symbol: '!' },
  failed: { color: '#F0574F', symbol: '&#10007;' },
  none: { color: '#F0574F', symbol: '?' },
};

export interface StatusPageOptions {
  /** The same store passed to the data deletion handler. */
  store: StatusStore;
  /** Name shown at the bottom of the page, for example your app or company name. */
  appName?: string;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

function pickLang(request: Request, param: string | null): Lang {
  if (param === 'en' || param === 'ar') return param;
  const header = request.headers.get('accept-language') ?? '';
  return /^\s*ar\b/i.test(header) ? 'ar' : 'en';
}

function page(
  lang: Lang,
  mark: keyof typeof marks,
  heading: string,
  message: string,
  code: string | null,
  appName: string | undefined,
  status: number,
): Response {
  const t = text[lang];
  const { color, symbol } = marks[mark];
  const other = lang === 'en' ? 'ar' : 'en';
  const html = `<!doctype html>
<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(t.title)}</title>
<style>
body{margin:0;background:#F6F5F1;color:#0C1116;font:16px/1.5 system-ui,sans-serif}
main{max-width:30rem;margin:12vh auto;padding:0 1.25rem}
.mark{display:inline-flex;width:2.5rem;height:2.5rem;border-radius:50%;align-items:center;justify-content:center;color:#0C1116;background:${color};font-weight:700}
h1{font-size:1.25rem;margin:1rem 0 .25rem}
h2{font-size:1.75rem;margin:.5rem 0}
code{display:block;margin-top:.25rem;padding:.5rem .75rem;background:#fff;border:1px solid #d9d7cf;border-radius:6px;direction:ltr;text-align:start;word-break:break-all}
footer{margin-top:2rem;font-size:.875rem}
a{color:#0E8A4B}
</style>
</head>
<body>
<main>
<span class="mark" aria-hidden="true">${symbol}</span>
<h1>${escapeHtml(t.title)}</h1>
<h2>${escapeHtml(heading)}</h2>
<p>${escapeHtml(message)}</p>
${code ? `<p>${escapeHtml(t.code)}<code>${escapeHtml(code)}</code></p>\n` : ''}<footer>${appName ? `${escapeHtml(appName)} &middot; ` : ''}<a href="?${code ? `code=${encodeURIComponent(code)}&amp;` : ''}lang=${other}">${other === 'ar' ? 'العربية' : 'English'}</a></footer>
</main>
</body>
</html>
`;
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
      'x-content-type-options': 'nosniff',
    },
  });
}

/**
 * Creates a handler for the deletion status page. It reads the `code` query parameter,
 * looks it up in the store and answers with plain HTML in English or Arabic.
 */
export function createDeletionStatusHandler(
  options: StatusPageOptions,
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
    }
    const url = new URL(request.url);
    const lang = pickLang(request, url.searchParams.get('lang'));
    const t = text[lang];
    const code = url.searchParams.get('code');
    if (!code) {
      return page(lang, 'none', t.missing[0], t.missing[1], null, options.appName, 400);
    }
    const status = await options.store.get(code);
    if (!status) {
      return page(lang, 'none', t.notFound[0], t.notFound[1], code, options.appName, 404);
    }
    const [heading, message] = t.states[status.state];
    return page(lang, status.state, heading, message, code, options.appName, 200);
  };
}
