#!/usr/bin/env node

import * as d3 from "d3";
import * as jsdom from "jsdom";

import express from "express";
import pkg from 'express/lib/response.js';
import * as http from "http";
import * as socketio from "socket.io";

import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const { cookie } = pkg;
const server = http.createServer(app);
const io = new socketio.Server(server);

const { JSDOM } = jsdom;
const { document } = (new JSDOM('')).window;
global.document = document;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

server.listen(8880, () => {console.log('Le serveur écoute sur le port 8880');});

var players = [];
var playerStats = {};
var max_player = 4;
var hexList = [];
var colors = ["blue","green","brown"];
var creaturesColors = ["orange","purple","black","white"];
var creatures = [];
var tanieres = ["h6","h78","h90","h162"];

app.use(express.static(__dirname + '/public'));

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
            playerStats[player] = [];
            socket.emit("connected", player);
            io.emit('send_list', players);
            io.emit("player_added",player);
            if (player == players[0]) {
                io.emit("chef_de_partie");
            }
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
    
    socket.on('mess',data => {
        io.emit('messagerie',data); 
    });

    socket.on("createBoard", (nbLignes,nbColonnes,rayHex) => {
        console.log("Signal createBoard reçu");
        var svg = createHexagonBoard(nbLignes,nbColonnes,rayHex);
        updateCreaturePositions(svg, creatures, rayHex);
        const svgHTML = svg.node().outerHTML;
        io.emit("boardCreated",svgHTML);
    });

    socket.on("stats", (reproduction, perception, force, player) => {
        var stats = [reproduction, perception, force];

        function checkSameStats(user, stats) {
            for (var i=0; i<=2; i++) {
                if (playerStats[user][i] != stats[i]) {
                    return false;
                }
            }
            return true;
        }
        
        if (players.length > 1) {
            var sameStats = false;
            for (var i=0; i<= players.length-1; i++) {
                if (checkSameStats(players[i], stats)) {
                    sameStats = true;
                    break;
                }
            }

            if (sameStats) {
                io.emit("stats_error");
            } else {
                playerStats[player] = stats;
                creatures.push({hexId : tanieres[players.indexOf(player)], name : player+"1", color : creaturesColors[players.indexOf(player)]});
                creatures.push({hexId : tanieres[players.indexOf(player)], name : player+"2", color : creaturesColors[players.indexOf(player)]});
            }
        } else {
            playerStats[player] = stats;
            creatures.push({hexId : tanieres[players.indexOf(player)], name : player+"1", color : creaturesColors[0]});
            creatures.push({hexId : tanieres[players.indexOf(player)], name : player+"2", color : creaturesColors[0]});
        }
        console.log(playerStats);
        console.log(creatures);
    });

});

function creeHexagone(rayon){
    var points = new Array();
    for (var i = 0; i < 6; ++i){
    var angle = i*Math.PI / 3;
    var x = Math.sin(angle)*rayon;
    var y = -Math.cos(angle)*rayon;
    points.push([Math.round(x*100)/100, Math.round(y*100)/100]);
    }
    return points;
}

function createHexagonBoard(nbLignes,nbColonnes,rayHex) {
    const svg = d3.create("svg")
            .attr("width",Math.sin(Math.PI/3)*rayHex*2*(nbColonnes+(nbLignes-1)/2))
            .attr("height",rayHex*1.5*nbLignes+rayHex*0.5)
            .style("background-color","white");

    var offset = Math.sin(Math.PI/3)*rayHex;
    var  hexagone = creeHexagone(rayHex);
    for (var l=0; l < nbLignes; l++){
        for (var c=0;c<nbColonnes;c++){
            var d = "",x,y;
            for (var h in hexagone){
                x = hexagone[h][0]+c*offset*2+offset+l*offset;
                y = hexagone[h][1]+l*rayHex*1.5+rayHex;
                if(h==0) d+="M"+x+","+y+" L";
                else d+= x+","+y+" ";
            }
            d+= "Z";
            svg.append("path")
                .attr("d",d)
                .attr("stroke","black")
                .attr("fill","white")
                .attr("id","h"+(l*nbLignes+c));
        }
    }

    for (let i=0; i<=169; i++){
        var current = svg.attr("id","h"+i.toString());
        var color = "";
        if (tanieres.slice(0,players.length).includes(current.attr("id"))) {
            color = "pink";
        } else {
            var rand = Math.floor(Math.random() * 101);
            if (rand<=14) {
                color = colors[0];
            } else if (rand>=15 && rand<50) {
                color = colors[1];
            } else if (rand>=50) {
                color = colors[2];
            }
        }
        hexList.push([current.attr("id"),color]);
        svg.select("#h"+i.toString()).attr("fill",color);
    }
    return svg;
}

function updateCreaturePositions(svg, creatures, rayHex) {
    creatures.forEach(creature => {
        console.log(creature.hexId, creature.name, creature.color);
        // Mettre à jour les positions des créatures dans le SVG
        var hexagon = svg.select("#" + creature.hexId);
        console.log(hexagon.node().outerHTML);
        // Draw the creature at the center of the hexagon
        svg.append("rect")
            .attr("class", "creature")
            .attr("x", 0) // Adjust for the half-width of the creature
            .attr("y", 0) // Adjust for the half-height of the creature
            .attr("width", 100)
            .attr("height", 100)
            .attr("fill", creature.color);
    });
}