let logging = false;

function print(...a) {
    if (logging) {
        console.log(...a);
    }
}

let drawingArea;
let areas;
let ticketWidth;


function findTicketWidth() {
    let testTicket = createTicketElement("testing", 1892);
    testTicket.style.visibility = "hidden";
    document.body.appendChild(testTicket);
    setTimeout(() => {
        ticketWidth = testTicket.getBoundingClientRect().width;
        testTicket.remove();
    })
}


window.onload = () => {
    drawingArea = document.getElementById("drawing-area");
    areas = Array.from(document.getElementsByClassName("player-column-lane"));
    findTicketWidth();
    fetchAndUpdateNames().then(() => {
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

let winners = {
    consolation: "none",
    first: "none",
    second: "none"
};

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
        update(data);
    };
}

function update(data) {
    if (data.reset) {
        winners = {
            consolation: "none",
            first: "none",
            second: "none"
        };
        document.querySelectorAll(".first, .second, .consolation").forEach(a => a.className = "name-tag");
        Object.keys(ticketObjects).map(a => ticketObjects[a]).forEach(a => {
            a.element.remove();
        });
        ticketObjects = {};
        initiated = false;
        return;
    }

    setTimeout(() => {
        Object.keys(data.winners).filter(a => winners[a] !== data.winners[a]).forEach(a => {
            print(a, data.winners, winners);
            winners[a] = data.winners[a];
            document.getElementById(`${data.winners[a]}-name-tag`).classList.add(a);
        });
    }, initiated ? (data.settings.timePerDraw * 1000) : 0);

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
                    drawn: false,
                    animated: false
                };
            }
        }
    }

    let toggleElements = [];

    for (let key in data.discardedMap) {
        for (let i = 0; i < data.discardedMap[key]; i++) {
            let obj = ticketObjects[key + i];
            let oldElement = obj.element;
            if (!obj.drawn) {
                if (initiated) {
                    obj.rect = oldElement.getBoundingClientRect();
                    let copy = oldElement.cloneNode(true);
                    obj.element = copy;
                    copy.style.margin = "0 -15px 0 0";
                    document.getElementById(key + "-name-tag-ticket-area").appendChild(copy);
                    toggleElements.push(copy);
                    toggleElements.push(oldElement);
                    copy.style.visibility = "hidden";
                    oldElement.id = "this-is-not-in-use";
                    setTimeout(() => {
                        oldElement.remove();
                    }, data.settings.timePerDraw * 500);
                } else {
                    document.getElementById(key + "-name-tag-ticket-area").appendChild(oldElement);
                    oldElement.style.margin = "0 -15px 0 0";
                }
                obj.drawn = true;
            }
        }
    }
    if (!initiated) {
        initiated = true;
        return;
    }

    let drawnTickets = data.drawnTickets.reduce((acc, curr) => {
        if (Object.keys(acc).includes(curr)) {
            acc[curr].amount++;
        } else {
            acc[curr] = {amount: 1}
        }
        return acc;
    }, {});


    setTimeout(() => {
        toggleElements.forEach(a => {
            a.style.visibility = a.style.visibility==="hidden"?"visible":"hidden";
        });
        let index = 0;
        for (let key in drawnTickets) {
            let drawnObjects = Object.keys(ticketObjects)
                .filter(a => a.slice(0, -1) === key)
                .map(a => ticketObjects[a])
                .filter(a => a.drawn);
            for (let i = 0; i < drawnTickets[key].amount; i++) {
                let obj = drawnObjects[drawnObjects.length - i - 1];
                if (obj.animated) return;
                obj.animated = true;
                let element = obj.element;
                let rect = element.getBoundingClientRect();
                element.style.setProperty("--speed", `${data.settings.timePerDraw}s`);
                element.style.setProperty("--start-pos-x", `${obj.rect.x}px`);
                element.style.setProperty("--start-pos-y", `${obj.rect.y}px`);
                element.style.setProperty("--end-pos-x", `${rect.x}px`);
                element.style.setProperty("--end-pos-y", `${rect.y}px`);
                element.style.setProperty("--middle-pos-x", `${(50 + (Math.floor((index + 1) / 2)) * 6 * (((index % 2) * 2) - 1)) - (((1 + data.settings.ticketsPerDraw) % 2) * 3)}vw`);
                element.style.setProperty("--middle-pos-y", "50vh");
                element.classList.add("move");
                index++;
                setTimeout(() => {
                    element.classList.remove("move");
                }, data.settings.timePerDraw * 1000)
            }
        }
    })
}

