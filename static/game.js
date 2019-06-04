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
    mouse.x = event.clientX;
    mouse.y = event.clientY;
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


var canvas = document.getElementById('canvas');
canvas.width = 1400;
canvas.height = 900;
var context = canvas.getContext('2d');

var playerSize = 4;
var actorSize = 4;

socket.on('state', function(actors){
    context.clearRect(0, 0, 1400, 900);
    context.fillStyle = 'slategray';
    context.fillRect(0, 0, 1400, 900);
    for (var id in actors.pcs){
        context.fillStyle = 'lightpink';
        var player = actors.pcs[id];
        context.beginPath();
        context.arc(player.x, player.y, playerSize, 0, 2 * Math.PI);
        context.fill();
        context.fillStyle = 'indianred';
        if(player.health > 0){
            context.fillRect(player.x - 8, player.y - 8, player.health / 100 * 16, 2);
        }
        context.fillStyle = 'yellow';
        for (var b in player.bullets){
            var bullet = player.bullets[b];
            context.beginPath();
            context.arc(bullet.x, bullet.y, 3, 0, 2 * Math.PI);
            context.fill();
        }
    }
    context.fillStyle = 'lightgreen';
    for (var id in actors.npcs){
        var npc = actors.npcs[id];
        context.beginPath();
        context.arc(npc.x, npc.y, actorSize, 0, 2 * Math.PI);
        context.fill();
    }
});