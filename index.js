var sip = require('sip');

// Trim leading and trailing whitespace from string values.
function trim(str) {
	return str.replace(/^\s+|\s+$/g, '');
}

function createClient() {
	const data = {};

	return {
		set(key, value) {
			// console.log("SET", key, value);
			data[key] = value;
		},
		del(key) {
			delete data[key]
		},
		get(key, callback) {
			// console.log("GET", key, data[key]);
			if (callback) {
				return callback(undefined, data[key] || null);
			}
			return data[key];
		},
		quit() {

		}
	};
}

var client = createClient();

console.log(sip);

sip.start({
	ws_port: 7443,
}, function(request) {
	console.log(request);

	try {
		var address = sip.parseUri(request.headers.to.uri);

		// Create a redis client to manage the registration info.

		// Handle SIP Registrations.
		if (trim(request.method) == 'REGISTER') {
			var contact = request.headers.contact;
			
			if (Array.isArray(contact) 
					&& contact.length 
					&& (+(contact[0].params.expires || request.headers.expires || 300)) > 0 )
			{
				console.log('Registering user ' + address.user + ' at ' + contact[0].uri);
				// Store the registration info.
				client.set(address.user, contact[0].uri);
			} else {
				console.log('Logging off user ' + request.headers.to.name);
				client.del(address.user);
			}

			// Build the response to the SIP user.
			var response = sip.makeResponse(request, 200, 'OK');

			// Send the response to the SIP client
			sip.send(response);

		}

		// Handle SIP Invites
		if (trim(request.method) == 'INVITE') {
			sip.send(sip.makeResponse(request, 100, 'Trying'));
			
			address = sip.parseUri(request.uri);

			client.get(address.user, function(err, contact) {
				if(err || contact === null) {
					console.log('User ' + address.user + ' is not found');
					sip.send(sip.makeResponse(request, 404, 'Not Found'));
				} else {
					console.log('User ' + address.user + ' is found at ' + contact);
				
					var response = sip.makeResponse(request, 302, 'Moved Temporarily');
					response.headers.contact = [{ uri: contact }];
					sip.send(response);
				}
			});
		}

		// Handle SIP Message
		if (trim(request.method) == 'MESSAGE') {
			address = sip.parseUri(request.uri);
			// console.log(request.headers.via)
			request.headers.via.unshift("1231231231312312312")
			console.log(sip.stringify(request));

			client.get(address.user, function(err, contact) {
				if(err || contact === null) {
					console.log('User ' + address.user + ' is not found');
					sip.send(sip.makeResponse(request, 404, 'Not Found'));
				} else {
					console.log('User ' + address.user + ' is found at ' + contact);
					// const response = sip.makeResponse(request, 200, 'Ok');
					request.headers['max-forwards'] = '69';
					request.headers.via = [{ uri: contact }];
					request.headers.contact = [{ uri: contact }];
					sip.send(request)
					// var response = sip.makeResponse(request, 302, 'Moved Temporarily');
				}
			});
		}
	} catch(e) {
		console.error('Exception ' + e + ' at ' + e.stack);
		sip.send(sip.makeResponse(request, 500, 'Internal Server Error'));
	}
});