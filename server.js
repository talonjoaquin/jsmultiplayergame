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

var playerspeed = 0.1;
var npspeed = 0.05;
var NPCLIM = 100;

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

var lastUpdateTime = (new Date()).getTime();

setInterval(function(){
    //update state
    var currentTime = (new Date()).getTime(); 
    var timeDifference = currentTime - lastUpdateTime;
    for(var id in ais){
        var npc = ais[id];
        var distToPlayer = Infinity;
        var chasedPlayer = undefined;
        for(var pid in players){
            var player = players[pid];
            var tempDist = (player.x - npc.x)*(player.x - npc.x)+(player.y - npc.y)*(player.y - npc.y);
            if(tempDist < distToPlayer){
                distToPlayer = tempDist;
                chasedPlayer = player;
            }
        }
        if(chasedPlayer != undefined){
            var angleToPlayer = Math.atan2((chasedPlayer.y - npc.y), (chasedPlayer.x - npc.x));
        
            npc.x += Math.cos(angleToPlayer) * npspeed * timeDifference;
            npc.y += Math.sin(angleToPlayer) * npspeed * timeDifference;
        }
    }
    for (var id in players){
        var player = players[id];
        if(player.left){
            player.x -= playerspeed * timeDifference;
        }
        if(player.right){
            player.x += playerspeed * timeDifference;
        }
        if(player.up){
            player.y -= playerspeed * timeDifference;
        }
        if(player.down){
            player.y += playerspeed * timeDifference;
        }
    }

    actors = {
        pcs: players,
        npcs: ais
    }
    io.sockets.emit('state', actors);
    //console.log(actors);
    lastUpdateTime = currentTime;
}, 1000 / 60);