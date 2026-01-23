import { blue, red, yellow, gray } from '@std/fmt/colors';

export const getTimestamp = () => {
    return gray(new Date().toLocaleTimeString('zh-CN', { timeStyle: 'medium' }));
};

export const logger = {
    info: (...args: unknown[]) => console.log(getTimestamp(), blue('Info '), ...args),
    warn: (...args: unknown[]) => console.warn(getTimestamp(), yellow('Warn '), ...args),
    error: (...args: unknown[]) => console.error(getTimestamp(), red('Error'), ...args),
};
