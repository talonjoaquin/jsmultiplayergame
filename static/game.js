var socket = io();

var movement = {
    up: false,
    down: false,
    left: false,
    right: false
}
var mouse = {
    x: 0,
    y: 0,
    clicked: false
}
var camera = {
    x: 0,
    y: 0,
    lerp: 0.2
}
var meid;
var map;

document.addEventListener('keydown', function(event){
    switch(event.keyCode){
        case 65:
            movement.left = true;
            break;
        case 87:
            movement.up = true;
            break;
        case 68:
            movement.right = true;
            break;
        case 83:
            movement.down = true;
            break;
    }
});
document.addEventListener('keyup', function(event){
    switch(event.keyCode){
        case 65:
            movement.left = false;
            break;
        case 87:
            movement.up = false;
            break;
        case 68:
            movement.right = false;
            break;
        case 83:
            movement.down = false;
            break;
    }
});
document.addEventListener('mousemove', function(event){
    mouse.x = event.clientX + camera.x;
    mouse.y = event.clientY + camera.y;
})
document.addEventListener('mousedown', function(event){
    mouse.clicked = true;
});
document.addEventListener('mouseup', function(){
    mouse.clicked = false;
});
socket.on('message', function(data){
    console.log(data);
});
socket.emit('new player');
setInterval(function(){
    socket.emit('movement', movement);
    socket.emit('mouse', mouse);
}, 1000 / 60);

socket.on('connect', function(){
    meid = socket.id;
})

var canvas = document.getElementById('canvas');
canvas.width = 1400;
canvas.height = 900;
var context = canvas.getContext('2d');

var sizeMod = 1.4;
var playerSize = 4 * sizeMod;
var actorSize = 4 * sizeMod;

var shakex = 0;
var shakey = 0;

