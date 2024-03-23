// Removes the contents of the given DOM element (equivalent to elem.innerHTML = '' but faster)
function emptyDOM (elem) {
    while (elem.firstChild) elem.removeChild(elem.firstChild);
}

// Creates a DOM element from the given HTML string
function createDOM (htmlString) {
    // let template = document.createElement('template');
    let template = document.createElement('template');
    template.innerHTML = htmlString.trim();
    return template.content.firstChild;
}
// example usage
var messageBox = createDOM(
    `<div>
        <span>Alice</span>
        <span>Hello World</span>
    </div>`
);


function sanitize(string) {
    let regexp = /on[a-zA-Z]+="|<\/script>|<script/g;
    return string.replace(regexp, function(match) {
        return match.startsWith("on") ? "censored" : "&lt;script";
    });
}

var Service = {
    origin: window.location.origin,
    getAllRooms: function() {
        const myPromise = new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.open("GET", Service.origin + "/chat");
            xhr.send();

            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    if(xhr.status === 200) {
                        resolve(JSON.parse(xhr.response));
                    } else {
                        reject(new Error(xhr.response));
                    }
                }  else {
                    // Handle other readyStates if needed
                }
            };

            xhr.onerror = function(err) {
                reject(new Error(err));
            }

        });

        return myPromise;
    },

    addRoom: function(data) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
                
            xhr.open("POST", Service.origin + "/chat");
            xhr.setRequestHeader("Content-Type", "application/json");

            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        const newRoom = JSON.parse(xhr.response);
                        resolve(newRoom);
                    } else {
                        reject(new Error(xhr.response));
                    }
                }
            };

            xhr.onerror = function (err) {
                reject(new Error(err));
            };

            xhr.send(JSON.stringify(data));
        });
    },

    getLastConversation: function(roomId, before) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            const queryString = before ? `?before=${before}` : '';
                
            xhr.open("GET", Service.origin + `/chat/${roomId}/messages${queryString}`);
            xhr.setRequestHeader("Content-Type", "application/json");

            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } else {
                        reject(new Error(xhr.response));
                    }
                }
            };

            xhr.onerror = function (err) {
                reject(new Error(err));
            };

            xhr.send();
        });
    },
    getProfile: function () {
        var xmlhr = new XMLHttpRequest();
        xmlhr.open("GET", Service.origin + "/profile");
        xmlhr.send(null);
        return new Promise((resolve, reject)=> {
            xmlhr.onload = function() {
                if (!(xmlhr.status == 200)) {
                    reject(new Error(xmlhr.responseText));
                }
                else {
                    resolve(JSON.parse(xmlhr.responseText));
                }
            }
            xmlhr.onerror = function() {
                reject(new Error(xmlhr.responseText));
            }
            
        });
    }


        
}

class Lobby {
    constructor() {
        this.rooms = {};
    }

    getRoom(roomId) {
        // search through the rooms and return the room with id = roomId if found
        return this.rooms[roomId];
    }

    addRoom(id, name, image, messages) {
        // create a new Room object, using the given arguments, and add the object in the this.rooms array
        this.rooms[id] = new Room(id, name, image, messages);

        // check if this.onNewRoom function is defined
        if (typeof this.onNewRoom === 'function') {
            this.onNewRoom(this.rooms[id]);
        }
    }
}

class LobbyView {
    // create the DOM for the "lobby page"
    constructor(lobby) {
        // lobby page
        this.elem = createDOM (`
            <div class = "content">
                <ul class = "room-list"></ul>

                <div class = "page-control">
                    <input type="text" id="room-name" name="room name">
                    <button type="button">Create Room</button>
                </div>
            </div>`); 
    
        this.listElem = this.elem.querySelector("ul.room-list");
        this.inputElem = this.elem.querySelector("input");
        this.buttonElem = this.elem.querySelector("button");

        this.lobby = lobby;

        this.buttonElem.addEventListener('click', () => this.createNewRoom());
        this.inputElem.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault(); // prevents linebreak
                this.createNewRoom();
            }
        });

        // draw the initial list of rooms
        this.redrawList();

        this.lobby.onNewRoom = (room) => {
            const listItem = createDOM(`<li><a href="#/chat/${room.id}">${room.name}</a></li>`);
            this.listElem.appendChild(listItem)
        }
    }

    redrawList() {
        emptyDOM(this.listElem);

        // dynamically populate the list
        for (const roomId in this.lobby.rooms) {
            const room = this.lobby.rooms[roomId];
            const listItem = createDOM(`<li><a href="#/chat/${roomId}">${room.name}</a></li>`);
            this.listElem.appendChild(listItem);
        }
    
    }

    createNewRoom() {
        const roomName = this.inputElem.value;
        this.inputElem.value = '';

            Service.addRoom({name: roomName, image: ''})
                .then((newRoom) => {
                    this.lobby.addRoom(newRoom._id, newRoom.name, newRoom.image, []);
                })

                // for debugging
                .catch((error) => {
                    console.error('Error creating room:', error.message);
                });
    }
}

