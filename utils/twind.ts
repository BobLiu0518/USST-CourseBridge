import { install, inline } from '@twind/core';
import presetTailwind from '@twind/preset-tailwind';
import presetAutoprefix from '@twind/preset-autoprefix';

install({
    presets: [presetTailwind(), presetAutoprefix()],
});

export const compileTwind = inline;
