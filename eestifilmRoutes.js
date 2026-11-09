const express = require('express');
const router = express.Router();

const {
    eestifilmHome,
    eestifilminimesed,
    inimesedAddGet,
    inimesedAddPost,
    filmidAddGet,
    filmidAddPost,
    ametidAddGet,
    ametidAddPost
} = require('../controllers/eestifilmController');

router.route('/').get(eestifilmHome);
router.route('/inimesed').get(eestifilminimesed);
router.route('/inimesed_add').get(inimesedAddGet).post(inimesedAddPost);
router.route('/filmid_add').get(filmidAddGet).post(filmidAddPost);
router.route('/ametid_add').get(ametidAddGet).post(ametidAddPost);

module.exports = router;