const path = require('path');
const express = require('express');
const ws = require('ws');
const Database = require('./Database')
const SessionManager = require('./SessionManager');
const crypto = require('crypto');
const axios = require('axios');

// let mongoUrl = 'mongodb://localhost:27017'; 
let mongoUrl = 'mongodb://127.0.0.1:27017';
let dbName = 'cpen322-messenger';
let db = new Database(mongoUrl, dbName);
const sessionManager = new SessionManager();

let messages = {};
let messageBlockSize = 10; // 

db.getRooms().then(rooms => {
	for (let room of rooms) {
	  	messages[room._id] = [];
	}
});

function logRequest(req, res, next){
	console.log(`${new Date()}  ${req.ip} : ${req.method} ${req.path}`);
	next();
}

const host = 'localhost';
const port = 3000; 
const clientApp = path.join(__dirname, 'client');

const broker = new ws.Server({port: 8000});
db.getRooms().then(
    (resolve) => {
        for (let room of resolve) {
            messages[room._id] = [];
        }
    },
    (reject) => {}
);

// express app
let app = express();
app.use(express.json()) 						// to parse application/json
app.use(express.urlencoded({ extended: true })) // to parse application/x-www-form-urlencoded
app.use(logRequest);

app.route('/login').post(
	function (req, res, next) {
		db.getUser(req.body.username).then(
			(resolve) => {
				if (resolve != null && isCorrectPassword(req.body.password, resolve.password)) {
					sessionManager.createSession(res, resolve.username);
					res.redirect('/');
				}
				else
					res.redirect('/login');
			},
			(reject) => {}
		);
	}
)

app.route('/logout').get(
	function (req, res, next) {
		sessionManager.deleteSession(req);
		res.redirect('/login');
	}
)

app.route('/chat/:room_id/messages').all(sessionManager.middleware).get(
    function (req, res, next) {
        var id = req.params['room_id'];
        var before = req.query['before'];
        db.getLastConversation(id, before).then(
            (resolve) => {
                if(resolve != null) {
                    res.status(200);
                    res.send(resolve);
                }
                else {         
                    res.status(404);
                    res.send(resolve);
                }
            },
            (reject) => {}
        );
    }
)

app.route('/chat/:room_id').all(sessionManager.middleware).get(
    function (req, res, next) {
        var id = req.params['room_id'];
        var room = db.getRoom(id)
        room.then(
            (resolve) => {
                if (resolve != null) {
                    res.status(200);
                    res.send(resolve);
                }
                else {
                    res.status(404);
                    res.send(new Error('Room ' + id + ' was not found'));
                }
            },
            (reject) => {}
        );
    }
)

app.route('/chat').all(sessionManager.middleware)
    .get(function (req, res, next) {
          var ObjsArr = [];
          db.getRooms().then((resolve)=>{
              for(var room of resolve){
                  var innerObj  = {};
                  innerObj["_id"] = room._id; 
                  innerObj["name"] = room.name; 
                  innerObj["image"] = room.image; 
                  innerObj["messages"] = messages[room._id]; 
                  ObjsArr.push(innerObj);
              }
              res.send(ObjsArr)
          })
    })
    .post (function (req, res, next) {
        var arg = (req.body);
        var ar_retval = db.addRoom(arg);
        ar_retval.then(
            (resolve) => {
                messages[resolve._id] = [];
                res.status(200);
                res.send(resolve);
            },
            (reject) => {
                res.status(400);
                res.send(reject);
            }
        );
    })

app.get('/profile', sessionManager.middleware, (req, res) => {

    res.send({
      username: req.username
    })
  })
  
app.route('/app.js').get(sessionManager.middleware);

app.route('/index.html').get(sessionManager.middleware);

app.route('/index').get(sessionManager.middleware); 

app.route('/').get(sessionManager.middleware); 

// serve static files (client-side)
app.use('/', express.static(clientApp, { extensions: ['html'] }));

app.listen(port, () => {
	console.log(`${new Date()}  App Started. Listening on ${host}:${port}, serving ${clientApp}`);
});
	
