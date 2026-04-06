'use strict';
const i18n = require('i18n');
const path  = require('path');

i18n.configure({
    locales:       ['pt', 'en', 'es'],
    defaultLocale: 'pt',
    directory:     path.join(__dirname, '../../locales'),
    cookie:        'gymbros_lang',
    // Flat key lookup — dots in key names are treated as literal characters,
    // not as object-path separators. This preserves keys like "nav.home".
    objectNotation: false,
    // Never write missing keys back to locale files at runtime.
    updateFiles: false,
    syncFiles:   false,
    autoReload:  false,
});

module.exports = i18n;