function createTicketElement(name, i) {
    let div = document.createElement("div");
    div.className = "ticket";
    div.id = `ticket-${name}-${i}`;
    div.appendChild(document.createTextNode(name));
    return div;
}

function showAdminWindow(data) {
    let adminArea = document.getElementById("admin-area");
    adminArea.style.visibility = "visible";

    let area = document.getElementById("participant-area");
    let nameList = data.names.map(a => {
        return {name: a, checked: data.participants.includes(a)}
    });
    nameList.map(a => nameToggle(a)).forEach(a => area.appendChild(a));

    let caret = document.getElementById("caret");
    caret.onclick = () => {
        if (caret.className.includes("bottom")) {
            caret.className = "caret caret-top";
            adminArea.style.bottom = "-27vh";
        } else {
            caret.className = "caret caret-bottom";
            adminArea.style.bottom = "-1vh";
        }
    };

    let settings = Array.from(document.getElementsByClassName("admin-settings"));
    settings.forEach(a => {
        let span = a.querySelector("span");
        let name = a.id.split("-")[1];
        let input = a.querySelector("input");
        input.value = data.settings[name];
        span.textContent = input.value;
        input.onchange = event => {
            let value = event.target.value;
            span.textContent = value;
            let data = {};
            data[name] = Number(value);
            changeSettings(data);
        }
    });
    if (Object.keys(ticketObjects).length > 0) {
        toggleAdminInput(false);
    }
}

function nameToggle(nameData) {
    let div = document.createElement("div");
    let label = document.createElement("label");
    let span = document.createElement("span");
    span.textContent = `${nameData.name}:`;
    label.appendChild(span);
    let input = document.createElement("input");
    input.type = "checkbox";
    input.checked = nameData.checked;
    input.onchange = event => toggleperson(nameData.name, event.target.checked);
    label.appendChild(input);
    div.appendChild(label);
    return div;
}

let toggleperson = (name, value) => {
    fetch("admin/toggleperson", {
        method: "PUT",
        headers: baseHeader(),
        body: JSON.stringify({
            name,
            value,
        })
    })
        .catch(print)
};

let changeSettings = (settings) => {
    fetch("admin/settings", {
        method: "PUT",
        headers: baseHeader(),
        body: JSON.stringify({settings})
    })
        .catch(print)
};

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

let toggleAdminInput = value => Array.from(document.querySelectorAll("#admin-area input")).forEach(a => a.disabled = !value);

let start = () => {
    toggleAdminInput(false);
    fetch("admin/start", {
        method: "PUT",
        headers: baseHeader()
    })
        .catch(print)
};

let reset = () => {
    toggleAdminInput(true);
    fetch("admin/reset", {
        method: "PUT",
        headers: baseHeader()
    })
        .catch(print)
};

function fetchAndUpdateNames() {
    return fetch("participants").then(a => a.json()).then(a => updateNames(a.names));
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
    let ticketAreaWrapper = document.createElement("div");
    ticketAreaWrapper.className = "name-tag-ticket-area-wrapper";
    let ticketArea = document.createElement("div");
    ticketArea.id = name + "-name-tag-ticket-area";
    ticketArea.className = "name-tag-ticket-area";
    ticketArea.style.width = ticketWidth + (ticketsPerPerson - 1) * (ticketWidth - 15) + "px";
    ticketAreaWrapper.appendChild(ticketArea);
    div.appendChild(h6);
    div.appendChild(ticketAreaWrapper);
    return div;
}

document.addEventListener("keydown", event => {
    if (token !== "") return;
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
                showAdminWindow(a)
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