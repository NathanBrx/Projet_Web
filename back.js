const express = require('express');
const { cookie } = require('express/lib/response');
const app = express();
const http = require('http');
const server = http.createServer(app);
const io = new require("socket.io")(server);
server.listen(8880, () => {console.log('Le serveur écoute sur le port 8880');});

let players = [];
var max_player = 4;
var hexList = [];
var colors = ["blue","green","brown"];

app.get('/', (request, response) => {
    response.sendFile('front.html', {root: __dirname});
});

io.on('connection', (socket) => {
    socket.on("enter_game", player => {
        if(players.includes(player)){
            socket.emit("erreur","Nom d'utilisateur déjà existant");
        } else if (players.length==max_player) {
            socket.emit("erreur","Nombre de joueur maximum atteint");
        } else {
            console.log(player,"est entré dans la partie");
            players.push(player);
            socket.emit("connected", player);
            io.emit('send_list', players);
            io.emit("player_added",player);
        }
    });

    socket.on("quit_game", player => {
        console.log(player,"a quitté la partie");
        players.splice(players.indexOf(player),1);
        io.emit('send_list', players);
        io.emit("player_removed",player);
    });

    socket.on("request_player_list", value => {
        socket.emit("send_list_load",players);
    });

    socket.on("get_player_list", value => {
        io.emit("plyer_list")
    })
    
    socket.on('mess',data => {
        io.emit('messagerie',data); 
    });

    socket.on("fillGrid",hexId => {
        let tanieres = ["h6","h78","h90","h162"];
        let color = "";
        if (tanieres.slice(0,players.length-1).includes(hexId)) {
            color = "pink";
        } else {
            rand = Math.floor(Math.random() * 101);
            if (rand<=14) {
                color = colors[0];
            } else if (rand>=15 && rand<50) {
                color = colors[1];
            } else if (rand>=50) {
                color = colors[2];
            }
        }
        //console.log(hexId,color);
        hexList.push([hexId,color]);
        io.emit("hexFilled",hexId,color);
    });
});