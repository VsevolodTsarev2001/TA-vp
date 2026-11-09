const express = require('express');
const fs = require('fs').promises;
const dateET = require('./src/dateTimeET');
const bodyparser = require('body-parser');

// moodul andmebaasiga suhtlemiseks, promises osaga async programmerimise jaoks
const mysql = require('mysql2/promise');
// moodul .env faili lugemiseks, keskkonnamuutujate parsimiseks
require ('dotenv').config();

const textRef = 'public/txt/vanasonad.txt';
const regTextRef = 'public/txt/visits.txt';

const app = express();

// määrame veebilehtedel mallide renderdamise mootori
app.set('view engine', 'ejs');
// määran ühe päris kataloogi virtuaalses serveris kättesaadavaks
app.use(express.static('public'));

// OLULINE: Rida, mis lubab POST päringust (vormilt) andmeid kätte saada (req.body)
app.use(express.urlencoded({ extended: true }));
app.use(bodyparser.urlencoded({ extended: false }));

// --- Marsruudid ---

app.get('/', (req, res)=>{
    const dayNow = dateET.day();
    const dateNow = dateET.fullDate(0);
    const timeNow = dateET.fullTime();
    res.render('index', {dayNow: dayNow, dateNow: dateNow, timeNow: timeNow});
});

app.get('/kodune', (req, res) => {
    res.render('kodune'); 
});

app.get('/vanasona', async (req, res)=>{
    try{
        const data = await fs.readFile(textRef, "utf8");
        let folkWisdom = data.split(";");
        res.render('vanasona', {wisdom: folkWisdom[Math.round(Math.random() * (folkWisdom.length - 1))]});
    }
    catch (err){
        console.log(err);
        res.render('vanasona', {wisdom: 'Ei leidnud ühtegi vanasõna!'});
    }
});

app.get('/regvisit', (req, res)=>{
    res.render('regvisit');
});

app.post('/regvisit', async (req, res)=>{
    try {
        const name = req.body.nameInput;
        const dateNow = dateET.fullDate(0);
        const timeNow = dateET.fullTime();
        
        const recordLine = `${name}, ${dateNow}, ${timeNow};`;

        await fs.appendFile(regTextRef, recordLine);
        res.render('regvisit');
    }
    catch (err){
        console.log(err);
        res.render('regvisit');
    }
});

app.get('/lastvisit', async (req, res) => {
    try {
        const data = await fs.readFile(regTextRef, 'utf8');
        const visitsList = data.split(';');
        
        let lastVisitMessage = "Külastusi pole veel registreeritud.";

        if (visitsList.length > 1) {
            const lastIndex = visitsList.length - 2;
            const lastRecord = visitsList[lastIndex];
            
            const parts = lastRecord.split(',');
            if (parts.length >= 3) {
                const name = parts[0].trim();
                const date = parts[1].trim();
                const time = parts[2].trim();

                lastVisitMessage = `Viimati registreeriti külastus ${date}, kell ${time} kui seda tegi ${name}.`;
            }
        }

        res.render('lastvisit', { message: lastVisitMessage });
    } catch (err) {
        console.log(err);
        res.render('lastvisit', { message: 'Külastuste faili ei leitud või see on tühi.' });
    }
});

app.get('/eestifilm', (req,res)=>{
    res.render('eestifilm');
});

app.get('/eestifilm/inimesed', async (req,res)=>{
    let conn;
    try{
        conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME
        });
        const sqlReq = 'SELECT * FROM person ORDER by last_name';
        const [sqlRes] = await conn.execute(sqlReq);
        res.render('eestifilminimesed', {personList: sqlRes});
    }
    catch (err){
        console.log('Viga andmebaasist lugemisel: ' + err);
        res.render('eestifilminimesed', { personList: [] });
    }
    finally {
        if(conn){
            await conn.end();
        }
    }
});

// ISIKU LISAMINE - GET (tühjad väärtused alguses)
app.get('/eestifilm/inimesed_add', (req, res)=>{
    res.render('eestifilmiinimesed_add', {
        notice: 'Ootan sisestust!',
        firstNameInput: '',
        lastNameInput: '',
        bornInput: '',
        deceasedInput: ''
    });
});

// ISIKU LISAMINE - POST (täiendatud kontrollid ja väärtuste tagastamine vea korral)
app.post('/eestifilm/inimesed_add', async (req, res)=>{
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
        if(conn){
            await conn.end();
        }
    }
});


// --- KAKS UUT MARSRUUTI (Filmid ja Ametid) ---

app.get('/eestifilm/filmid_add', (req, res) => {
    res.render('eestifilmimod_add', {
        notice: 'Ootan filmi sisestust!',
        titleInput: '',
        yearInput: ''
    });
});

app.post('/eestifilm/filmid_add', async (req, res) => {
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
});

app.get('/eestifilm/ametid_add', (req, res) => {
    res.render('eestifilmiamet_add', {
        notice: 'Ootan ameti sisestust!',
        positionInput: ''
    });
});

app.post('/eestifilm/ametid_add', async (req, res) => {
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
});

const galleryPhotoUploadRouter = require('./routes/galleryPhotoUploadRoutes');
app.use('/galleryPhotoUpload', galleryPhotoUploadRouter);

app.listen(5125, () => {
    console.log('Server töötab aadressil http://greeny.cs.tlu.ee:5125');
});