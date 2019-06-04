var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');

var app = express();
var server = http.Server(app);
var io = socketIO(server);

var actors = {};
var players = {};
var ais = {};

var playerspeed = 5;
var NPCLIM = 10;

app.set('port', 5000);
app.use('/static', express.static(__dirname + '/static'));

app.get('/', function(request, response){
    response.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(5000, function(){
    console.log('Starting server on port 5000');
});

for (var i = 0; i < NPCLIM; i++){
    ais[i] = {
        x: Math.floor(Math.random() * 1400),
        y: Math.floor(Math.random() * 900)
    }
}

io.on('connection', function(socket){
    socket.on('new player', function(){
        console.log("New connection");
        players[socket.id] = {
            x: 300,
            y: 300,
            left: false,
            right: false,
            up: false,
            down: false,
            active: false
        };
    });
    socket.on('movement', function(data){
        var player = players[socket.id] || {};
        player.left = data.left;
        player.right = data.right;
        player.up = data.up;
        player.down = data.down;
    });
});

setInterval(function(){
    //update state



    actors = {
        pcs: players,
        npcs: ais
    }
    io.sockets.emit('state', actors);
    //console.log(actors);
}, 1000 / 60);