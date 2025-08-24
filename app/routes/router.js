const express = require('express');
const router = express.Router();
const path = require('path');

// Rotas principais
router.get('/', (req, res) => {
    res.render('pages/index');
});

router.get('/login', (req, res) => {
    res.render('pages/login');
});

router.get('/register', (req, res) => {
    res.render('pages/register');
});

router.get('/planos', (req, res) => {
    res.render('pages/planos');
});

router.get('/academias', (req, res) => {
    res.render('pages/academias');
});

router.get('/compra', (req, res) => {
    res.render('pages/compra');
});

router.get('/compra2', (req, res) => {
    res.render('pages/compra2');
});

router.get('/compra3', (req, res) => {
    res.render('pages/compra3');
});

// Rotas para arquivos estáticos 
router.get('/js/carrossel.js', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/js/carrossel.js'));
});

router.get('/js/header.js', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/js/header.js'));
});


module.exports = router;