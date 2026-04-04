/**
 * adminAuth.js — Middleware de proteção das rotas /admin
 */
'use strict';

function adminAuth(req, res, next) {
    if (req.session && req.session.admin) {
        return next();
    }
    // Redireciona para login admin preservando a URL de destino
    return res.redirect('/admin/login?next=' + encodeURIComponent(req.originalUrl));
}

module.exports = adminAuth;
