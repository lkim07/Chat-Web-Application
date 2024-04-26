const crypto = require('crypto');

class SessionError extends Error {};

function SessionManager () {
	// default session length - you might want to
	// set this to something small during development
	const CookieMaxAgeMs = 600000;

	// keeping the session data inside a closure to keep them protected
	const sessions = {};

	// might be worth thinking about why we create these functions
	// as anonymous functions (per each instance) and not as prototype methods
	this.createSession = (response, username, maxAge = CookieMaxAgeMs) => {
		// Generate a random string token
		const tokenLength = 32; // You can adjust the length of the token
		const token = crypto.randomBytes(tokenLength).toString('hex');

		// Calculate the strength of the generated token
		const tokenStrength = this.strength(token);

		// Create a session object with username and metadata
		const sessionData = {
			username,
			createdTimestamp: Date.now(),
			expiryTimestamp: Date.now() + maxAge,
			tokenStrength,
		};

		// Store the session object in the sessions dictionary
		sessions[token] = sessionData;

		// Set the Set-Cookie header using response.cookie()
		response.cookie('cpen322-session', token, { maxAge });

		// Schedule deletion of the session after maxAge milliseconds
		setTimeout(() => {
			delete sessions[token];
		}, maxAge);
	};

	this.deleteSession = (request) => {
		/* To be implemented */
		delete request.username;
        delete sessions[request.session];
        delete request.session;
	};

	this.middleware = (request, response, next) => {
		// Try to read the cookie information from the request
        const cookieHeader = request.headers.cookie;
		


        if (!cookieHeader) {
            // If the cookie header was not found, short-circuit the middleware
            next(new SessionError('Cookie not found'));
            return;
        }

        // Parse the cookie header to extract the token (cookie value)
        const cookieArray = cookieHeader.split(';').map(pair => pair.trim().split('='));
        const cookieObject = Object.fromEntries(cookieArray);

        const token = cookieObject['cpen322-session'];

        if (!token || !(token in sessions)) {
            // If the token is not found or the session does not exist, short-circuit the middleware
            next(new SessionError('Invalid session token'));
            return;
        }

        // If the session exists, assign the username and session properties to the request object
        request.username = sessions[token].username;
        request.session = token;

        // Call next with zero arguments to trigger the next middleware
        next();
	};

	// this function is used by the test script.
	// you can use it if you want.
	this.getUsername = (token) => ((token in sessions) ? sessions[token].username : null);

	// Helper function to calculate the strength of a token
	this.strength = (token) => {
		const shannonEntropy = (s) => {
			return [...new Set(s.split(''))]
				.map(c => s.split(c).length - 1)
				.reduce((n, c) => n - c / s.length * Math.log2(c / s.length), 0);
		};

		return shannonEntropy(token) * token.length;
	};
};

// SessionError class is available to other modules as "SessionManager.Error"
SessionManager.Error = SessionError;

module.exports = SessionManager;