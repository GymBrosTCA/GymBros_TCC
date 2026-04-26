'use strict';
const i18n = require('i18n');
const path  = require('path');

i18n.configure({
  locales:       ['pt', 'en', 'es'],
  defaultLocale: 'pt',
  directory:     path.join(__dirname, '../../locales'),
  cookie:        'gymbros_lang',
  objectNotation: false,
  updateFiles: false,
  syncFiles:   false,
  autoReload:  false,
});

module.exports = i18n;
