const express = require('express');
const fs = require('fs').promises;
const dateET = require('./src/dateTimeET');
const bodyparser = require('body-parser');


//moodul andmebaasiga suhtlemiseks, promises osaga async programmerimise jaoks
const mysql = require('mysql2/promise');
//moodul .env faili lugemiseks, keskkonnamuutujate parsimiseks
require ('dotenv').config();

const textRef = 'public/txt/vanasonad.txt';
const regTextRef = 'public/txt/visits.txt'; // Parandasin siin muutuja suure 'T'-ga (koodis oli regtextRef vs regTextRef)

const app = express();

// määrame veebilehtedel mallide renderdamise mootori
app.set('view engine', 'ejs');
// määran ühe päris kataloogi virtuaalses serveris kättesaadavaks
app.use(express.static('public'));

// OLULINE: Rida, mis lubab POST päringust (vormilt) andmeid kätte saada (req.body)
app.use(express.urlencoded({ extended: true }));
app.use(bodyparser.urlencoded({ extended: false }));

/*
// loon andmebaasiühenduse
const conn = mysql.createConnection({
    host: 'localhost',
    user: 'if26',
    password: 'ifikas26',
    database: 'if26_vsevolod_tsarev_TA'
})
*/

// --- Marsruudid ---

app.get('/', (req, res)=>{
    const dayNow = dateET.day();
    const dateNow = dateET.fullDate(0);
    const timeNow = dateET.fullTime();
    res.render('index', {dayNow: dayNow, dateNow: dateNow, timeNow: timeNow});
});

// 1. Punkt: Lisage uus marsruut eelmise kodutöö lehe jaoks (näiteks /kodune)
app.get('/kodune', (req, res) => {
    // Siia saate panna oma eelmise kodutöö lehe renderdamise või sisu
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

// 2. Punkt: Täiendatud POST päring nime, kuupäeva ja kellaaja salvestamiseks
app.post('/regvisit', async (req, res)=>{
    try {
        const name = req.body.nameInput;
        const dateNow = dateET.fullDate(0);
        const timeNow = dateET.fullTime();
        
        // Formaat: nimi, kuupäev, kellaaeg;
        const recordLine = `${name}, ${dateNow}, ${timeNow};`;

        await fs.appendFile(regTextRef, recordLine);
        res.render('regvisit');
    }
    catch (err){
        console.log(err);
        res.render('regvisit');
    }
});

// 3. Punkt: Uus marsruut viimase külastuse kuvamiseks
app.get('/lastvisit', async (req, res) => {
    try {
        const data = await fs.readFile(regTextRef, 'utf8');
        const visitsList = data.split(';');
        
        // Kuna viimane element on tühi (sest iga kirje lõpus on ';'),
        // siis viimane tegelik külastus on eelviimane ehk visitsList.length - 2
        let lastVisitMessage = "Külastusi pole veel registreeritud.";

        if (visitsList.length > 1) {
            const lastIndex = visitsList.length - 2;
            const lastRecord = visitsList[lastIndex]; // Formaat: nimi, kuupäev, kellaaeg
            
            // Jagame kirje komade järgi osadeks
            const parts = lastRecord.split(',');
            if (parts.length >= 3) {
                const name = parts[0].trim();
                const date = parts[1].trim();
                const time = parts[2].trim();

                // "Viimati registreeriti külastus [kuupäev], kell [kellaaeg] kui seda tegi [nimi]."
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
    //console.log('Andmebaasiserver on: ' + process.env.DB_HOST);
    let conn;
	try{
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME
        });
        const sqlReq = 'SELECT * FROM person ORDER by last_name';
        const [sqlRes] = await conn.execute(sqlReq);
        console.log(sqlRes);
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


app.get('/eestifilm/inimesed_add', (req, res)=>{
	res.render('eestifilmiinimesed_add', {notice: 'Ootan sisestust!'});
});

app.post('/eestifilm/inimesed_add', async (req, res)=>{
	console.log(req.body);
	//kontrollime andmete olemasolu
	if(!req.body.firstNameInput || !req.body.lastNameInput || !req.body.bornInput || !req.body.bornInput >= new Date()){
		console.log('Andmed pole korrektsed');
		return res.render('eestifilmiinimesed_add', {notice: 'Andmed on puudulikud!'});
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
		let deceacedDate = null;
		if(req.body.deceasedInput !=''){
			deceacedDate = req.body.deceasedInput;
		}
		await conn.execute(sqlReq, [
			req.body.firstNameInput,
			req.body.lastNameInput,
			req.body.bornInput,
			deceacedDate
		]);
		res.render('eestifilmiinimesed_add', {notice: 'Andmed salvestati! Ootan uut sisestust!'});
	}
	catch (err) {
		console.log('Viga andmebaasiga suhtlemisel: ' + err);
		res.render('eestifilmiinimesed_add', {notice: 'Tekkis viga, andmeid ei salvestatud!'});
	}
	finally {
		if(conn){
			await conn.end();
		}
	}
});
app.listen(5125, () => {
    console.log('Server töötab aadressil http://greeny.cs.tlu.ee:5125');
});