
const express = require('express')
	, logger = require('morgan')
	;



const kPort = process.env.PORT || 3012;

var app = express();

// configure Express
app.use(express.static(__dirname));
// favicon
app.use(logger('dev', { skip: function (req, res) { return res.statusCode < 400 } }));

app.disable('x-powered-by');

// api
app.use('/', (req, res) => res.sendFile('index.html'));

app.listen(kPort, async function() {
	console.log('Express server listening on port', kPort);
});
