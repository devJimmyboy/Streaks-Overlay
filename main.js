let debug = false;
function log(message) { if (debug) { console.log(message); } }

// Get URL Parameters (Credit to html-online.com)
function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m, key, value) { vars[key] = value; });
    return vars;
}
function getUrlParam(parameter, defaultvalue){
    var urlparameter = defaultvalue;
    if (window.location.href.indexOf(parameter) > -1) { urlparameter = getUrlVars()[parameter]; }
    return urlparameter;
}

let channel = getUrlParam('channel','abc123');
log(channel);
let emotes = [];

async function getEmotes(check) {
    const proxyurl = 'https://cors-anywhere.herokuapp.com/';

    // get FFZ emotes
    let res = await fetch('https://api.frankerfacez.com/v1/room/' + channel, {
        method: "GET"
        }).then(function(response) { return response.json() },
        function(error) { log(error.message); }
    );
    if (!res.error) {
        let setName = Object.keys(res.sets);
        for (var k = 0; k < setName.length; k++) {
            for (var i = 0; i < res.sets[setName[k]].emoticons.length; i++) {
                let emote = {
                    emoteName: res.sets[setName[k]].emoticons[i].name,
                    emoteURL: 'https://' + res.sets[setName[k]].emoticons[i].urls['1'].split('//').pop()
                }
                emotes.push(emote);
            }
        }
    } else { log('Error getting twitch ffz emotes'); }
    // get all global ffz emotes
    res = await fetch('https://api.frankerfacez.com/v1/set/global', {
        method: "GET"
        }).then(function(response) { return response.json() },
        function(error) { log(error.message); }
    );
    if (!res.error) {
        let setName = Object.keys(res.sets);
        for (var k = 0; k < setName.length; k++) {
            for (var i = 0; i < res.sets[setName[k]].emoticons.length; i++) {
                let emote = {
                    emoteName: res.sets[setName[k]].emoticons[i].name,
                    emoteURL: 'https://' + res.sets[setName[k]].emoticons[i].urls['1'].split('//').pop()
                }
                emotes.push(emote);
            }
        }
    } else { log('Error getting twitch ffz emotes'); }
    // get all BTTV emotes
    res = await fetch('https://api.betterttv.net/2/channels/' + channel, {
        method: "GET"
        }).then(function(response) { return response.json() },
        function(error) { log(error.message); }
    );
    if (!res.message) {
        for (var i = 0; i < res.emotes.length; i++) {
            let emote = {
                emoteName: res.emotes[i].code,
                emoteURL: `https://cdn.betterttv.net/emote/${res.emotes[i].id}/1x`
            }
            emotes.push(emote);
        }
        log(emotes);
    } else { log('Error getting twitch bttv emotes'); }
    // global bttv emotes
    res = await fetch('https://api.betterttv.net/3/cached/emotes/global', {
        method: "GET"
        }).then(function(response) { return response.json() },
        function(error) { log(error.message); }
    );
    if (!res.message) {
        for (var i = 0; i < res.length; i++) {
            let emote = {
                emoteName: res[i].code,
                emoteURL: `https://cdn.betterttv.net/emote/${res[i].id}/1x`
            }
            emotes.push(emote);
        }
        log(emotes);
    } else { log('Error getting twitch bttv emotes'); }
}

let currentStreak = { streak: 1, emote: null, emoteURL: null }; // the current emote streak being used in chat
let currentEmote; // the current emote being used in chat
let showEmoteCooldown = new Date(); // the emote shown from using the !showemote <emote> command
let minStreak = (getUrlParam('minStreak', 5) > 1) ? getUrlParam('minStreak', 5) : 5; // minimum emote streak to trigger overlay effects
let streakCD; // remove streak from overlay if it hasnt changed in a while

function findEmotes(message, messageFull) {
    if (emotes.length !== 0) {
        let emoteUsedPos = (messageFull[4].startsWith('emotes=')) ? 4 : 5;
        let emoteUsed = messageFull[emoteUsedPos].split('emotes=').pop();
        messageSplit = message.split(' ');
        if (messageSplit.includes(currentStreak.emote)) { currentStreak.streak++; } // add to emote streak
        else if (messageFull[emoteUsedPos].startsWith('emotes=') && emoteUsed.length > 1) { // default twitch emotes
            currentStreak.streak = 1;
            currentStreak.emote = message.substring(parseInt(emoteUsed.split(':')[1].split('-')[0]), parseInt(emoteUsed.split(':')[1].split('-')[1]) + 1);
            currentStreak.emoteURL = `https://static-cdn.jtvnw.net/emoticons/v1/${emoteUsed.split(':')[0]}/1.0`;
        }
        else { // find bttv/ffz emotes
            currentStreak.streak = 1;
            currentStreak.emote = findEmoteInMessage(messageSplit);
            currentStreak.emoteURL = findEmoteURLInEmotes(currentStreak.emote);
        }

        function findEmoteInMessage(message) {
            for (const emote of emotes.map(a => a.emoteName)) {
                if (message.includes(emote)) { return emote; }
            }
            return null;
        }
        function findEmoteURLInEmotes(emote) {
            for (const emoteObj of emotes) {
                if (emoteObj.emoteName == emote) { return emoteObj.emoteURL; }
            }
            return null;
        }
        streakEvent();
    }
}