class ChatView {
    // create the DOM for the "chat page" 
    constructor(socket) {
        // chat page
        this.elem = createDOM (`
            <div class="content">
                <h4 class="room-name">Room name</h4>

                <div class="message-list">
                    <div class="message">
                        <span class="message-user">user A</span>
                        <span class="message-text">...</span>
                    </div>
                    <div class="message my-message">
                        <span class="message-user">user B</span>
                        <span class="message-text">...</span>
                    </div>

                </div>

                <div class="page-control">
                    <textarea id="message" name="message"></textarea>
                    <button type="button">Send</button>
                </div>
            </div>`); 


        this.titleElem = this.elem.querySelector("h4");
        this.chatElem = this.elem.querySelector("div.message-list");
        this.inputElem = this.elem.querySelector("textarea");
        this.buttonElem = this.elem.querySelector("button");
        
        this.room = null;
        this.buttonElem.addEventListener('click', () => this.sendMessage());
        this.inputElem.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault(); // prevents linebreak
                this.sendMessage();
            }
        });

        this.socket = socket;

        this.chatElem.addEventListener('wheel', (event) => {
            const isAtTop = this.chatElem.scrollTop === 0;
    
            const isScrollingUp = event.deltaY < 0;
    
            const canLoadConversation = this.room.canLoadConversation;
    
            if (isAtTop && isScrollingUp && canLoadConversation) {
                const conversationPromise = this.room.getLastConversation.next().value;
                conversationPromise.then((conversation) => {
                    if (conversation !== null) {
                        this.room.onFetchConversation(conversation);
                    }
                });
            }
        });
    }


    sendMessage() {
        // check if this.room is set before calling addMessage
        if (this.room) {
            this.room.addMessage(profile.username, this.inputElem.value);
            this.inputElem.value = '';
            this.socket.send(JSON.stringify({
                roomId : this.room.id,
                username : profile.username,
                text : this.inputElem.value
            }));
        } else {
            console.error("Room is not set. Cannot send message.");
        }
    }

    setRoom(room) {
        this.room = room;
        this.titleElem.textContent = room.name;
        emptyDOM(this.chatElem);

        // dynamically create message boxes
        this.room.messages.forEach(message => {
            this.createMessageBox(message);
        });

        this.room.onNewMessage = (message) => {
            this.createMessageBox(message);
        }

        this.room.onFetchConversation = (conversation) => {
            const hb = this.chatElem.scrollHeight;

            this.renderMessages(conversation.messages);

            const ha = this.chatElem.scrollHeight;

            this.chatElem.scrollTop = ha - hb;
        };
    }

    renderMessages(messages) {
        messages.slice().reverse().forEach((message) => {
            // <div class="message ${message.username === profile.username ? 'my-message' : ''}">
            const messageBox = createDOM(`
                <div class="message ${message.username === profile.username ? 'message' : ''}">
                    <span class="message-user">${message.username}</span>
                    <span class="message-text">${sanitize(message.text)}</span>
                </div>
            `);

            
            this.chatElem.insertBefore(messageBox, this.chatElem.firstChild);
        });

        this.chatElem.scrollTop = this.chatElem.scrollHeight;
    }

    createMessageBox(message) {
        const messageBox = createDOM(`
            <div class="message ${message.username === profile.username ? 'my-message' : ''}">
                <span class="message-user">${message.username}</span>
                <span class="message-text">${sanitize(message.text)}</span>
            </div>
        `);

        this.chatElem.appendChild(messageBox);

        this.chatElem.scrollTop = this.chatElem.scrollHeight;
    }
}


class ProfileView {
    // create the DOM for the "profile page" 
    constructor() {
        // profile page
        this.elem = createDOM (`
        <div class="content">
            <div class="profile-form">
                <div class="form-field">
                    <label>Username</label>
                    <input type="text" id="message" name="message">

                    <label>Password</label>
                    <input type="password" id="message" name="message">

                    <label>Avatar Image</label>
                    <input type="file" id="message" name="message">

                    <label>About</label>
                    <textarea id="message" name="message"></textarea>

                </div>

            </div>

            <div class="page-control">
                <button type="button">Save</button>
            </div>
        </div>
        `);
    }
}

