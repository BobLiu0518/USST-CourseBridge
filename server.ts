import { logger, input, inputPassword } from './utils.ts';

let currentCookie = '';
let refreshPromise: Promise<void> | null = null;

console.clear();
const userName = Deno.env.get('USST_USERNAME') ?? input('Enter username:');
const password = Deno.env.get('USST_PASSWORD') ?? inputPassword('Enter password:');
const realName = Deno.env.get('USST_REALNAME');
const hostname = Deno.env.get('HOSTNAME') ?? '0.0.0.0';
const port = Number(Deno.env.get('PORT') ?? 1906);

if (!userName || !password) {
    logger.error('Please set username and password through envs or input.');
    Deno.exit(1);
}

const courseHost = 'courses.usst.edu.cn';
const courseOrigin = `https://${courseHost}`;
const videoHost = 'mss4.usst.edu.cn';

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

const getCurrentCookie = () => currentCookie;

await tryRefreshCookie();
if (!currentCookie) {
    logger.error('No valid cookie after initialization.');
    Deno.exit(1);
}
setInterval(tryRefreshCookie, 60 * 60 * 1000);

Deno.serve({ hostname, port }, async (req) => {
    const url = new URL(req.url);
    const { pathname, search } = url;

    if (pathname.startsWith(`/${videoHost}`)) {
        const proxyUrl = new URL(pathname.replace(`/${videoHost}`, ''), `https://${videoHost}`);
        proxyUrl.search = search;

        const headers = new Headers(req.headers);
        headers.set('Host', videoHost);
        return fetch(proxyUrl, { method: req.method, headers, body: req.body });
    }

    const reqBody = ['GET', 'HEAD'].includes(req.method) ? null : await req.arrayBuffer();

    const fetchCourse = async () => {
        const headers = new Headers(req.headers);
        headers.set('Cookie', getCurrentCookie());
        headers.set('Host', courseHost);
        headers.set('Origin', courseOrigin);
        if (headers.has('Referer')) {
            headers.set('Referer', courseOrigin);
        }
        headers.delete('User-Agent');

        const proxyUrl = new URL(pathname + search, courseOrigin);
        return await fetch(proxyUrl, { method: req.method, headers, body: reqBody });
    };

    try {
        let res = await fetchCourse();

        if (res.headers.has('Set-Cookie')) {
            logger.info('Detected Set-Cookie, refreshing...');
            await tryRefreshCookie();
            res = await fetchCourse();
        }

        const resHeaders = new Headers(res.headers);
        const location = resHeaders.get('Location');
        if (location && location.includes(courseHost)) {
            const newLocation = location.replace(courseOrigin, '');
            resHeaders.set('Location', newLocation);
        }

        const responseInit = { status: res.status, statusText: res.statusText, headers: resHeaders };

        if (resHeaders.get('Content-Type')?.includes('application/json')) {
            let text = await res.text();
            text = text.replaceAll(`https://${videoHost}`, `/${videoHost}`);
            if (realName) text = text.replaceAll(realName, 'USST');
            return new Response(text, responseInit);
        }

        return new Response(res.body, responseInit);
    } catch (e) {
        logger.error('Proxy error:', e);
        return new Response('Proxy error.', { status: 500 });
    }
});

logger.info(`Proxy server is running on ${hostname}:${port}`);