function streakEvent() {
    if (currentStreak.streak >= minStreak) {
        $('#main').empty();
        $('#main').css("position","absolute");
        $('#main').css("top","650");
        var img = $('<img />', {src : currentStreak.emoteURL });
        img.appendTo('#main');
        var streakLength = $('#main').append(' x' + currentStreak.streak + ' streak!');
        streakLength.appendTo('#main');
        $('#main').css("visibility","visible");
        gsap.to("#main", 0.15, { scaleX: 1.2, scaleY: 1.2, onComplete: downscale });
        function downscale() {
            gsap.to("#main", 0.15, { scaleX: 1, scaleY: 1 });
        }
        streakCD = $('#main').html();
        setTimeout(() => {
            if (streakCD === $('#main').html()) {
                gsap.to("#main", 0.2, { scaleX: 0, scaleY: 0, onComplete: vanish });
            }
            function vanish() {
                log('forcing streak hide'); $('#main').css("visibility","hidden");
            }
        }, 5 * 1000);
    }
    if (currentStreak.streak < minStreak) { log('streak changed, now hiding..'); $('#main').css("visibility","hidden"); }
}

function showEmote(message, messageFull) {
    if (emotes.length !== 0) {
        let emoteUsedPos = (messageFull[4].startsWith('emotes=')) ? 4 : 5;
        let emoteUsedID = messageFull[emoteUsedPos].split('emotes=').pop();
        messageSplit = message.split(' ');
        if (emoteUsedID.length == 0) {
            let emoteUsed = findEmoteInMessage(messageSplit);
            let emoteLink = findEmoteURLInEmotes(emoteUsed);
            if (emoteLink) { return showEmoteEvent({ emoteName: emoteUsed, emoteURL: emoteLink }); }
        }
        else {
            let emoteUsed = message.substring(parseInt(emoteUsedID.split(':')[1].split('-')[0]), parseInt(emoteUsedID.split(':')[1].split('-')[1]) + 1);
            let emoteLink = `https://static-cdn.jtvnw.net/emoticons/v1/${emoteUsedID.split(':')[0]}/1.0`;
            return showEmoteEvent({ emoteName: emoteUsed, emoteURL: emoteLink });
        }
        function findEmoteInMessage(message) {
            for (const emote of emotes.map(a => a.emoteName)) {
                if (message.includes(emote)) { return emote; }
            }
            return null;
        }
        function findEmoteURLInEmotes(emote) {
            for (const emoteObj of emotes) {
                if (emoteObj.emoteName == emote) { return emoteObj.emoteURL; }
            }
            return null;
        }
    }
}

function showEmoteEvent(emote) {
    const cooldownTime = 5; // seconds
    let secondsDiff = (new Date().getTime() - new Date(showEmoteCooldown).getTime()) / 1000;
    log(secondsDiff)
    if (secondsDiff > cooldownTime) {
        showEmoteCooldown = new Date();
        var canvas = document.querySelector('#mars');
        var image = emote.emoteURL;
        function getMeta(url, callback) {
            var img = new Image();
            img.src = url;
            img.onload = function() { callback(this.width, this.height); }
        }
        getMeta(image, function(width, height) {
            var max_height = 720;
            var max_width = 1280;
            function getRandomCoords() {
                var r = [];
                var x = Math.floor(Math.random() * max_width);
                var y = Math.floor(Math.random() * max_height);
            
                r = [x, y];
                return r;
            };
            function createImage() {
                log(1)
                var node = document.createElement('img');
                var xy = getRandomCoords();
            
                node.id = "showEmote";
                node.style.position = 'absolute';
                node.style.top = xy[1] + 'px';
                node.style.left = xy[0] + 'px';
                node.setAttribute('src', image);
                canvas.appendChild(node);
                setTimeout(() => {
                    $('#mars').empty();
                }, 4 * 1000);
            }
            createImage();
        });
    }
}

// Connecting to twitch chat
function connect() {

    const chat = new WebSocket("wss://irc-ws.chat.twitch.tv");
    var timeout = setTimeout(function() {
        chat.close();
        chat.connect();
    }, 10 * 1000);

    chat.onopen = function() {
        clearInterval(timeout);
        chat.send("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership");
        chat.send("PASS oauth:xd123");
        chat.send("NICK justinfan123");
        chat.send("JOIN #" + channel);
        getEmotes();
    };

    chat.onerror = function() {
        log("There was an error.. disconnected from the IRC");
        chat.close();
        chat.connect();
    };

    chat.onmessage = function(event) {
        let messageFull = event.data.split(/\r\n/)[0].split(`;`);
        log(messageFull)
        if (messageFull.length > 12) {
            let messageBefore = messageFull[messageFull.length - 1].split(`${channel} :`).pop(); // gets the raw message
            let message = (messageBefore.split(' ').includes('ACTION')) ? messageBefore.split('ACTION ').pop().split('')[0] : messageBefore; // checks for the /me ACTION usage and gets the specific message
            if (message.toLowerCase().startsWith('!showemote')) { showEmote(message, messageFull); }
            findEmotes(message, messageFull)
        }
        if (messageFull.length == 1 && messageFull[0].startsWith("PING")) {
            log('sending pong')
            chat.send("PONG")
        }
    };
}