function* makeConversationLoader(room) {
    let lastFetchedTimestamp = room.creationTime;

    while (room.canLoadConversation) {
        room.canLoadConversation = false;

        yield new Promise((resolve, reject) => {
            Service.getLastConversation(room.id, lastFetchedTimestamp)
            .then((conversation) => {
                if (conversation) {
                    lastFetchedTimestamp = conversation.timestamp;
                    room.canLoadConversation = true;
                    room.addConversation(conversation);
                    resolve(conversation);
                } else {
                    resolve(null);
                }
            });
        });
    }
}

class Room {
    constructor(id, name, image, messages) {
        this.id = id;
        this.name = name;
        this.image = typeof image !== 'undefined' ? image: "assets/everyone-icon.png";
        this.messages = typeof messages !== 'undefined' ? messages :[];
        this.getLastConversation = makeConversationLoader(this);
        this.canLoadConversation = true;
        this.creationTime = Date.now();
    }

    addMessage(username, text) {
        if(text.trim().length == 0){
            return;
        } else {
            let textMessage = {
                username: username,
                text: text,
            };
            this.messages.push(textMessage);

            if (typeof this.onNewMessage === 'function') {
                this.onNewMessage(textMessage);
            }
        }
    }

    addConversation(conversation) {
        this.messages = conversation.messages.concat(this.messages);

        if (this.onFetchConversation) {
            this.onFetchConversation(conversation);
        }
    }
}

function main() {
    let socket = new WebSocket("ws://localhost:8000");
    // let socket = new WebSocket("3.98.223.41:8000");
    socket.addEventListener('message', function(event) {
        var incomingMess = JSON.parse(event.data);
        var selectedRoom = lobby.getRoom(incomingMess.roomId);
        selectedRoom.addMessage(incomingMess.username, incomingMess.text);
    });

    
    let lobby = new Lobby();
    let lobbyView = new LobbyView(lobby);
    let chatView = new ChatView(socket);
    let profileView = new ProfileView();
    
    function renderRoute() {
        let path = window.location.hash;

        let pageview = document.getElementById("page-view");

        if (path=="#/" || path=="") {
		    emptyDOM(pageview);
		    pageview.appendChild(lobbyView.elem);
        }
        else if (path.startsWith("#/chat")) {
            emptyDOM(pageview);
            // extract the room ID
            let roomId = path.substring("#/chat/".length);

            let room = lobby.getRoom(roomId);

            // check if the room exists and is not null
            if (room) {
                chatView.setRoom(room);
                pageview.appendChild(chatView.elem);
            } else {
                console.error(`Room with ID ${roomId} not found.`);
            }
        }
        else if (path.startsWith("#/profile")) {
            emptyDOM(pageview);
		    pageview.appendChild(profileView.elem);
        }
    }

    window.addEventListener("popstate", renderRoute);
    renderRoute();

    function refreshLobby() {

        Service.getAllRooms()
            .then(function(roomsFromServer) {
                roomsFromServer.forEach(function(room) {
                    if (lobby.rooms.hasOwnProperty(room._id)) {
                        lobby.rooms[room._id].name = room.name;
                        lobby.rooms[room._id].image = room.image;
                    } else {
                        lobby.addRoom(room._id, room.name, room.image, room.messages);
                    }
                });
            });
    }
    refreshLobby();
    setInterval(refreshLobby, 6000);


    Service.getProfile().then(
        (result) => {
            profile = result;
        },
        (error) => {
            console.log(error);
        }
    )


    cpen322.export(arguments.callee, { lobby, chatView });

}

window.addEventListener("load", main);

var profile = {
    username: "Baymax"
};

cpen322.setDefault(testRoomId, 'room-1')
cpen322.setDefault(cookieName, 'cpen322-session')
cpen322.setDefault(testUser1, { username: 'alice', password: 'secret', saltedHash: '1htYvJoddV8mLxq3h7C26/RH2NPMeTDxHIxWn49M/G0wxqh/7Y3cM+kB1Wdjr4I=' })
cpen322.setDefault(testUser2, { username: 'bob', password: 'password', saltedHash: 'MIYB5u3dFYipaBtCYd9fyhhanQkuW4RkoRTUDLYtwd/IjQvYBgMHL+eoZi3Rzhw=' })
cpen322.setDefault(image, 'assets/everyone-icon.png')
cpen322.setDefault(webSocketServer, 'ws://localhost:8000')