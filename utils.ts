import { blue, gray, red, yellow, green } from '@std/fmt/colors';

const getTimestamp = () => {
    return gray(new Date().toLocaleTimeString('zh-CN', { timeStyle: 'medium' }));
};

export const logger = {
    info: (...args: unknown[]) => console.log(getTimestamp(), blue('Info '), ...args),
    warn: (...args: unknown[]) => console.warn(getTimestamp(), yellow('Warn '), ...args),
    error: (...args: unknown[]) => console.error(getTimestamp(), red('Error'), ...args),
};

const doInput = (message: string, isPassword = false): string | null => {
    if (!Deno.stdin.isTerminal()) {
        return isPassword ? null : globalThis.prompt(message);
    }

    const encoder = new TextEncoder();
    Deno.stdout.writeSync(encoder.encode(`${getTimestamp()} ${green('Input')} ${message} `));

    Deno.stdin.setRaw(true);
    let input = '';
    const buf = new Uint8Array(1);
    try {
        while (true) {
            const n = Deno.stdin.readSync(buf);
            if (n === null || n === 0) break;
            const char = buf[0];
            if (char === 13 || char === 10) {
                // Enter
                Deno.stdout.writeSync(encoder.encode('\n'));
                break;
            }
            if (char === 3) {
                // Ctrl+C
                Deno.exit(1);
            }
            if (char === 127 || char === 8) {
                // Backspace
                if (input.length > 0) {
                    input = input.slice(0, -1);
                    Deno.stdout.writeSync(encoder.encode('\b \b'));
                }
                continue;
            }

            const charStr = String.fromCharCode(char);
            input += charStr;
            const echo = isPassword ? '*' : charStr;
            Deno.stdout.writeSync(encoder.encode(gray(echo)));
        }
    } finally {
        Deno.stdin.setRaw(false);
    }
    return input || null;
};

export const input = (message: string): string | null => doInput(message, false);
export const inputPassword = (message: string): string | null => doInput(message, true);
