export const jsonResponse = (text: string) =>
    new Response(text, {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

export const htmlResponse = (text: string) =>
    new Response(text, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

export const errorResponse = (text: string, status = 500) => new Response(text, { status });
