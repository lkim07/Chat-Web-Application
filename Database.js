const { MongoClient, ObjectId } = require('mongodb');	// require the mongodb driver

/**
 * Uses mongodb v6.3 - [API Documentation](http://mongodb.github.io/node-mongodb-native/6.3/)
 * Database wraps a mongoDB connection to provide a higher-level abstraction layer
 * for manipulating the objects in our cpen322 app.
 */
function Database(mongoUrl, dbName) {
	if (!(this instanceof Database)) return new Database(mongoUrl, dbName);
	this.connected = new Promise((resolve, reject) => {
		const client = new MongoClient(mongoUrl);

		client.connect()
		.then(() => {
			console.log('[MongoClient] Connected to ' + mongoUrl + '/' + dbName);
			resolve(client.db(dbName));
		}, reject);
	});
	this.status = () => this.connected.then(
		db => ({ error: null, url: mongoUrl, db: dbName }),
		err => ({ error: err })
	);
}

Database.prototype.getRooms = function() {
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			if(db){
				resolve(db.collection('chatrooms').find().toArray());
			}else{
				reject('No database connection');
			}


		})
	)
}


Database.prototype.getRoom = function(room_id) {
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			const roomId = (typeof room_id === 'object' || room_id.length !== 24) ? room_id : new ObjectId(room_id);
	
			db.collection('chatrooms').findOne({ _id: roomId })
				.then(room => resolve(room))
				.catch(err => reject(err));


		})
	)
}

Database.prototype.addRoom = function(room) {
	return this.connected.then(db => 
		new Promise((resolve, reject) => {
			if (!room.name || room.name.trim().length === 0) return reject('name field required');
			db.collection('chatrooms').insertOne(room)
			.then(
				() => db.collection('chatrooms').findOne(room)
				.then(room => {
					resolve(room);
				}
			))
			.catch(err => reject(err));
		})
	)
}



Database.prototype.getLastConversation = function(room_id, before) {
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			if (db) {
				if (!before) before = Date.now();
				
				const query = { room_id: room_id, timestamp: { $lt: before } }
				const options = {
				  sort: { timestamp: -1 }
				}

			  	db.collection('conversations')
          			.find(query, options)
          			.toArray()
          			.then(conversations => {
            			if (conversations.length > 0) {
              				resolve(conversations[0]);
            			} else {
              				resolve(null);
            			}
          			})
          			.catch(err => {
            			reject(err);
          			});
      		} else {
        		reject('No database connection');
      		}

		})
	)
}


Database.prototype.addConversation = function(conversation) {
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			const {room_id, timestamp, messages} = conversation;

			if (!room_id || !timestamp || !messages) return reject('one or more of {room_id, timestamp, messages} is missing');

			db.collection('conversations').insertOne(conversation)
				.then(
					() => db.collection('conversations').findOne({
						room_id: conversation.roomId,
						timestamp: conversation.timestamp
					})
					.then(() => {
						resolve(conversation);
					})
					.catch(err => reject(err))
				)
				.catch(err => reject(err));
		})
	)
}

Database.prototype.getUser = function(username) {
	return this.connected.then(db => 
		new Promise((resolve, reject) => {
			// Query the database for a user with the given username
			db.collection('users').findOne({ username })
			.then((user) => {
				resolve(user);
			})
			.catch(err => reject(null));
		})
	)
}

module.exports = Database;
