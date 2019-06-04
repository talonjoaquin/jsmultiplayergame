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

var playerspeed = 0.08;
var npspeed = 0.05;
var NPCLIM = 100;
var aggroRange = 150000;

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
        speedCoeff: 1.0,
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
            speedCoeff: 1.0
        };
    });
    socket.on('movement', function(data){
        var player = players[socket.id] || {};
        player.left = data.left;
        player.right = data.right;
        player.up = data.up;
        player.down = data.down;
    });
    socket.on('disconnect', function(){
        delete players[socket.id];
    })
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
        var playerId = -1;
        for(var pid in players){
            var player = players[pid];
            var tempDist = (player.x - npc.x)*(player.x - npc.x)+(player.y - npc.y)*(player.y - npc.y);
            if(tempDist < distToPlayer){
                distToPlayer = tempDist;
                chasedPlayer = player;
                playerId = pid;
            }
        }
        npc.speedCoeff += (1.0 - npc.speedCoeff) / 20;
        if(chasedPlayer != undefined && distToPlayer < aggroRange){
            npc.wanderlust = 0;
            var angleToPlayer = Math.atan2((chasedPlayer.y - npc.y), (chasedPlayer.x - npc.x));
            var proximitySpeedCoeff = Math.max(0, (aggroRange - distToPlayer)/aggroRange);
            npc.x += Math.cos(angleToPlayer) * npspeed * timeDifference * proximitySpeedCoeff * npc.speedCoeff;
            npc.y += Math.sin(angleToPlayer) * npspeed * timeDifference * proximitySpeedCoeff * npc.speedCoeff;
            if(distToPlayer <= 16){
                chasedPlayer.health -= 0.1 * timeDifference;
                chasedPlayer.speedCoeff = 0.25;
                if(chasedPlayer.health <= 0){
                    delete players[playerId];
                }
                npc.speedCoeff = 0.01;
            }
        }else{
            if(npc.wanderlust > 0){
                npc.wanderlust--;
                npc.x += Math.cos(npc.wanderang) * npspeed * timeDifference * 0.25 * npc.speedCoeff;
                npc.y += Math.sin(npc.wanderang) * npspeed * timeDifference * 0.25 * npc.speedCoeff;
                if(npc.x > 1600 || npc.x < -200){
                    npc.wanderang = Math.PI - npc.wanderang;
                }
                if(npc.y > 1100 || npc.y < -200){
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
        player.speedCoeff += (1.0 - player.speedCoeff) / 10;
        if(player.left){
            player.x -= playerspeed * timeDifference * player.speedCoeff;
        }
        if(player.right){
            player.x += playerspeed * timeDifference * player.speedCoeff;
        }
        if(player.up){
            player.y -= playerspeed * timeDifference * player.speedCoeff;
        }
        if(player.down){
            player.y += playerspeed * timeDifference * player.speedCoeff;
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