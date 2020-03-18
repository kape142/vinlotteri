const express = require("express");
const http = require('http');
const bodyParser = require("body-parser");
const expressWs = require('express-ws');
const util = require("./util");

'use strict';

let logging = true;

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
const expressWsServer = expressWs(app, httpServer);
const token = util.makeid(30);

const names = ['AE', 'AM', 'AMH', 'AMO', 'CA', 'EAA', 'EBH', 'ES', 'GØ', 'HB', 'HE', 'HS', 'HW', 'IR', 'JMT', 'JV', 'KB', 'KIMS', 'KSM', 'LOB', 'MAJ', 'MLA', 'MSJ', 'NDB', 'PS', 'PW', 'RF', 'SBH', 'SNØ', 'TAS', 'TO', 'TES', 'YN'];

let participants = names.slice();
let tickets = [];
let winners = {
    consolation: "none",
    second: "none",
    first: "none"
};

const settings = {
    ticketsPerPerson: 4,
    timePerDraw: 5,
    delayOnConsolationPrize: 3,
    delayOnTwoLeft: 4,
    ticketsPerDraw: 2,
};

let drawnTickets = ["none"];
let discardedMap = {};
let delay = settings.timePerDraw;

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

app.ws("/join", (ws, req) => {
    if(tickets.length > 0){
        ws.send(JSON.stringify(getClientData()))
    }
    ws.on("message", print);
    ws.on("close", (code, reason) => {
        let i = clientsWS.indexOf(ws);
        if (i > -1)
            clientsWS.splice(i, 1);
        print("ws disconnect", code, reason)
    });
    clientsWS.push(ws)
});

function pullAndUpdate() {
    if(delay>0){
        return delay-=settings.timePerDraw
    }
    drawnTickets = [];
    for (let i = 0; i < settings.ticketsPerDraw; i++) {
        drawnTickets.push(pullOne());
        if (winners.first !== "none")
            break;
    }
    clientsWS.forEach(a => a.send(JSON.stringify(getClientData())))
}

function pullOne() {
    let randomIndex = Math.floor(Math.random() * tickets.length);
    let lastTicket = tickets.splice(randomIndex, 1)[0];
    if (discardedMap[lastTicket])
        discardedMap[lastTicket]++;
    else {
        discardedMap[lastTicket] = 1
    }
    if (discardedMap[lastTicket] === 2 && winners.consolation === "none") {
        winners.consolation = lastTicket;
        delay = settings.delayOnConsolationPrize
    }

    let set = new Set(tickets);
    if (set.size === 2) {
        winners.second = "next";
        winners.first = "next";
        delay = settings.delayOnTwoLeft;
        return;
    }

    if(winners.first === "next"){
        if (set.size === 1) {
            winners.second = lastTicket;
            winners.first = tickets[0];
            clearInterval(updateClientsInterval)
        }
    }

    return lastTicket
}

let updateClientsInterval = undefined;

function start() {
    tickets = util.shuffle(participants.map(a => util.arrayWithCopies(a, settings.ticketsPerPerson)).flat());
    clearInterval(updateClientsInterval);
    pullAndUpdate();
    updateClientsInterval = setInterval(pullAndUpdate, settings.timePerDraw * 1000);
}


app.get("/names", (req, res) => {
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
    res.status(200).send({token})
});

app.put("/admin/logging", (req, res) => {
    logging = req.body.logging === "on";
    console.log("logging is now turned", (logging ? "on" : "off"), "\n");
    return res.status(200).send()
});

app.put("/admin/start", (req, res) => {
    start();
    console.log("game starting");
    return res.status(200).send()
});


httpServer.listen(port);

print("Server started " + new Date().toISOString());

process.on('SIGINT', function () {
    process.exit();
});