import { logger, input, inputPassword, md5, generateRandomString, compileTwind, errorResponse, htmlResponse, jsonResponse } from './utils/mod.ts';

let currentCookie = '';
let secKey = '';
let refreshPromise: Promise<void> | null = null;

console.clear();
const userName = Deno.env.get('USST_USERNAME') ?? input('Enter username:');
const password = Deno.env.get('USST_PASSWORD') ?? inputPassword('Enter password:');
const hostname = Deno.env.get('HOSTNAME') ?? '0.0.0.0';
const port = Number(Deno.env.get('PORT') ?? 1906);

if (!userName || !password) {
    logger.error('Please set username and password through envs or input.');
    Deno.exit(1);
}

const courseHost = 'courses.usst.edu.cn';
const courseOrigin = `https://${courseHost}`;
const videoHost = 'mss4.usst.edu.cn';
const utf8Decoder = new TextDecoder('utf-8');

const fetchSecKey = async () => {
    try {
        const response = await fetch(`${courseOrigin}/app/vodvideo/vodVideoPlay.d2j`, {
            headers: { Cookie: currentCookie },
        });
        const html = await response.text();
        const match = html.match(/id="xForSecName"\s+vaule="([^"]+)"/);
        if (match) {
            secKey = atob(match[1]);
            logger.info('SecKey updated:', secKey);
        } else {
            logger.warn('Failed to find xForSecName in vodVideoPlay.d2j');
        }
    } catch (error) {
        logger.error('Error fetching SecKey:', error);
    }
};

const maxRetries = 3;
const refreshCookie = async (attempt = 1) => {
    try {
        if (attempt > 1) {
            logger.info(`Retrying login attempt ${attempt} of ${maxRetries}...`);
        }
        logger.info(`Logging in as ${userName}`);
        const loginUrl = `${courseOrigin}/auth/login.do`;
        const params = new URLSearchParams({
            userName,
            password,
            response_type: 'code',
            client_id: '542db1ec1ad011e98bb40014101f0e28',
            redirect_uri: `${courseOrigin}/app/oauth/2.0/authzCodeCallback`,
            login_type: 'outer',
        });

        const response = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });
        logger.info(`Request status: ${response.status} ${response.statusText}`);

        const cookies = response.headers.getSetCookie();
        if (!cookies || !cookies.length) {
            logger.warn('No cookies returned in response headers');
            const responseText = await response.text();
            const match = responseText.match(/\$\("#errorMsg"\)\.html\("(.+?)"\);/);
            throw new Error(match ? `Login failed: ${match[1]}` : 'Login failed: Unknown error');
        }

        currentCookie = Array.from(new Set(cookies.map((c) => c.split(';')[0]))).join('; ');
        logger.info('Cookie updated:', currentCookie);
        await fetchSecKey();
    } catch (error) {
        logger.warn(error instanceof Error ? error.message : error);
        if (attempt >= maxRetries) {
            logger.error('Max retries reached. Login failed.');
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
        await refreshCookie(attempt + 1);
    } finally {
        refreshPromise = null;
    }
};

const tryRefreshCookie = () => {
    if (!refreshPromise) {
        refreshPromise = refreshCookie();
    }

    return refreshPromise;
};

const setOauth = async (headers: Headers, body: URLSearchParams, path: string) => {
    const nonce = String(Date.now());
    const oauthPath = '';

    const paramsMap = new Map<string, string>();
    body.forEach((value, key) => {
        paramsMap.set(key, value);
    });

    paramsMap.set('oauth-consumer-key', secKey);
    paramsMap.set('oauth-nonce', nonce);
    paramsMap.set('oauth-path', oauthPath);

    const randomP1 = 'oauth_' + generateRandomString(5);
    const randomP2 = 'oauth_' + generateRandomString(5);
    const randomV1 = generateRandomString(8);
    const randomV2 = generateRandomString(8);

    paramsMap.set(randomP1, randomV1);
    paramsMap.set(randomP2, randomV2);

    const sortedKeys = Array.from(paramsMap.keys()).sort();
    const sortedParams = sortedKeys.map((key) => `${key}=${paramsMap.get(key)}`);
    const signatureBase = `${path}?${sortedParams.join('&')}`;
    const signature = await md5(signatureBase);

    headers.set('oauth-consumer-key', secKey);
    headers.set('oauth-nonce', nonce);
    headers.set('oauth-path', oauthPath);
    headers.set('oauth-signature', signature);

    body.set(randomP1, randomV1);
    body.set(randomP2, randomV2);
};

