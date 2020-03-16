const express = require("express");
const http = require('http');
const bodyParser = require("body-parser");
const expressWs = require('express-ws');
const util = require("./util");

'use strict';

let logging = true;
function print(a){
    if(logging){
        console.log(a);
    }
}

if (process.env.NODE_ENV !== 'production') {
    print("requiring dotenv");
    require('dotenv').config();
}
print(process.env.SUPERUSER_KEY);

const app = express();

app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));

app.use((req,res,next)=>{
    print("request for "+req.url);
    next()
});

const port = process.env.PORT || 80;
const httpServer = http.createServer(app);
const expressWsServer = expressWs(app, httpServer);
const key = util.makeid(30);

const names = ['AE', 'AM', 'AMH', 'AMO', 'CA', 'EAA', 'EBH', 'ES', 'GØ', 'HB', 'HE', 'HS', 'HW', 'IR', 'JMT', 'JV', 'KB', 'KIMS', 'KSM', 'LOB', 'MAJ', 'MLA', 'MSJ', 'NDB', 'PS', 'PW', 'RF', 'SBH', 'SNØ', 'TAS', 'TO', 'TES', 'YN'];


app.post("/admin/join", (req, res)=>{
    let key = process.env.SUPERUSER_KEY;
    let inputKey = req.body.key;
    print(key);
    print(inputKey);
    for(let i = 0; i < key.length; i++){
        print(`input: ${inputKey[inputKey.length-key.length+i]}, real: ${key[i]}`)
        if(inputKey[inputKey.length-key.length+i] !== key[i]){
            return res.status(401).send("Incorrect key")
        }
    }
})

app.put("/admin/logging",(req,res)=>{
    if(req.header.key === key){
        logging = req.body.logging;
        return res.status(200).send()
    }
    res.status(401).send("You do not have authority to perform this action")
});



httpServer.listen(port);

print("Server started " + new Date().toISOString());

process.on('SIGINT', function() {
    process.exit();
});