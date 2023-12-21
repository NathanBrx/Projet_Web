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
var sexes = ["male","femelle"];
var tanieres = ["h6","h78","h90","h162"];
var creatures = [];
var numberOfCreatures = {};
var tours = 0;
var maxTours = 10;

app.use(express.static(__dirname + '/public'));

app.get('/', (request, response) => {
    response.sendFile('front.html', {root: __dirname});
});

class creature {
    constructor(hexId, name, color, sexe, espece, hydratation, satiete, toursDepuisRepro) {
        this.hexId = hexId;
        this.name = name;
        this.color = color;
        this.sexe = sexe;
        this.espece = espece;
        this.hydratation = hydratation;
        this.satiete = satiete;
        this.toursDepuisRepro = toursDepuisRepro;
    }
}

io.on('connection', (socket) => {
    socket.on("enter_game", player => {
        if(players.includes(player)){
            socket.emit("erreur","Nom d'utilisateur déjà existant");
        } else if (players.length==max_player) {
            socket.emit("erreur","Nombre de joueur maximum atteint");
        } else if (player == ""){
            socket.emit("erreur","Nom d'utilisateur vide");
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
        delete playerStats[player];
        creatures = creatures.filter(creature => creature.espece !== player);
        players.splice(players.indexOf(player),1);
        console.log(creatures);
        io.emit('send_list', players);
        io.emit("updateCreaturesPositions",creatures);
        io.emit("player_removed",player);
    });

    socket.on("request_player_list", () => {
        socket.emit("send_list_load",players);
    });
    
    socket.on('mess',data => {
        io.emit('messagerie',data); 
    });

    socket.on("createBoard", (nbLignes,nbColonnes,rayHex) => {
        var svg = createHexagonBoard(nbLignes,nbColonnes,rayHex);
        const svgHTML = svg.node().outerHTML;
        io.emit("boardCreated",svgHTML);
        io.emit("updateCreaturesPositions",creatures);
    });

    socket.on("stats", (reproduction, perception, force, player) => {
        var stats = [reproduction, perception, force];

        function checkSameStats(stats) {
            var sameStats = false;
            if (players.length > 1) {
                for (var user=0; user<= players.length-1; user++) {
                    for (var i=0; i<=2; i++) {
                        if (playerStats[user][i] != stats[i]) {
                            sameStats = false;
                        }
                    }
                }
            }
            return sameStats;
        }
        if (checkSameStats(stats)) {
            socket.emit("stats_error");
        } else {
            playerStats[player] = stats;
            creatures.push(new creature(tanieres[players.indexOf(player)], player+"1", creaturesColors[players.indexOf(player)], sexes[0], player, 5, 5, 0));
            creatures.push(new creature(tanieres[players.indexOf(player)], player+"2", creaturesColors[players.indexOf(player)], sexes[1], player, 5, 5, 0));
            numberOfCreatures[player] = 2;
        }
        console.log(playerStats);
        console.log(creatures);
    });

    socket.on("startGame", async () => {
        const delay = ms => new Promise(res => setTimeout(res, ms));
        while (tours <= maxTours) {
            tour();
            tours ++;
            await delay(3000);
        }
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

function retourTaniere(creature){
    var newHex = creature.hexId;
    // si creature.hexId % 13 == tanieres[creature.espece] % 13 => meme colonne donc aller de -13 en 13
    if (creature.hexId % 13 == tanieres[creature.espece] % 13) {
        if (creature.hexId < tanieres[creature.espece]) {
            newHex += 13;
        } else {
            newHex -= 13;
        }
    // sinon si tanieres[creature.espece] < creature.hexId < tanieres[creature.espece] + 12 => meme ligne donc aller de -1 en 1
    } else if (tanieres[creature.espece] < creature.hexId && creature.hexId < tanieres[creature.espece] + 12) {
        if (creature.hexId < tanieres[creature.espece]) {
            newHex += 1;
        } else {
            newHex -= 1;
        }
    // sinon si creature.hexId % 13 < tanieres[creature.espece] % 13 => aller de -13 en 12
    } else if (creature.hexId % 13 < tanieres[creature.espece] % 13) {
        if (creature.hexId < tanieres[creature.espece]) {
            newHex += 13;
        } else {
            newHex -= 12;
        }
    // sinon => aller de 12 en -13
    } else {
        if (creature.hexId < tanieres[creature.espece]) {
            newHex += 12;
        } else {
            newHex -= 13;
        }
    }
    creature.hexId = newHex;
}

function creatureAutreSexe(creature1){
    var sameSexe = false;
    creatures.filter(creature2 => creature1.espece == creature2.espece).forEach(creature2 => {
        if (creature1.sexe != creature2.sexe && tanieres[creature1.espece] == creature2.hexId && creature2.toursDepuisRepro >= 5) {
            sameSexe = true;
            creature1.toursDepuisRepro = 0;
            creature2.toursDepuisRepro = 0;
        }
    });
    return sameSexe;
}

function listeCasesDispos(grid, espece, hexId){

    function inGrid(hexId) {
        var code = parseInt(hexId.slice(1));
        if (code > 0 || code < 168) {
            return true;
        }
        return false;
    }

    function forceSup(occupant) {
        if (occupant.force < playerStats[espece][2]) {
            return true;
        }
        return false;
    }

    var casesDispos = [];
    // répéter le nombre de fois la perception
    for (var percep=1; percep<=playerStats[espece][1]; percep++) {
        // liste d'adjacence qui se met a jour a chaque tour
        var adjacent = [hexIdTemp-(1*percep),hexIdTemp+(1*percep),hexIdTemp-(13*percep),hexIdTemp+(13*percep),hexIdTemp-(12*percep),hexIdTemp+(12*percep)];
        // pour chaque hexagone adjacent, check si il est dans la grille et si creature présente
        adjacent.forEach(hexIdTemp => {
            if (inGrid(hexIdTemp)) {
                creatures.filter(creature => creature.espece !== espece).forEach(creature => {
                    if (creature.hexId != hexIdTemp || forceSup(creature)) {
                        casesDispos.push(adjacent[i]);
                    }
                });
            }
        });
    }
    return casesDispos;
}

function tour(grid) {
    var casesPossible = [];
    creatures.forEach(creature => {
        // check taniere + tours depuis repro >= 5 + creature sexe opposé pour baiser
        if (tanieres[creature.espece] == creature.hexId && creature.toursDepuisRepro >= 5 && creatureAutreSexe(creature)) {
            for (var i=0; i<playerStats[creature.espece][0]; i++) {
                var rdSexe = sexes[Math.floor(Math.random() * sexes.length)];
                creatures.push(new creature(creature.hexId, creature.espece + (numberOfCreatures[creature.espece]+1), creature.color, rdSexe, creature.espece, 5, 5, 0));
                numberOfCreatures[creature.espece] += 1;
            }
        // check si stats >= 6 pour retour taniere
        } else if(creature.hydratation>=6 && creature.satiete>=6) {
            retourTaniere(creature);
            creature.hydratation -= 1.5;
            creature.satiete -= 0.75;                
            creature.toursDepuisRepro += 1;
        } else {
            // check cases adjacentes * perception innocupees ou si occupe, force > pour bouger
            // => liste avec les cases possibles
            var typeCasesDispos = []; 
            listeCasesDispos(grid, creature.espece, creature.hexId).forEach(hexId => {
                typeCasesDispos = hexList.filter(hex => hex[0] == hexId);
            });
            // si case eau présente
            if (typeCasesDispos.some(hex => hex.includes("blue"))) {
                // si case nourriture et faim => prairie
                if (typeCasesDispos.some(hex => hex.includes("green")) && creature.satiete < creature.hydratation) {
                    creature.hexId = typeCasesDispos.filter(hex => hex.includes("green"))[0];
                    creature.satiete += 2;
                // sinon eau
                } else {
                    creature.hexId = typeCasesDispos.filter(hex => hex.includes("blue"))[0];
                    creature.hydratation += 3;
                }
            // sinon rocher
            } else {
                creature.hexId = typeCasesDispos.filter(hex => hex.includes("brown"))[0];
            }
            // => réduire les cases possibles en fonction
            creature.hydratation -= 1.5;
            creature.satiete -= 0.75;
            creature.toursDepuisRepro += 1;
        }
        // check si creature décède
        if (creature.hydratation <= 0 || creature.satiete <= 0) {
            creatures.splice(creatures.indexOf(creature),1);
            numberOfCreatures[creature.espece] -= 1;
        }
    });
    io.emit("updateCreaturesPositions",creatures);
}