const fetchAPI = async (path: string, rawBody: ConstructorParameters<typeof URLSearchParams>[0], withOauth: boolean = false): Promise<string> => {
    const body = new URLSearchParams(rawBody);
    const headers = new Headers();
    headers.set('Cookie', currentCookie);
    headers.set('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
    headers.set('Accept', 'application/json, text/javascript, */*; q=0.01');

    if (withOauth) await setOauth(headers, body, path);

    const response = await fetch(`${courseOrigin}${path}`, { method: 'POST', headers, body });
    if (response.headers.has('Set-Cookie')) {
        logger.info('Detected Set-Cookie from API, refreshing...');
        await tryRefreshCookie();
    }

    const buffer = await response.arrayBuffer();
    return utf8Decoder.decode(buffer);
};

await tryRefreshCookie();
if (!currentCookie || !secKey) {
    logger.error('No valid cookie or secKey after initialization.');
    Deno.exit(1);
}
setInterval(tryRefreshCookie, 60 * 60 * 1000);

let compiledHtml: string | null = null;
Deno.serve({ hostname, port }, async (req) => {
    const url = new URL(req.url);
    const { pathname, searchParams } = url;

    if (pathname === '/' || pathname === '/index.html') {
        try {
            if (!Deno.build.standalone || !compiledHtml) {
                compiledHtml = compileTwind(await Deno.readTextFile(new URL('./index.html', import.meta.url)));
            }

            return htmlResponse(compiledHtml);
        } catch (e) {
            logger.error('Failed to read index.html:', e);
            return errorResponse('index.html not found.', 404);
        }
    }

    if (pathname.startsWith('/video/')) {
        const proxyUrl = new URL(pathname.replace(/^\/video\//, '/'), `https://${videoHost}`);
        proxyUrl.search = url.search;

        const headers = new Headers(req.headers);
        headers.set('Host', videoHost);
        headers.delete('Referer');
        headers.delete('Origin');

        return fetch(proxyUrl, { method: req.method, headers, body: req.body });
    }

    const apiRoutes: Record<string, () => Promise<string>> = {
        '/api/current-term': () =>
            fetchAPI('/app/videosearchcriteria/match/termTimes', {
                limit: '1',
            }),
        '/api/semesters': () =>
            fetchAPI('/app/videosearchcriteria/semesterlist', {
                pageIndex: '1',
                pageSize: '60',
            }),
        '/api/subjects': () =>
            fetchAPI('/app/system/course/subject/findSubjectVodList', {
                pageIndex: '1',
                pageSize: '50',
                orderByType: '',
                termTimeId: searchParams.get('termTimeId') ?? '',
            }),
        '/api/sessions': () =>
            fetchAPI('/app/system/resource/vodVideo/getCourseListBySubject', {
                orderField: 'courTimes',
                subjectId: searchParams.get('subjectId') ?? '',
                teclId: searchParams.get('teclId') ?? '',
            }),
        '/api/video-info': async () => {
            const text = await fetchAPI(
                '/app/system/resource/vodVideo/getvideoinfos',
                {
                    playTypeHls: 'true',
                    id: searchParams.get('id') ?? '',
                },
                true,
            );
            return text.replaceAll(`https://${videoHost}/`, '/video/');
        },
    };

    try {
        if (pathname in apiRoutes) {
            return jsonResponse(await apiRoutes[pathname]());
        }
    } catch (e) {
        logger.error('API Error:', e);
        return errorResponse('Internal Server Error', 500);
    }

    return errorResponse('Not Found', 404);
});

logger.info(`Course platform is running on http://${hostname}:${port}`);
