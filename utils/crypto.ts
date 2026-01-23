import { crypto } from '@std/crypto';
import { encodeHex } from '@std/encoding/hex';

export const md5 = async (text: string) => {
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('MD5', msgUint8);
    return encodeHex(hashBuffer);
};