app.use(function (err, req, res, next) {
	if(err instanceof SessionManager.Error) {
		if(req.headers.accept === 'application/json') {
			res.status(401);
            res.send(new Error('ERROR!'));
		}
		else {
			res.redirect('/login');
		}
	}
	else {
		res.status(500);
        res.send(new Error('ERROR!'));
    }
})

broker.on('connection', function connection(ws, incomingMessage) {
	if (incomingMessage.headers.cookie == undefined) {
		ws.close();
		return;
	}
    
    var cookie = incomingMessage.headers.cookie.split('=')[1];
    
	if(sessionManager.getUsername(cookie) == null) {
		ws.close();
		return;
    }
    
	ws.on('message', async (data) => {
        var hasSummary = false;
		var msg = JSON.parse(data);
        // To check the sent pdf file. (It can receive .pdf, .docx, .txt)
        // console.log('File received:', msg);

        // Check if message is a file
        if ('file' in msg) {
            const formData = new FormData();
            formData.append('file', msg.file.data);

            if (msg.file.type == 'application/pdf') {
                // await axios.post('http://127.0.0.1:3001/process_pdf', formData)
                await axios.post('http://localhost:3001/process_pdf', formData)
                    .then((response) => {
                        msg.text = response.data.data;
                    })
                    .catch((error) => {
                        console.error('Error:', error);
                        return;
                    });
            } else {
                // await axios.post('http://127.0.0.1:3001/process_file', formData)
                await axios.post('http://localhost:3001/process_file', formData)
                    .then((response) => {
                        msg.text = response.data.data;
                    })
                    .catch((error) => {
                        console.error('Error:', error);
                        return;
                    });
            }

            hasSummary = true;
        } else {
            msg.text = sanitize(msg.text);

            videoId = extractYouTubeVideoId(msg.text);
            if (videoId) {
                // Send video ID to Python server
                await axios.get('http://localhost:3001/process_video', {
                    params: {
                        videoId: videoId
                    }
                })
                .then(function (response) {
                    msg.text = `https://www.youtube.com/watch?v=${videoId}\n${response.data.data}`;
                })
                .catch(function (error) {
                    console.error(error);
                    return;
                });
                
                hasSummary = true;
            }
        }
        
        // msg.text = summary
        console.log("MSG text: \n" + JSON.stringify(msg.text));

        msg.username = sessionManager.getUsername(cookie);

		broker.clients.forEach((client) => {
			if (client != ws) {
				client.send(JSON.stringify(msg));
			}
		})

		var msgObj = {};
		msgObj["username"] = sessionManager.getUsername(cookie);
		msgObj["text"] = msg.text;
		messages[msg.roomId].push(msgObj);

        if (messages[msg.roomId].length == messageBlockSize) {
            var conv = {
                'room_id' : msg.roomId,
                'timestamp' : Date.now(),
                'messages' : messages[msg.roomId]
            }
            db.addConversation(conv).then(
                (resolve) => messages[msg.roomId] = [],
                (reject) => {}
            );
        }

        msg.username = msgObj["username"];

        if (hasSummary) ws.send(JSON.stringify({ message: msg }));
	})
})
  
function isCorrectPassword(password, saltedHash) {
    let salt = saltedHash.substring(0, 20)
    let base64Hash = saltedHash.substring(20)
    let saltedPassword = password + salt
    let encryptedPassword = crypto.createHash('sha256').update(saltedPassword).digest('base64')
    return encryptedPassword === base64Hash
}

function sanitize(string) {
    if (typeof string === 'string') {
        let regexp = /on[a-zA-Z]+="|<\/script>|<script/g;
        return string.replace(regexp, function(match) {
            return match.startsWith("on") ? "censored" : "&lt;script";
        });
    } else {
        return '';
    }
}

function extractYouTubeVideoId(string) {
    // Regular expression to match YouTube URLs
    var youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    
    // Check if the URL matches the YouTube URL pattern
    var match = string.match(youtubeRegex);
    
    // If there is a match, extract and return the video ID
    if (match && match[1]) {
        return match[1];
    } else {
        return null; // Return null if no match found
    }
}