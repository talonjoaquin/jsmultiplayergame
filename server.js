var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');

var app = express();
var server = http.Server(app);
var io = socketIO(server);

var actors = {};
var players = {};
var ais = [];
var corpses = [];
var buildings = [];
var rifle = {
    reload: 4,
    damage: 1.2,
    speed: 1.4,
    range: 100,
    bulletsize: 1,
    bullettrail: 8,
    kickback: 2,
    coneMod: 0,
    spreadMod: 0
};

var shotgun = {
    reload: 30,
    damage: 2,
    speed: 1.4,
    range: 12,
    bulletsize: 4,
    bullettrail: 20,
    kickback: 4,
    coneMod: 1,
    spreadMod: 1
};

var cspeedmod = 1.5;
var playerspeed = 0.12 * cspeedmod;
var speedlim = 6;
var push = 16;
var npspeed = 0.12 * cspeedmod;
var NPCLIM = 200;
var aggroRange = 300000;

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
        x: 5000 + Math.random() * 1000 - Math.random() * 1000,
        y: 5000 + Math.random() * 1000 - Math.random() * 1000,
        pushx: 0,
        pushy: 0,
        speedCoeff: 1.0,
        wanderlust: 0,
        wanderang: 0,
        health: 100,
        natspeed: 1.0,
        aipackage: 'gloop'
    }
}
var cityplan = [];
for (var y = 0; y < 20; y++){
    for(var x = 0; x < 20; x++){
        cityplan[x + y * 20] = (Math.random() > -0.1);
        
    }
}
var currX = 0;
var currY = 0;
for (var iy = 0; iy < 20; iy++){
    for(var ix = 0; ix < 20; ix++){
        if(cityplan[ix + iy * 20]) {
            console.log(currX + " " + currY);
            buildings.push({
                x: currX,
                y: currY,
                w: 500,
                h: 500
            });
        }
        currX += 500;
        if((ix+1) % 2 == 0){
            currX += 100;
        }else{
            currX += 50;
        }
        if(currX >= 550 * 20 + 50 * 20 / 2){
            currX = 0;
            currY += 500;
            if((iy+1) % 2 == 0){
                currY += 100;
            }else{
                currY += 50;
            }
        }
    }
    
}
io.on('connection', function(socket){
    socket.on('new player', function(){
        console.log("New connection");
        players[socket.id] = {
            x: 5000,
            y: 5000,
            left: false,
            right: false,
            up: false,
            down: false,
            clicked: false,
            mousex: 0,
            mousey: 0,
            health: 100,
            shotcycle: 0,
            gun: Math.random() > 0.5 ? rifle : shotgun,
            bullets: [],
            speedCoeff: 1.0,
            pushx: 0,
            pushy: 0
        };
    });
    socket.on('movement', function(data){
        var player = players[socket.id] || {};
        player.left = data.left;
        player.right = data.right;
        player.up = data.up;
        player.down = data.down;
    });
    socket.on('mouse', function(data){
        var player = players[socket.id] || {};
        player.mousex = data.x;
        player.mousey = data.y;
        player.clicked = data.clicked;
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
            for(var i = 0; i < player.bullets.length; i++){
                var bullet = player.bullets[i];
                if(bullet == undefined){
                    continue;
                }
                if(Math.abs(bullet.x - npc.x) > 400 || Math.abs(bullet.y - npc.y) > 400){
                    continue;
                }
                /*if(Math.abs(Math.atan2(bullet.y - npc.y, bullet.x - npc.x) - bullet.ang) > Math.PI){
                    continue;
                }*/
                var bulletsize = 1.5 * (4 * 1.4 * player.gun.bulletsize * ((1.0 + player.gun.spreadMod * 2.0 * (player.gun.range - bullet.lifetime) / player.gun.range)));
                if((bullet.y - npc.y) * (bullet.y - npc.y) + (bullet.x - npc.x)*(bullet.x - npc.x) < bulletsize * bulletsize){
                    npc.health -= player.gun.damage * timeDifference;
                    npc.pushx += Math.cos(bullet.ang) * player.gun.kickback * 5;
                    npc.pushy += Math.sin(bullet.ang) * player.gun.kickback * 5;
                    if(npc.health <= 0){
                        corpses.push({
                            x: npc.x,
                            y: npc.y,
                            pushx: npc.pushx,
                            pushy: npc.pushy,
                            aipackage: npc.aipackage
                        });
                        ais[id] = {
                            x: 0,
                            y: 0,
                            pushx: 0,
                            pushy: 0,
                            speedCoeff: 1.0,
                            wanderlust: 0,
                            wanderang: 0,
                            health: 100,
                            natspeed: 1.0,
                            aipackage: 'gloop'
                        };
                        var intheclear = false;
                        while(!intheclear){
                            intheclear = true;
                            for(var pid in players){
                                var camera = players[pid];
                                if(Math.abs(ais[id].x - camera.x) <= 720 && Math.abs(ais[id].y - camera.y) <= 470){
                                    intheclear = false;
                                }
                                if(!intheclear){
                                    ais[id].x = (Math.random() > 0.5 ? (Math.floor(camera.x - 700 - 100 - Math.random() * 100)) : (Math.floor(camera.x + 700 + 100 + Math.random() * 100)));
                                    ais[id].y = (Math.random() > 0.5 ? (Math.floor(camera.y - 450 - 100 - Math.random() * 100)) : (Math.floor(camera.y + 450 + 100 + Math.random() * 100)));
                                }
                            
                            }  
                        }
                        break;
                    }
                }else if((bullet.y - Math.sin(bullet.ang) * 2 * player.gun.bullettrail - npc.y) * (bullet.y - Math.sin(bullet.ang) * 2 * player.gun.bullettrail - npc.y) + (bullet.x - Math.cos(bullet.ang) * 2 * player.gun.bullettrail - npc.x)*(bullet.x - Math.cos(bullet.ang) * 2 * player.gun.bullettrail - npc.x) < bulletsize * bulletsize){
                    //ais.splice(id, 1);
                    npc.health -= player.gun.damage * timeDifference;
                    npc.pushx += Math.cos(bullet.ang) * player.gun.kickback * 5;
                    npc.pushy += Math.sin(bullet.ang) * player.gun.kickback * 5;
                    if(npc.health <= 0){
                        corpses.push({
                            x: npc.x,
                            y: npc.y,
                            pushx: npc.pushx,
                            pushy: npc.pushy,
                            aipackage: npc.aipackage
                        });
                        ais[id] = {
                            x: 0,
                            y: 0,
                            pushx: 0,
                            pushy: 0,
                            speedCoeff: 1.0,
                            wanderlust: 0,
                            wanderang: 0,
                            health: 100,
                            natspeed: 1.0,
                            aipackage: 'gloop'
                        };
                        var intheclear = false;
                        while(!intheclear){
                            intheclear = true;
                            for(var pid in players){
                                var camera = players[pid];
                                if(Math.abs(ais[id].x - camera.x) <= 720 && Math.abs(ais[id].y - camera.y) <= 470){
                                    intheclear = false;
                                }
                                if(!intheclear){
                                    ais[id].x = (Math.random() > 0.5 ? (Math.floor(camera.x - 700 - 100 - Math.random() * 100)) : (Math.floor(camera.x + 700 + 100 + Math.random() * 100)));
                                    ais[id].y = (Math.random() > 0.5 ? (Math.floor(camera.y - 450 - 100 - Math.random() * 100)) : (Math.floor(camera.y + 450 + 100 + Math.random() * 100)));
                                }
                            
                            }
                        }
                    
                    //ais.push(temp);
                    //id--;
                        break;
                    }
                }
            }
            if(ais[id] == undefined){
                break;
            }
        }
        if(ais[id] == undefined){
            continue;
        }
        npc.speedCoeff += (1.0 - npc.speedCoeff) / 20;
        npc.x += npc.pushx;
        npc.y += npc.pushy;
        npc.pushx *= 0.75;
        npc.pushy *= 0.75;
        if(chasedPlayer != undefined && distToPlayer < aggroRange){
            npc.wanderlust = 0;
            var angleToPlayer = Math.atan2((chasedPlayer.y - npc.y), (chasedPlayer.x - npc.x));
            var proximitySpeedCoeff = Math.max(0, (aggroRange - distToPlayer)/aggroRange);
            npc.x += Math.cos(angleToPlayer) * npspeed * timeDifference * proximitySpeedCoeff * npc.speedCoeff;
            npc.y += Math.sin(angleToPlayer) * npspeed * timeDifference * proximitySpeedCoeff * npc.speedCoeff;
            if(distToPlayer <= 16){
                chasedPlayer.health -= 0.25 * timeDifference;
                chasedPlayer.speedCoeff = 0.25;
                chasedPlayer.pushx += Math.cos(angleToPlayer) * push;
                chasedPlayer.pushy += Math.sin(angleToPlayer) * push;
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
            }else{
                npc.wanderlust = Math.floor(Math.random() * 1000) + 100;
                var avgX = 0;
                var avgY = 0;
                var count = 0;
                for(var pid in players){
                    count++;
                    avgX += players[pid].x;
                    avgY += players[pid].y;
                }
                npc.wanderang = Math.random() * 2 * Math.PI; 
                if(count > 0){
                    avgX /= count;
                    avgY /= count;
                    npc.wanderang = Math.random() * Math.PI / 8 - Math.random() * Math.PI / 8 + Math.atan2(avgY - npc.y, avgX - npc.x);
                }
                 
            }
        }
    }
    for (var id in players){
        var player = players[id];
        
        
        for (var b = 0; b < player.bullets.length; b++){
            var bullet = player.bullets[b];
            if(bullet == undefined){
                player.bullets.splice(b, 1);
                b--;
            }
        }
        for (var b = 0; b < player.bullets.length; b++){
            var bullet = player.bullets[b];
            if(bullet.lifetime > 0){
                bullet.x += Math.cos(bullet.ang) * bullet.speed * timeDifference;
                bullet.y += Math.sin(bullet.ang) * bullet.speed * timeDifference;
                bullet.lifetime--;
                bullet.flash--;
            }
            if(bullet.lifetime <= 0){
                delete player.bullets[b];
            }
        }
        
        if(player.clicked){
            if (player.shotcycle == 0){
                var bullet = {
                    ang: Math.atan2(player.mousey - player.y, player.mousex - player.x) + Math.random() * Math.PI / 8 - Math.random() * Math.PI / 8,
                    x: 0,
                    y: 0,
                    speed: player.gun.speed,
                    lifetime: player.gun.range,
                    flash: 1
                };
                bullet.x = player.x + Math.cos(bullet.ang) * 8;
                bullet.y = player.y + Math.sin(bullet.ang) * 8;
                player.bullets.push(bullet);
                player.pushx -= Math.cos(bullet.ang) * player.gun.kickback * (0.8 + Math.random() * 0.4);
                player.pushy -= Math.sin(bullet.ang) * player.gun.kickback * (0.8 + Math.random() * 0.4);
                player.shotcycle = player.gun.reload;
            }else{
                player.shotcycle--;
            }
        }
        if(player.pushx > speedlim){
            player.pushx = speedlim;
        }
        if(player.pushx < -1 * speedlim){
            player.pushx = -1 * speedlim;
        }
        if(player.pushy > speedlim){
            player.pushy = speedlim;
        }
        if(player.pushy < -1 * speedlim){
            player.pushy = -1 * speedlim;
        }
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
        player.x += player.pushx;
        player.y += player.pushy;
        player.pushx *= 0.75;
        player.pushy *= 0.75;
    }
    for(var i = 0; i < corpses.length; i++){
        corpses[i].x += corpses[i].pushx;
        corpses[i].y += corpses[i].pushy;
        corpses[i].pushx *= 0.85;
        corpses[i].pushy *= 0.85;
    }
    actors = {
        pcs: players,
        npcs: ais,
        bodies: corpses
    }
    map = {
        buildings: buildings
    };
    io.sockets.emit('map', map);
    io.sockets.emit('state', actors);
    
    //console.log(actors);
    lastUpdateTime = currentTime;
}, 1000 / 60);