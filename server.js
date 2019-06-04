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
var aggroRange = 200000;

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
        y: Math.floor(Math.random() * 900),
        wanderlust: 0,
        wanderang: 0
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
            health: 100,
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
        if(chasedPlayer != undefined && distToPlayer < aggroRange){
            npc.wanderlust = 0;
            var angleToPlayer = Math.atan2((chasedPlayer.y - npc.y), (chasedPlayer.x - npc.x));
            var proximitySpeedCoeff = Math.max(0, (aggroRange - distToPlayer)/aggroRange);
            npc.x += Math.cos(angleToPlayer) * npspeed * timeDifference * proximitySpeedCoeff;
            npc.y += Math.sin(angleToPlayer) * npspeed * timeDifference * proximitySpeedCoeff;
            if(distToPlayer <= 4){
                player.health -= 10;
            }
        }else{
            if(npc.wanderlust > 0){
                npc.wanderlust--;
                npc.x += Math.cos(npc.wanderang) * npspeed * timeDifference * 0.25;
                npc.y += Math.sin(npc.wanderang) * npspeed * timeDifference * 0.25;
                if(npc.x > 1400 || npc.x < 0){
                    npc.wanderang = Math.PI - npc.wanderang;
                }
                if(npc.y > 900 || npc.y < 0){
                    npc.wanderang = Math.PI * 2 - npc.wanderang;
                }
            }else{
                npc.wanderlust = Math.floor(Math.random() * 1000) + 100;
                npc.wanderang = Math.random() * 2 * Math.PI;  
            }
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