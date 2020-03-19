const express = require("express");
const http = require('http');
const bodyParser = require("body-parser");
const expressWs = require('express-ws');
const util = require("./util");

'use strict';

let logging = false;

function print(...a) {
    if (logging) {
        console.log(...a);
    }
}

if (process.env.NODE_ENV !== 'production') {
    print("requiring dotenv");
    require('dotenv').config();
}

const app = express();

app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));

app.use("/", (req, res, next) => {
    print("request for " + req.url);
    if (req.body) {
        print("body: ", req.body, "\n")
    }
    next()
});

const port = process.env.PORT || 80;
const httpServer = http.createServer(app);
expressWs(app, httpServer);
const token = util.makeid(30);

const names = ['AE', 'AM', 'AMH', 'AMO', 'CA', 'EAA', 'EBH', 'ES', 'GØ', 'HB', 'HE', 'HS', 'HW', 'IR', 'JMT', 'JV', 'KB', 'KIMS', 'KSM', 'LOB', 'MAJ', 'MLA', 'MSJ', 'NDB', 'PS', 'PW', 'RF', 'SBH', 'SNØ', 'TAS', 'TO', 'TES', 'YN'];

let participants = names.slice();
let tickets = [];
let winners = {
    consolation: "none",
};

const settings = {
    ticketsPerPerson: 4,
    timePerDraw: 3,
    delayOnConsolationPrize: 3,
    delayOnTwoLeft: 4,
    ticketsPerDraw: 1,
    winners: 2
};


let drawnTickets = [];
let discardedMap = {};
let delay = settings.timePerDraw;
let paused = false;
let winnersLeft = settings.winners;

function getClientData() {
    return {
        tickets,
        winners,
        participants,
        settings,
        drawnTickets,
        discardedMap
    }
}

let clientsWS = [];

app.ws("/join", (ws) => {
    if(Object.keys(discardedMap).length > 0){
        ws.send(JSON.stringify(getClientData()))
    }
    ws.on("message", msg=>{
        if(msg!=="heroku refresh"){
            print(msg);
        }
    });
    ws.on("close", (code, reason) => {
        let i = clientsWS.indexOf(ws);
        if (i > -1)
            clientsWS.splice(i, 1);
        print("ws disconnect", code, reason)
    });
    clientsWS.push(ws)
});

function pullAndUpdate() {
    if(delay>0 || paused){
        delay-=settings.timePerDraw
    }else{
        drawnTickets = [];
        for (let i = 0; i < settings.ticketsPerDraw; i++) {
            drawnTickets.push(pullOne());
            if (delay>0 || tickets.length === 1)
                break;
        }
    }
    clientsWS.forEach(a => a.send(JSON.stringify(getClientData())))
}

function pullOne() {
    let randomIndex = Math.floor(Math.random() * tickets.length);
    let lastTicket = tickets.splice(randomIndex, 1)[0];
    if (discardedMap[lastTicket]) {
        discardedMap[lastTicket].amount++;
        if(discardedMap[lastTicket].amount === settings.ticketsPerPerson){
            discardedMap[lastTicket].placing = "loser";
        }
    }
    else {
        discardedMap[lastTicket] = {
            amount: 1,
            placing: "none"
        }
    }
    if (discardedMap[lastTicket].amount === settings.ticketsPerPerson && winners.consolation === "none") {
        discardedMap[lastTicket].placing = "consolation";
        winners.consolation = lastTicket;
        delay = settings.delayOnConsolationPrize
    }
    if(tickets.length <= (winnersLeft+1)){
        delay = settings.delayOnTwoLeft;
    }

    if(tickets.length < winnersLeft){
        discardedMap[lastTicket].placing = winnersLeft;
        winners[winnersLeft] = lastTicket;
        winnersLeft--;
    }

    if(tickets.length === 1){
        delay = 0;
        setTimeout(pullAndUpdate, 1000);
        clearInterval(updateClientsInterval)
    }

    return lastTicket
}

let updateClientsInterval = undefined;

function reset(){
    clearInterval(updateClientsInterval);
    winners = {
        consolation: "none",
    };
    tickets = [];
    discardedMap = {};
    drawnTickets = [];
    delay = settings.timePerDraw;
    clientsWS.forEach(a => a.send(JSON.stringify(Object.assign(getClientData(),{reset:true}))))
}

function start() {
    winnersLeft = settings.winners;
    tickets = util.shuffle(participants.map(a => util.arrayWithCopies(a, settings.ticketsPerPerson)).flat());
    clearInterval(updateClientsInterval);
    pullAndUpdate();
    updateClientsInterval = setInterval(pullAndUpdate, settings.timePerDraw * 1000);
}


app.get("/participants", (req, res) => {
    res.status(200).send({names: participants});
});

app.use("/admin", (req, res, next) => {
    if (req.header("token") !== token) {
        print(req.header("token"), token);
        return res.status(401).send("You do not have authority to perform this action")
    }
    next();
});

app.post("/authenticate", (req, res) => {
    let key = process.env.SUPERUSER_KEY;
    let inputKey = req.body.key;
    for (let i = 0; i < key.length; i++) {
        if (inputKey[inputKey.length - key.length + i] !== key[i]) {
            return res.status(401).send("Incorrect key")
        }
    }
    print("Authenticated\n");
    res.status(200).send({token, settings, names, participants})
});



app.put("/admin/toggleperson", (req, res) => {
    if(req.body.value){
        if(!participants.includes(req.body.name)){
            participants.push(req.body.name);
            participants.sort();
        }
    }else{
        let index = participants.indexOf(req.body.name);
        if(index > -1){
            participants.splice(index, 1);
        }
    }
    return res.status(200).send()
});

app.put("/admin/settings", (req, res) => {
    Object.assign(settings, req.body.settings);
    return res.status(200).send()
});

app.put("/admin/logging", (req, res) => {
    logging = req.body.logging === "on";
    console.log("logging is now turned", (logging ? "on" : "off"), "\n");
    return res.status(200).send()
});

app.put("/admin/start", (req, res) => {
    start();
    print("game starting");
    return res.status(200).send()
});

app.put("/admin/pause", (req, res) => {
    paused = req.body.paused;
    print("game paused");
    return res.status(200).send()
});

app.put("/admin/reset", (req, res) => {
    reset();
    print("game reset");
    return res.status(200).send()
});


httpServer.listen(port);

print("Server started " + new Date().toISOString());

process.on('SIGINT', function () {
    process.exit();
});