let currentCookie = '';

const userName = Deno.env.get('USERNAME');
const password = Deno.env.get('PASSWORD');
const realName = Deno.env.get('REALNAME');
const hostname = Deno.env.get('HOSTNAME') ?? '127.0.0.1';
const port = Number(Deno.env.get('PORT') ?? 1906);

if (!userName || !password) {
    console.error('Please set USERNAME and PASSWORD envs.');
    Deno.exit(1);
}

const refreshCookie = async () => {
    try {
        console.log(`Logging in as ${userName}`);
        const loginUrl = 'https://courses.usst.edu.cn/auth/login.do';
        const params = new URLSearchParams({
            userName,
            password,
            response_type: 'code',
            client_id: '542db1ec1ad011e98bb40014101f0e28',
            redirect_uri: 'https://courses.usst.edu.cn/app/oauth/2.0/authzCodeCallback',
            login_type: 'outer',
        });

        const response = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });
        console.log(`${response.status} ${response.statusText}`);

        const cookies = response.headers.getSetCookie();
        if (cookies && cookies.length > 0) {
            currentCookie = Array.from(new Set(cookies.map((c) => c.split(';')[0]))).join('; ');
            console.log('Cookie updated:', currentCookie);
        } else {
            console.warn('Failed to get Cookie from response headers');
        }
    } catch (error) {
        console.error('Login failed:', error instanceof Error ? error.message : error);
    }
};

const getCurrentCookie = () => currentCookie;

await refreshCookie();
setInterval(refreshCookie, 10 * 60 * 1000);

Deno.serve({ hostname, port }, async (req) => {
    const targetUrl = new URL(req.url);
    targetUrl.protocol = 'https:';
    targetUrl.host = 'courses.usst.edu.cn';
    targetUrl.port = '';

    const headers = new Headers(req.headers);
    headers.set('Cookie', getCurrentCookie());
    headers.set('Host', 'courses.usst.edu.cn');
    headers.set('Origin', 'https://courses.usst.edu.cn');
    if (headers.has('Referer')) {
        headers.set('Referer', headers.get('Referer')!.replace(new URL(req.url).origin, 'https://courses.usst.edu.cn'));
    }
    headers.delete('User-Agent');

    try {
        const res = await fetch(targetUrl.toString(), {
            method: req.method,
            headers: headers,
            body: req.body,
        });

        const resHeaders = new Headers(res.headers);
        const location = resHeaders.get('location');
        if (location && location.includes('courses.usst.edu.cn')) {
            const localUrl = new URL(req.url);
            const newLocation = location.replace('https://courses.usst.edu.cn', `${localUrl.protocol}//${localUrl.host}`);
            resHeaders.set('location', newLocation);
        }

        const responseInit = {
            status: res.status,
            statusText: res.statusText,
            headers: resHeaders,
        };
        if (realName && resHeaders.get('content-type')?.includes('application/json')) {
            const text = await res.text();
            const replaced = text.replaceAll(realName, 'USST');
            return new Response(replaced, responseInit);
        } else {
            return new Response(res.body, responseInit);
        }
    } catch (e) {
        console.error('Proxy error:', e);
        return new Response('Proxy error.', { status: 500 });
    }
});

console.log(`Proxy server is running on port ${port}`);
