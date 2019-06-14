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

var rat = {
    size: 6,
    speed: 0.06,
    health: 100
};

var rifle = {
    reload: 5,
    damage: 1.2,
    speed: 1.5,
    range: 100,
    bulletsize: 1,
    bullettrail: 8,
    kickback: 1,
    coneMod: 1,
    spreadMod: 0,
    id: 'rifle'
};

var shotgun = {
    reload: 80,
    damage: 2,
    speed: 2,
    range: 12,
    bulletsize: 3,
    bullettrail: 10,
    kickback: 2,
    coneMod: 1,
    spreadMod: 1,
    id: 'shotgun'
};

var flamethrower = {
    reload: 1,
    damage: 0.25,
    speed: 0.35,
    range: 30,
    bulletsize: 1.25,
    bullettrail: 4,
    kickback: 0,
    coneMod: 0,
    spreadMod: 2,
    id: 'flamethrower'
}
var cspeedmod = 1.5;
var playerspeed = 0.12 * cspeedmod;
var speedlim = 6;
var push = -0.01;
var npspeed = 0.06 * cspeedmod;
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
        x: 0,
        y: 0,
        pushx: 0,
        pushy: 0,
        speedCoeff: 1.0,
        wanderlust: 0,
        wanderang: Math.random() * Math.PI * 2,
        health: 100,
        natspeed: 1.0,
        class: rat,
        animCoeff: 1.0,
        anim_t: Math.random() * 1000,
        natpace: Math.random() * 0.5 + 0.75,
        stepmod: Math.random() * 0.3 + 0.85
    }
    ais[i].health = ais[i].class.health;
    if(Math.random() > 0.5){
        ais[i].x = (Math.random() > 0.5 ? (Math.floor(5000 - 700 - 300 - Math.random() * 100)) : (Math.floor(5000 + 700 + 300 + Math.random() * 100)));
        ais[i].y = 5000 + Math.random() * 450 - Math.random() * 450;
    }else{
        ais[i].x = 5000 + Math.random() * 700 - Math.random() * 700;
        ais[i].y = (Math.random() > 0.5 ? (Math.floor(5000 - 450 - 300 - Math.random() * 100)) : (Math.floor(5000 + 450 + 300 + Math.random() * 100)));
    }
}

