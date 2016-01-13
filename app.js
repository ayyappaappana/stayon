var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');


require('./models/user')(mongoose);
require('./models/media')(mongoose)
require('./models/widget')(mongoose)
require('./models/displays')(mongoose)
require('./models/device')(mongoose);
require('./models/playlist')(mongoose);
require('./models/schedular')(mongoose);
require('./models/socketsink')(mongoose);


var routes = require('./routes/index');
var users = require('./routes/users');
var media = require('./routes/media');
var widget = require('./routes/widget');
var display = require('./routes/displays');
var device = require('./routes/deviceinfo');
var playlist = require('./routes/playlist');
var schedular = require('./routes/schedular');

var debug = require('debug')('stayon:server');
var http = require('http');

var app = express();

var port = normalizePort(process.env.PORT || '3000');

var server = http.createServer(app);
var global = require('./config/global.js');
var io = require('socket.io')(server);
global.io = io;
io.set('transports', ['polling', 'websocket']);


mongoose.connect('mongodb://localhost:27017/stay-on');

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback() {
    "use strict";
    console.log("mongo connected");
});
//require('./models/user.js')(mongoose);
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(function(req, res, next) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With,Content-Type,Accept,Authorization');
    res.header("Content-Type", 'application/json');
    next();
});

app.use(require('skipper')());

app.use('/', routes);
app.use('/users', users);
app.use('/media', media);
app.use('/widget', widget);
app.use('/display', display);
app.use('/device', device);
app.use('/playlist', playlist);
app.use('/schedular', schedular);


// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});



/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
    var port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }

    var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
    console.log('Listening on ' + bind);
}

/// Socket Connection:


var devices = [];
var Socketsink = mongoose.model('Socketsink');


io.sockets.on('connection', function(socket) {

    socket.on('clientsocket', function(data) {
        //var sockets = {};

        console.log("before---" + socket.id);
        this_user_id = data.sockitpin;
        data.socketid = socket.id;
        socket.userid = this_user_id;
        socket.id = this_user_id;

        var socketsink = new Socketsink(data);

        socketsink.save(function(err, sinking) {
            console.log(sinking);
        });

        console.log(this_user_id, 'client id');
        if (!(this_user_id in global.clients)) {
            global.clients[this_user_id] = socket;
            console.log('client connected..');
        } else {
            console.log('client exist');
        };
        console.log("after---" + socket.id);
        global.clients[this_user_id].emit('ping');

    });

    //New Devices
    socket.on('newdisplay', function(data) {
        console.log("1--- New Dissplay");
        console.log(data);
        var Display = mongoose.model('Display');
        Display.find({
            "random_key": data.sockitpin
        }, function(err, displays) {
            socket.emit('newdisplayupdated', displays);
        });
    });

    socket.on('availableschedules', function(data) {
        console.log("Schedules Loading");
        console.log(data);
        var Schedular = mongoose.model('Schedular');
        console.log("Available Schedules");
        console.log(data);
        Schedular.find({
            displays: {
                "$in": [data.displayid]
            }
        }, function(err, schedular) {
            socket.emit("sendschedules", schedular);
        });
    });

    socket.on('availablecampaigns', function(data) {
        //FetchPlaylist
        console.log("Playlist Loading");
        console.log(data);
        var Playlist = mongoose.model('Playlist');
        Playlist.find({
            "_id": data.playlistid
        }, function(err, playlists) {
            console.log(playlists);
            socket.emit('sendcampaigns', playlists);
        });
    });


    socket.on('disconnect', function(data) {
        console.log('disconnect');
        console.log(data);
    });

    socket.on('pong', function(data) {
        console.log("Pong received from client(" + socket.id + ")");
    });



});




function sendHeartbeat() {
    io.sockets.emit('ping', {
        beat: 1
    });
}

setInterval(sendHeartbeat, 80000);



module.exports = app;
