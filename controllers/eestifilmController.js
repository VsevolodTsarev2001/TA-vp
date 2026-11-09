const mysql = require('mysql2/promise');

// Avaleht
const eestifilmHome = (req, res) => {
    res.render('eestifilm');
};

// Inimeste nimekirja kuvamine
const eestifilminimesed = async (req, res) => {
    let conn;
    try {
        conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME
        });
        const sqlReq = 'SELECT * FROM person ORDER by last_name';
        const [sqlRes] = await conn.execute(sqlReq);
        res.render('eestifilminimesed', { personList: sqlRes });
    }
    catch (err) {
        console.log('Viga andmebaasist lugemisel: ' + err);
        res.render('eestifilminimesed', { personList: [] });
    }
    finally {
        if (conn) {
            await conn.end();
        }
    }
};

// Inimese lisamise vorm (GET)
const inimesedAddGet = (req, res) => {
    res.render('eestifilmiinimesed_add', {
        notice: 'Ootan sisestust!',
        firstNameInput: '',
        lastNameInput: '',
        bornInput: '',
        deceasedInput: ''
    });
};

// Inimese lisamise töötlemine (POST)
const inimesedAddPost = async (req, res) => {
    const firstName = req.body.firstNameInput;
    const lastName = req.body.lastNameInput;
    const bornInputStr = req.body.bornInput;
    const deceasedInputStr = req.body.deceasedInput;

    const renderWithError = (errorMsg) => {
        return res.render('eestifilmiinimesed_add', {
            notice: errorMsg,
            firstNameInput: firstName,
            lastNameInput: lastName,
            bornInput: bornInputStr,
            deceasedInput: deceasedInputStr
        });
    };

    if (!firstName || !lastName || !bornInputStr) {
        return renderWithError('Eesnimi, perekonnanimi ja sünnikuupäev on kohustuslikud!');
    }

    const now = new Date();
    const bornDate = new Date(bornInputStr);

    if (isNaN(bornDate.getTime()) || bornDate > now) {
        return renderWithError('Vigane sünnikuupäev! Kuupäev on vale või tulevikus.');
    }

    let deceasedDateForDb = null;
    if (deceasedInputStr !== '') {
        const deceasedDate = new Date(deceasedInputStr);

        if (isNaN(deceasedDate.getTime()) || deceasedDate > now) {
            return renderWithError('Vigane surmakuupäev! Kuupäev on vale või tulevikus.');
        }

        if (deceasedDate < bornDate) {
            return renderWithError('Surmakuupäev ei saa olla varasem kui sünnikuupäev!');
        }
        deceasedDateForDb = deceasedInputStr;
    }

    let conn;
    try {
        conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME
        });

        let sqlReq = 'INSERT INTO person (first_name, last_name, born, deceased) VALUES (?,?,?,?)';
        await conn.execute(sqlReq, [
            firstName,
            lastName,
            bornInputStr,
            deceasedDateForDb
        ]);

        res.render('eestifilmiinimesed_add', {
            notice: 'Andmed salvestati! Ootan uut sisestust!',
            firstNameInput: '',
            lastNameInput: '',
            bornInput: '',
            deceasedInput: ''
        });
    }
    catch (err) {
        console.log('Viga andmebaasiga suhtlemisel: ' + err);
        renderWithError('Tekkis viga andmebaasiga suhtlemisel, andmeid ei salvestatud!');
    }
    finally {
        if (conn) {
            await conn.end();
        }
    }
};

// 1. Uus tabel: Filmide lisamine (GET)
const filmidAddGet = (req, res) => {
    res.render('eestifilmimod_add', {
        notice: 'Ootan filmi sisestust!',
        titleInput: '',
        yearInput: ''
    });
};

// Filmide lisamine (POST)
const filmidAddPost = async (req, res) => {
    const title = req.body.titleInput;
    const year = req.body.yearInput;

    if (!title || !year) {
        return res.render('eestifilmimod_add', {
            notice: 'Pealkiri ja aasta on kohustuslikud!',
            titleInput: title,
            yearInput: year
        });
    }

    res.render('eestifilmimod_add', {
        notice: 'Film edukalt lisatud!',
        titleInput: '',
        yearInput: ''
    });
};

// 2. Uus tabel: Ametite lisamine (GET)
const ametidAddGet = (req, res) => {
    res.render('eestifilmiamet_add', {
        notice: 'Ootan ameti sisestust!',
        positionInput: ''
    });
};

// Ametite lisamine (POST)
const ametidAddPost = async (req, res) => {
    const position = req.body.positionInput;

    if (!position) {
        return res.render('eestifilmiamet_add', {
            notice: 'Ameti nimetus on kohustuslik!',
            positionInput: position
        });
    }

    res.render('eestifilmiamet_add', {
        notice: 'Amet edukalt lisatud!',
        positionInput: ''
    });
};

module.exports = {
    eestifilmHome,
    eestifilminimesed,
    inimesedAddGet,
    inimesedAddPost,
    filmidAddGet,
    filmidAddPost,
    ametidAddGet,
    ametidAddPost
};