socket.on('map', function(data){
    map = data;
});
socket.on('state', function(actors){
    context.clearRect(0, 0, 1400, 900);
    context.fillStyle = 'black';
    context.fillRect(0, 0, 1400, 900);
    
    var me = actors.pcs[meid];
    if(me != undefined){
        if(me.pushx === 0){
            tiltx = 0;
        }else{
            tiltx = Math.abs(me.pushx) / me.pushx;
        }
        if(me.pushy === 0){
            tilty = 0;
        }else{
            tilty = Math.abs(me.pushy) / me.pushy;
        }
        camera.x += (me.x - 700 - camera.x) * camera.lerp;
        camera.y += (me.y - 450 - camera.y) * camera.lerp;
        shakex *= 0.8;
        shakey *= 0.8;
    }
    for (var id in actors.npcs){
        
        var npc = actors.npcs[id];
        //context.beginPath();
        //context.arc(npc.x - camera.x, npc.y - camera.y, actorSize, 0, 2 * Math.PI);
        context.globalAlpha = 1.0;
        
        //context.drawRect(npc.x - camera.x, npc.y - camera.y, actorSize * 2, actorSize * 2);
        context.fillStyle = 'lightgrey';
        context.fillRect(npc.x - camera.x - 2, npc.y - camera.y - 2, npc.class.size * sizeMod + 4, npc.class.size * sizeMod + 4);

        context.fillStyle = 'darkgreen';
        //context.fill();
        context.fillRect(npc.x - camera.x, npc.y - camera.y, npc.class.size * sizeMod, npc.class.size * sizeMod);
        
    }
    for (var id in actors.bodies){
        var corpse = actors.bodies[id];
        context.globalAlpha = 1.0;
        
        //context.drawRect(npc.x - camera.x, npc.y - camera.y, actorSize * 2, actorSize * 2);
        context.fillStyle = 'lightgrey';
        context.fillRect(corpse.x - camera.x - 2, corpse.y - camera.y - 2, corpse.class.size * sizeMod + 4, corpse.class.size * sizeMod + 4);

        context.fillStyle = 'white';
        //context.fill();
        context.fillRect(corpse.x - camera.x, corpse.y - camera.y, corpse.class.size * sizeMod, corpse.class.size * sizeMod);
        //console.log(corpse.explosions);
        
    }
    for (var id in actors.pcs){
        context.fillStyle = 'lightpink';
        var player = actors.pcs[id];
        context.beginPath();
        context.arc(player.x - camera.x, player.y - camera.y, playerSize, 0, 2 * Math.PI);
        context.fill();
        context.fillStyle = 'black';
        context.stroke();
        context.fillStyle = 'indianred';
        if(player.health > 0){
            context.fillRect(player.x - 8 * sizeMod - camera.x, player.y - 8 * sizeMod - camera.y, player.health / 100 * 16 * sizeMod, 2);
        }
        for (var b in player.bullets){
            
            var bullet = player.bullets[b];
            if(bullet == undefined){
                continue;
            }
            //console.log(bullet.flash);
            if(bullet.flash > 0 && player.gun.id != 'flamethrower'){
                context.fillStyle = 'white';
                context.globalAlpha = 1.0;
                context.beginPath();
                context.arc(player.x + Math.cos(bullet.ang) * (1.0 + player.gun.bulletsize / 4) * 12 * sizeMod - camera.x, player.y + Math.sin(bullet.ang) * 12 * sizeMod - camera.y, 3 * sizeMod * (1.0 + player.gun.bulletsize / 4), 0, 2 * Math.PI);
                context.fill();
                context.globalAlpha = 0.6;
                context.beginPath();
                context.arc(player.x + Math.cos(bullet.ang) * (1.0 + player.gun.bulletsize / 4) * 16 * sizeMod - camera.x, player.y + Math.sin(bullet.ang) * 16 * sizeMod - camera.y, 12 * sizeMod * (1.0 + player.gun.bulletsize / 4), 0, 2 * Math.PI);
                context.fill();
                context.globalAlpha = 0.2;
                context.beginPath();
                context.arc(player.x + Math.cos(bullet.ang) * (1.0 + player.gun.bulletsize / 4) * 24 * sizeMod - camera.x, player.y + Math.sin(bullet.ang) * 24 * sizeMod - camera.y, 20 * sizeMod * (1.0 + player.gun.bulletsize / 4), 0, 2 * Math.PI);
                context.fill();
                context.globalAlpha = 1.0;
            }else{
                
                for(var i = 0; i < player.gun.bullettrail; i++){
                   
                    context.fillStyle = 'darkorange';
                    context.globalAlpha = 0.6;
                    context.beginPath();
                    //context.arc(bullet.x - Math.cos(bullet.ang) * i * 2 * sizeMod - camera.x, bullet.y - Math.sin(bullet.ang) * i * 2 * sizeMod - camera.y, 4 * sizeMod * (0.8 + 0.2 * (1.0 - player.gun.bullettrail * player.gun.coneMod)) * player.gun.bulletsize * (player.gun.spreadMod * (1.0 + 0.5 * (player.gun.range - bullet.lifetime) / player.gun.range)), 0, 2 * Math.PI);
                    context.arc(bullet.x - Math.cos(bullet.ang) * i * 2 * sizeMod - camera.x, bullet.y - Math.sin(bullet.ang) * i * 2 * sizeMod - camera.y, 4 * sizeMod * player.gun.bulletsize * ((1.0 + player.gun.spreadMod * 2.0 * (player.gun.range - bullet.lifetime) / player.gun.range)), 0, 2 * Math.PI);
                    context.fill();
                }

                for(var i = 0; i < player.gun.bullettrail; i++){
                    context.fillStyle = 'white';
                    context.globalAlpha = 1.0;
                    context.beginPath();
                    //context.arc(bullet.x - Math.cos(bullet.ang) * i * 2 * sizeMod - camera.x, bullet.y - Math.sin(bullet.ang) * i * 2 * sizeMod - camera.y, 1 * sizeMod * (0.8 + 0.2 * (1.0 - player.gun.bullettrail * player.gun.coneMod)) * player.gun.bulletsize * (player.gun.spreadMod * (1.0 + 0.5 * (player.gun.range - bullet.lifetime) / player.gun.range)), 0, 2 * Math.PI);
                    context.arc(bullet.x - Math.cos(bullet.ang) * i * 2 * sizeMod - camera.x, bullet.y - Math.sin(bullet.ang) * i * 2 * sizeMod - camera.y, 2 * sizeMod * player.gun.bulletsize * ((1.0 + player.gun.spreadMod * 2.0 * (player.gun.range - bullet.lifetime) / player.gun.range)), 0, 2 * Math.PI);
                    context.fill();
                }
                /*context.fillStyle = 'white';
                context.globalAlpha = 0.6;
                context.beginPath();
                context.arc(bullet.x, bullet.y, 2 * sizeMod, 0, 2 * Math.PI);
                context.fill();
                context.globalAlpha = 0.3;
                context.arc(bullet.x, bullet.y, 6 * sizeMod, 0, 2 * Math.PI);
                context.fill();*/
                context.globalAlpha = 1.0;
            }
        }
    }
    
    
    for (var id in actors.bodies){
        var corpse = actors.bodies[id];
        for(var v = 0; v < corpse.explosions.length; v++){
            var ex = corpse.explosions[v];
            if(ex.triggered){
                //console.log("ruached");
                //if(ex.frame > 0){
                    //onsole.log("roached");
                    if(ex.frame == 3){
                        shakex = (Math.random() * 10 - Math.random() * 10)*(ex.r);
                        shakey = (Math.random() * 10 - Math.random() * 10)*(ex.r);
                        context.globalAlpha = 1.0;
                        context.fillStyle = 'orange';
                        context.beginPath();
                        context.arc(ex.x - camera.x + Math.random() * 10 - Math.random() * 10, ex.y - camera.y + Math.random() * 10 - Math.random() * 10, ex.r, 0, Math.PI * 2);
                        context.fill();
                        context.globalAlpha = 1.0;
                    }else if(ex.frame == 2){
                        //onsole.log("reached");
                        context.globalAlpha = 1.0;
                        context.fillStyle = 'black';
                        context.beginPath();
                        context.arc(ex.x - camera.x + Math.random() * 10 - Math.random() * 10, ex.y - camera.y + Math.random() * 10 - Math.random() * 10, ex.r, 0, Math.PI * 2);
                        context.fill();
                        context.globalAlpha = 1.0;
                    }else if(ex.frame == 1){
                        context.globalAlpha = 1.0;
                        context.fillStyle = 'white';
                        context.beginPath();
                        context.arc(ex.x - camera.x + Math.random() * 10 - Math.random() * 10, ex.y - camera.y + Math.random() * 10 - Math.random() * 10, ex.r, 0, Math.PI * 2);
                        context.fill();
                    }
                    //ex.frame--;
               // }
            }
        }
    }
     

    
    if(map != undefined){
        context.fillStyle = 'slategrey';
        for(var i = 0; i < map.buildings.length; i++){
            context.globalAlpha = 0.3;    
            var building = map.buildings[i];
            //console.log((me.x > building.x && me.x < building.x + building.w) && (me.y > building.y && me.y < building.y + building.h));
            if(me != undefined){
                if((me.x > building.x && me.x < building.x + building.w) && (me.y > building.y && me.y < building.y + building.h)){
                    context.globalAlpha = 0.3;
                }else{
                    context.globalAlpha = 0.3;
                }
                
            }
            context.fillRect(building.x - camera.x, building.y - camera.y, building.w, building.h);
        }
    }
    context.globalAlpha = 1.0;
});