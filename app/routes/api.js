// api.js — endpoints auxiliares
'use strict';

const express = require('express');
const router  = express.Router();

// ── GET /api/health ─────────────────────────────────────────────────────────
router.get('/health', (req, res) => res.json({ status: 'ok' }));

module.exports = router;