var cityplan = [];
for (var y = 0; y < 20; y++){
    for(var x = 0; x < 20; x++){
        cityplan[x + y * 20] = (Math.random() > 0.1);
        
    }
}
var currX = 0;
var currY = 0;
for (var iy = 0; iy < 20; iy++){
    for(var ix = 0; ix < 20; ix++){
        if(cityplan[ix + iy * 20]) {
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
            gun: shotgun,
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
                    npc.pushx += Math.cos(bullet.ang) * player.gun.kickback * 8;
                    npc.pushy += Math.sin(bullet.ang) * player.gun.kickback * 8;
                    if(npc.health <= 0){
                        if(player.gun.kickback == 0){
                            npc.pushx -= Math.cos(bullet.ang) * 4;
                            npc.pushy -= Math.sin(bullet.ang) * 4;
                        }
                        corpses.push({
                            x: npc.x,
                            y: npc.y,
                            pushx: npc.pushx,
                            pushy: npc.pushy,
                            class: npc.class,
                            explosions: [{
                                x: 0,
                                y: 0,
                                frame: 3,
                                r: 10 + Math.random() * 100,
                                triggered: false
                            },{
                                x: 0,
                                y: 0,
                                frame: 3,
                                r: 10 + Math.random() * 100,
                                triggered: false
                            },{
                                x: 0,
                                y: 0,
                                frame: 3,
                                r: 10 + Math.random() * 100,
                                triggered: false
                            }]
                        });
                        
                        ais[id] = {
                            x: 0,
                            y: 0,
                            pushx: 0,
                            pushy: 0,
                            speedCoeff: 1.0,
                            wanderlust: 0,
                            wanderang: Math.random() * Math.PI * 2,
                            health: 100,
                            natspeed: 1.0,
                            class: npc.class,
                            animCoeff: 1.0,
                            anim_t: 0,
                            natpace: Math.random() * 0.5 + 0.75,
                            stepmod: Math.random() * 0.3 + 0.85
                        };
                        ais[i].health = ais[i].class.health;
                        var intheclear = false;
                        while(!intheclear){
                            intheclear = true;
                            for(var pid in players){
                                var camera = players[pid];
                                if(Math.abs(ais[id].x - camera.x) <= 720 && Math.abs(ais[id].y - camera.y) <= 470){
                                    intheclear = false;
                                }
                                if(!intheclear){
                                    if(Math.random() > 0.5){
                                        ais[i].x = (Math.random() > 0.5 ? (Math.floor(camera.x - 700 - 100 - Math.random() * 100)) : (Math.floor(camera.x + 700 + 100 + Math.random() * 100)));
                                        ais[i].y = 5000 + Math.random() * 450 - Math.random() * 450;
                                    }else{
                                        ais[i].x = 5000 + Math.random() * 700 - Math.random() * 700;
                                        ais[i].y = (Math.random() > 0.5 ? (Math.floor(camera.y - 450 - 100 - Math.random() * 100)) : (Math.floor(camera.y + 450 + 100 + Math.random() * 100)));
                                    }
                                }
                            
                            }  
                        }
                        break;
                    }
                }else if((bullet.y - Math.sin(bullet.ang) * 2 * player.gun.bullettrail - npc.y) * (bullet.y - Math.sin(bullet.ang) * 2 * player.gun.bullettrail - npc.y) + (bullet.x - Math.cos(bullet.ang) * 2 * player.gun.bullettrail - npc.x)*(bullet.x - Math.cos(bullet.ang) * 2 * player.gun.bullettrail - npc.x) < bulletsize * bulletsize){
                    //ais.splice(id, 1);
                    npc.health -= player.gun.damage * timeDifference;
                    npc.pushx += Math.cos(bullet.ang) * player.gun.kickback * 8;
                    npc.pushy += Math.sin(bullet.ang) * player.gun.kickback * 8;
                    if(npc.health <= 0){
                        if(player.gun.kickback == 0){
                            npc.pushx -= Math.cos(bullet.ang) * 4;
                            npc.pushy -= Math.sin(bullet.ang) * 4;
                        }
                        corpses.push({
                            x: npc.x,
                            y: npc.y,
                            pushx: npc.pushx,
                            pushy: npc.pushy,
                            class: npc.class,
                            explosions: [{
                                x: 0,
                                y: 0,
                                frame: 3,
                                r: 10 + Math.random() * 100,
                                triggered: false
                            },{
                                x: 0,
                                y: 0,
                                frame: 3,
                                r: 10 + Math.random() * 100,
                                triggered: false
                            },{
                                x: 0,
                                y: 0,
                                frame: 3,
                                r: 10 + Math.random() * 100,
                                triggered: false
                            }]
                        });
                        ais[id] = {
                            x: 0,
                            y: 0,
                            pushx: 0,
                            pushy: 0,
                            speedCoeff: 1.0,
                            wanderlust: 0,
                            wanderang: Math.random() * Math.PI * 2,
                            health: 100,
                            natspeed: 1.0,
                            class: npc.class,
                            animCoeff: 1.0,
                            anim_t: 0,
                            natpace: Math.random() * 0.5 + 0.75,
                            stepmod: Math.random() * 0.3 + 0.85
                        };
                        ais[i].health = ais[i].class.health;
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
        npc.anim_t++;
        npc.animCoeff = 1.4 * Math.sin(npc.anim_t/(Math.PI * npc.natpace / 2));
        
        if(Math.abs((npc.anim_t/(Math.PI * npc.natpace / 2)) - Math.round(npc.anim_t/(Math.PI * npc.natpace / 2))) < 1){
            npc.stepmod = Math.random() * 0.3 + 0.85;
            //console.log("stepmod");
        }
        npc.speedCoeff = 1.9 + npc.animCoeff;
        if(chasedPlayer != undefined && distToPlayer < aggroRange){
            npc.wanderlust = 0;
            var angleToPlayer = Math.atan2((chasedPlayer.y - npc.y), (chasedPlayer.x - npc.x));
            
            npc.x += Math.cos(angleToPlayer) * npc.class.speed * cspeedmod * timeDifference * npc.speedCoeff * npc.stepmod;
            npc.y += Math.sin(angleToPlayer) * npc.class.speed * cspeedmod * timeDifference * npc.speedCoeff * npc.stepmod;
            if(distToPlayer <= 16){
                chasedPlayer.health -= 0.01 * timeDifference;
                chasedPlayer.speedCoeff = 0.25;
                chasedPlayer.pushx += Math.cos(angleToPlayer) * push;
                chasedPlayer.pushy += Math.sin(angleToPlayer) * push;
                if(chasedPlayer.health <= 0){
                    delete players[playerId];
                }
                npc.speedCoeff = 0.01 * (1.4 + npc.animCoeff);
            }
        }else{
            npc.animCoeff = 1.4 * Math.sin(npc.anim_t / (Math.PI * 0.8 * npc.natpace));
            //console.log(npc.animCoeff);
            if(Math.abs((npc.anim_t/(Math.PI * 0.8 * npc.natpace)) - Math.round(npc.anim_t/(Math.PI * 0.8 * npc.natpace))) < 1){
                npc.stepmod = Math.random() * 0.3 + 0.85;
                npc.wanderang += Math.PI / 12 * Math.random() - Math.PI / 12 * Math.random();
                //console.log("stepmod");
            }
            npc.speedCoeff = 1.9 + npc.animCoeff;
            if(npc.wanderlust > 0){
                npc.wanderlust--;
                npc.x += Math.cos(npc.wanderang) * npc.class.speed * cspeedmod * timeDifference * 0.25 * npc.speedCoeff * npc.stepmod;
                npc.y += Math.sin(npc.wanderang) * npc.class.speed * cspeedmod * timeDifference * 0.25 * npc.speedCoeff * npc.stepmod;
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
        if(player.shotcycle > 0){
            player.shotcycle--;
        }
        if(player.clicked){
            if (player.shotcycle == 0){
                var bullet = {
                    ang: Math.atan2(player.mousey - player.y, player.mousex - player.x) + Math.random() * Math.PI / 12 - Math.random() * Math.PI / 12,
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
        if(Math.abs(corpses[i].pushx) > 1 && Math.abs(corpses[i].pushy) > 1){
            corpses[i].x += corpses[i].pushx;
            corpses[i].y += corpses[i].pushy;
            corpses[i].pushx *= 0.98;
            corpses[i].pushy *= 0.98;
            
        }
        var noexplo = false;
            if(!noexplo){
                noexplo = true;
                for(var j = 0; j < corpses[i].explosions.length; j++){
                    var ex = corpses[i].explosions[j];
                    
                    if(!ex.triggered && Math.abs(corpses[i].pushx) > 1 && Math.abs(corpses[i].pushy) > 1){
                        noexplo = false;
                        ex.triggered = Math.random() > 0.3;
                        if(ex.triggered){
                            ex.x = corpses[i].x;
                            ex.y = corpses[i].y;
                        }
                    }else{
                        if(ex.frame > 0){
                            noexplo = false;
                        }
                        ex.frame--;
                    }
                }
            }
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