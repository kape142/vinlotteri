let logging = true;

function print(...a) {
    if (logging) {
        console.log(...a);
    }
}

let drawingArea;
let areas;
let ticketWidth;


function findTicketWidth(){
    let testTicket = createTicketElement("testing", 1892);
    testTicket.style.visibility = "hidden";
    document.body.appendChild(testTicket);
    setTimeout(()=>{
        print(testTicket.getBoundingClientRect());
        ticketWidth = testTicket.getBoundingClientRect().width;
        testTicket.remove();
    })
}


window.onload = () => {
    drawingArea = document.getElementById("drawing-area");
    areas = Array.from(document.getElementsByClassName("player-column-lane"));
    findTicketWidth();
    fetchAndUpdateNames().then(()=>{
        connectWS()
    })
};


let token = "";

const baseHeader = () => {
    return {
        token,
        "Content-Type": "application/json; charset=utf-8"
    }
};

let keysTyped = [];

let consolation = "none";
let ticketObjects = {};
let initiated = false;

let names = [];
let ticketsPerPerson = 4;

let ws;

function connectWS() {
    ws = new WebSocket(document.location.href.replace("http", "ws") + "join");

    setInterval(() => {
        ws.send("heroku refresh");
    }, 30 * 1000);

    ws.onmessage = message => {
        let data = JSON.parse(message.data);
        print(data);
        update(data);
        if (data.winners.consolation !== consolation) {
            print(data.winners);
            consolation = data.winners.consolation
        }
        if (data.tickets.length === 1) {
            print(data.winners);
        }
    };
}

function update(data) {
    if (!initiated) {
        if (data.participants.length !== names.length || data.settings.ticketsPerPerson !== ticketsPerPerson) {
            ticketsPerPerson = data.settings.ticketsPerPerson;
            updateNames(data.participants);
        }
        let order = createOrder(data.participants.length * data.settings.ticketsPerPerson);
        let index = 0;
        for (let key in data.participants) {
            let name = data.participants[key];
            for (let i = 0; i < data.settings.ticketsPerPerson; i++) {
                let element = createTicketElement(name, i);
                element.style.order = order[index++];
                drawingArea.appendChild(element);
                ticketObjects[name + i] = {
                    name,
                    ticketNumber: i,
                    element,
                    drawn: false
                }
            }
        }
        initiated = true;
    }
    for (let key in data.discardedMap) {
        for (let i = 0; i < data.discardedMap[key]; i++) {
            if (!ticketObjects[key + i].drawn) {
                ticketObjects[key + i].element.style.margin = "0 -15px 0 0";
                document.getElementById(key + "-name-tag-ticket-area").appendChild(ticketObjects[key + i].element);
                ticketObjects[key + i].drawn = true;
            }
        }
    }
    for (let key in data.drawnTickets) {
        let name = data.drawnTickets[key];
    }
}

function createTicketElement(name, i) {
    let div = document.createElement("div");
    div.className = "ticket";
    div.id = `ticket-${name}-${i}`;
    div.appendChild(document.createTextNode(name));
    return div;
}

let loggingServer = (value) => {
    fetch("admin/logging", {
        method: "PUT",
        headers: baseHeader(),
        body: JSON.stringify({
            logging: value
        })
    })
        .catch(print)
};

let startServer = () => {
    fetch("admin/start", {
        method: "PUT",
        headers: baseHeader()
    })
        .catch(print)
};

function fetchAndUpdateNames() {
    return fetch("names").then(a => a.json()).then(a => updateNames(a.names));
}


function updateNames(namedata) {
    Array.from(document.getElementsByClassName("name-tag")).forEach(a => a.remove());
    names = namedata;
    showNames(namedata);
}

function showNames(names) {
    let index = 0;
    for (let key in names) {
        areas[index].appendChild(nameTag(names[key]));
        index = (index + 1) % areas.length;
    }
}

function nameTag(name) {
    let div = document.createElement("div");
    div.id = name + "-name-tag";
    div.className = "name-tag";
    let h6 = document.createElement("h6");
    h6.textContent = name;
    let ticketArea = document.createElement("div");
    ticketArea.id = name + "-name-tag-ticket-area";
    ticketArea.className = "name-tag-ticket-area";
    ticketArea.style.width = ticketWidth + (ticketsPerPerson-1)*(ticketWidth-15) + "px";
    div.appendChild(h6);
    div.appendChild(ticketArea);
    return div;
}

document.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        fetch("authenticate", {
            method: "POST",
            headers: baseHeader(),
            body: JSON.stringify({
                key: keysTyped.join("")
            })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error("incorrect key")
                }
                return response.json()
            })
            .then(a => {
                token = a.token;
                print(token);
            })
            .catch(print)

    } else {
        keysTyped.push(event.key.toUpperCase());
        if (keysTyped.length > 25)
            keysTyped = keysTyped.slice(5);
    }
});

function createOrder(length) {
    let range = [];
    for (let i = 1; i <= length - 1; i++) {
        range.push(i);
    }
    return shuffle(range);
}

function shuffle(array) {
    let currentIndex = array.length, temporaryValue, randomIndex;
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}