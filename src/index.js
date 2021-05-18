require('dotenv').config();

const Discord = require('discord.js');
const ytdl = require('ytdl-core');

const client = new Discord.Client();
var connectedGuilds = {};

const {a} = require('./util/info/a');
const cmdAliases = a;

const {c} = require('./util/info/c')
const cmdCommands = c;

// Dependencies
const request = require('request');

// Import utils
const error = require('./util/error');
const CMembed = require('./util/CMembed');
const asyncObj = require('./util/asyncObj')

// Import command modules
const commands = require('./commands')
const checkCommands = require('./util/checkCommand')

// Functions

function addGuild(guild){
    var set = new Object();
    set.applications = false;
    set.selApplications = false;
    set.selApplicationLink = "Error code 2 : 'Selected' Application link not set.";
    set.selRole = null;
    set.applicationLink = "Error code 2: Application link not set.";  
    set.prefix = "//";   
    set.queue = []; // music queue
    set.displayQueue = []; // music queue
    set.isPlaying = false;
    set.adminRole = null;
    set.connection = null;
    set.songAnnouncement = true;
    set.dispatcher = null;
    set.commandLogChannel = 'default'; // First text channel found in the server
    set.commandsLog = true; // default
    connectedGuilds[guild.id] = set;
    console.log(`[Guild ${guild.id}]: Added to connections.`);
}

function displayAlliases(message, page){
    if (page <= 0) return;
    var count = 0;
    var alliases = "";
    for (const [command, allias] of Object.entries(cmdAliases)){

        // Choice 1
        if (allias == null || allias.length == 0) continue;
        // Choice 2 is to put [empty] in place of the allias(es)
        count++;
        if (count > (page-1)*10 && count < page * 10){
            var newallias = `${connectedGuilds[message.guild.id].prefix}${command} : ${connectedGuilds[message.guild.id].prefix}${allias.join(", " + connectedGuilds[message.guild.id].prefix)}`;
            alliases = alliases + newallias + "\n";
        } else if (count > page * 10){
            break;
        }
    }

    if (alliases == ""){
        alliases = "[empty]";
    }

    // Used for music commands
    self = client.user;
    d = new Date();

    const embed = new Discord.MessageEmbed()
    .setTitle(`Command Alliases | Page ${page}`)
    .setColor(0x3286a6)
    .setTimestamp(d.toISOString())
    .setAuthor(`${self.username}#${self.discriminator}`, self.avatarURL({size : 256}))
    .setFooter(`Say ${connectedGuilds[message.guild.id].prefix}als [page number]`)
    .addField("\u2800", alliases, false);

    message.channel.send(embed);
}

function isAdmin(id, message){
    try{
        const guild = message.guild;
        if (id == guild.owner.id) return true; // The owner is permanent admin for their server.
        const admin = connectedGuilds[guild.id].adminRole;
        var adminRole = null;
        if (typeof(admin) === 'string'){
            adminRole = message.guild.roles.cache.find(role => role.id == admin);
        } else {
            adminRole = admin;
        }
        if(adminRole == null) { // Will return false if the role has not been set.
            return false;
        }
        if (message.member.roles.highest.position >= adminRole.position){
            return true;
        }
        return false;
    } catch (err) {
        console.log(`Error getting admin role: ${err}`);
        return false;
    };
}


function isURL(str) {
    var value = str.search("https://www.youtube.com/");
    if (value == -1) value = str.search("http://youtu.be");
    if (value == -1) value = str.search("https://youtu.be");
    if (value == -1) value = str.search("http://www.youtube.com/");
    if (value == -1){
        return false;
    }
    return true;
}

function playMusic(message){
    const vc = message.member.voice.channel || null;
    if(vc == null) return;
    if (connectedGuilds[message.guild.id].isPlaying) return;
    if(connectedGuilds[message.guild.id].queue.length == 0){
        client.guilds.fetch(message.guild.id).then(async guild => {
            await guild.members.fetch(client.user.id).then(async self => {
                message.channel.send("Queue empty.");
                self.voice.kick();
            });
        });
    }
    try {
        const showJoinMessage = (connectedGuilds[message.guild.id].dispatcher == null) ? true : false;
        connectedGuilds[message.guild.id].connection = vc.join().then(async connection =>{
            const stream = ytdl(connectedGuilds[message.guild.id].queue[0], { filter: 'audioonly' });
            connectedGuilds[message.guild.id].isPlaying = true;
            if (connectedGuilds[message.guild.id].songAnnouncement){
                self = client.user;

                const songTitle = await ytdl.getInfo(connectedGuilds[message.guild.id].queue[0]).then(info => {
                    return info.videoDetails.title;
                })
    
                const d = new Date();
                const embed = new Discord.MessageEmbed()
                .setTitle(`Now playing`)
                .setColor(0x3286a6)
                .setTimestamp(d.toISOString())
                .setAuthor(`${self.username}#${self.discriminator}`, self.avatarURL({size : 256}))
                .setFooter(`Say ${connectedGuilds[message.guild.id].prefix}queue [page number] to view the song queue`)
                .addField("\u2800", `Now playing: [${songTitle}](${connectedGuilds[message.guild.id].queue[0]})`, false);

                message.channel.send(embed);
            }
            try{
                if (showJoinMessage) {
                    CMembed(Discord, client, embed => {
                        embed.addField("\u2800", `Joined and bound bot to ${message.member.voice.channel}`, false);
                        message.channel.send(embed);
                    });
                }
                connectedGuilds[message.guild.id].dispatcher = connection.play(stream);
            } catch (err) {
                error(Discord,client,message, embed => {
                    embed.addField("\u2800", `An error occured trying to play ${connectedGuilds[message.guild.id].queue[0]}`);
                    embed.setFooter("Error")
                    message.channel.send(embed);
                    console.log("Error Code 14 called, URL required for playing music.")
                });
                connectedGuilds[message.guild.id].queue.splice(0,1);
                play(message);
                return;
            }
            
            if (connectedGuilds[message.guild.id].dispatcher == null){
                return;
            }
    
            connectedGuilds[message.guild.id].dispatcher.on('finish', () => {
                connectedGuilds[message.guild.id].queue.splice(0,1);
                connectedGuilds[message.guild.id].dispatcher.destroy();
                connectedGuilds[message.guild.id].dispatcher = null;
                connectedGuilds[message.guild.id].isPlaying = false;
                playMusic(message);
            });
        })
        .catch(err => console.log(err));
    } catch (err){
        console.log(err);
    }
}

function isMyGuild(message){
    const guild = message.guild;
    if (guild.id == '823487710068080690') {
        return true;
    }
    return false;
}

function displayQueue(message, p){
    var d = new Date();

    message.channel.send("Fetching queue...").then(async msg  => {
        let page;
        try{
            page = parseInt(p);
            
            var tQueue = "";
            const tdisplayQueue = connectedGuilds[message.guild.id].displayQueue;
            console.log(`Display queue: ${tdisplayQueue}`);

            for (i = (page-1)*10; i < tdisplayQueue.length; i++){
                if(i === page * 10) break;
                tQueue = tQueue + `${i+1}: ${tdisplayQueue[i]}`;
            }

            if(tQueue.length === 1){
                tQueue = "[empty]";
            }

            // Show gathered queue
        
            self = client.user;
        
            const embed = new Discord.MessageEmbed()
            .setTitle(`Music Queue | Page ${page}`)
            .setColor(0x3286a6)
            .setTimestamp(d.toISOString())
            .setAuthor(`${self.username}#${self.discriminator}`, self.avatarURL({size : 256}))
            .setFooter(`Say ${connectedGuilds[message.guild.id].prefix}queue [page number]`)
            .addField("\u2800", tQueue, false);
    
            msg.delete();
            message.channel.send(embed);
        } catch (err){
            console.log(err);
            msg.edit("Unable to fetch queue...");
            return;
        }
    });
}


/* EVENT HOOKS */

client.on('ready', () => {
    client.user.setPresence({ activity: { name: `Prefix ${"//"}`, type: "STREAMING", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&ab_channel=RickAstleyVEVO"}, status: 'dnd' })
    .catch(console.error);
    console.log("--------------\n\nBot loaded........online");
});

client.on('message', message => {
    if (connectedGuilds[message.guild.id] == null){
        addGuild(message.guild);
    }
});

commands(Discord, client, connectedGuilds, (message, command) => {

    client.guilds.fetch(message.guild.id).then(async guild => {
        await guild.members.fetch(client.user.id).then(async self => {
            // Used for embeds, timestamp
            var d = new Date();

            // Whether a command was found or not
            var logCommand = false;

            // Play command
            if (command == "play"){
                logCommand = true;
                if (message.member.voice.channel){
                    if(self != null){
                        if(self.voice.channel != message.member.voice.channel){                                                                                    // New command
                            if (self.voice.channel != null) {
                                error(Discord,client,message, embed => {
                                    embed.addField("\u2800", "Error Code: 11");
                                    message.channel.send(embed);
                                    console.log("Error Code 11 called, trying to play audio while not in channel with bot.")
                                });
                                return;
                            }
                        }
                    } else {
                        error(Discord,client,message, embed => {
                            embed.addField("\u2800", "Error Code: 12");
                            message.channel.send(embed);
                            console.log("Error Code 12 called, unable to establish 'self' : bot member instance.");
                        });
                        return;
                    }
                } else {
                    error(Discord,client,message, embed => {
                        embed.addField("\u2800", "Error Code: 11");
                        message.channel.send(embed);
                        console.log("Error Code 11 called, trying to play audio while not in channel with bot.")
                    });
                    return;
                }
                var URL = message.content.split(" ")[1] || "&*-_empty(1@3"; // If empty, the playMusic function should skip over it.

                if (URL == "&*-_empty(1@3") {
                    error(Discord,client,message, embed => {
                        embed.addField("\u2800", "Error Code: 14");
                        embed.setFooter("Error: YouTube URL required")
                        message.channel.send(embed);
                        console.log("Error Code 14 called, YouTube URL required for playing music.")
                    });
                    return;
                }
                if (!isURL(URL)){
                    
                    var query = message.content.split(" ");
                    query.splice(0,1);
                    query = query.join("+")
                    const queryURL = `https://www.youtube.com/results?search_query=${query}`;
                    console.log(queryURL);
                    request(queryURL, async (error, response, body) => {
                        // console.error(error);
                        var firstVideoIndex = body.toLowerCase().indexOf('watch?v=');
                        const videoId = body.substr(firstVideoIndex, firstVideoIndex+19);
                        const link = `https://www.youtube.com/${videoId.split('"')[0].split("\\u0026")[0]}`;
                        console.log(`Link: ${link}`);
                        connectedGuilds[message.guild.id].queue.push(link);

                        console.log("Starting display log...")
                        await ytdl.getInfo(link).then(info => {
                            connectedGuilds[message.guild.id].displayQueue.push(`[${info.videoDetails.title}](${link})\n`);
                            console.log(`Adding song to display queue: ${link}`);
                        })
                        console.log("Ending display log...")

                        playMusic(message);
                    });
                } else {
                    connectedGuilds[message.guild.id].queue.push(URL);
                    console.log("Starting display log...")
                        await ytdl.getInfo(URL).then(info => {
                            connectedGuilds[message.guild.id].displayQueue.push(`[${info.videoDetails.title}](${URL})\n`);
                            console.log(`Adding song to display queue: ${URL}`);
                        })
                        console.log("Ending display log...")
                    playMusic(message);
                }
            }

            // Queue command
            if (command == "queue"){
                logCommand = true;
                const page = message.content.split(" ")[1] || '1';
                displayQueue(message, page);
            }

            // Skip song command
            if (command == "skip") {
                logCommand = true;
                if (self == null) return;
                if (message.member.voice.channel){
                    if(self.voice.channel == message.member.voice.channel){
                        connectedGuilds[message.guild.id].isPlaying = false;
                        connectedGuilds[message.guild.id].queue.splice(0,1);
                        playMusic(message);  
                        message.channel.send("Skipped!")
                    }
                }
            }

            // Pause command
            if (command == "pause") {
                error(Discord,client,null, embed => {
                    embed.addField("\u2800", "Pause command not added.", false);
                    embed.setFooter("Resuming paused song faulty");
                    message.channel.send(embed);
                });
                // Won't log, return not required.
            }

            // Join voice channel command
            if (command == "join"){
                logCommand = true;
                try{
                    message.member.voice.channel.join().then( () => {
                        CMembed(Discord, client, embed => {
                            embed.addField("\u2800", `Joined and bound bot to ${message.member.voice.channel}`, false);
                            message.channel.send(embed);
                        });
                    }).catch(function(){
                        error(Discord,client,message, embed => {
                            embed.addField("\u2800", "Error Code: 11");
                            message.channel.send(embed);
                            console.log("Error Code 11 called, attempting to make bot join channel : not in voice channel.");
                        });
                        return;
                    });
                } catch (err) {
                    error(Discord,client,message, embed => {
                        embed.addField("\u2800", "Error Code: 11");
                        message.channel.send(embed);
                        console.log("Error Code 11 called, attempting to make bot join channel : not in voice channel.");
                    });
                    return;
                }
            }

            // Leave voice channel command
            if (command == "leave"){
                logCommand = true;
                if (self == null) return;
                if (message.member.voice.channel){
                    if(self.voice.channel != message.member.voice.channel || self.voice.channel == null){ 
                        connectedGuilds[message.guild.id].queue = [];                                                             // New command
                        error(Discord,client,message, embed => {
                            embed.addField("\u2800", "Error Code: 11");
                            message.channel.send(embed);
                            console.log("Error Code 11 called, attempting to make bot leave channel : not in voice channel with bot.");
                        });
                        return;
                    }
                } else {
                    error(Discord,client,message, embed => {
                        embed.addField("\u2800", "Error Code: 11");
                        message.channel.send(embed);
                        console.log("Error Code 11 called, attempting to make bot leave channel : not in voice channel.");
                    });
                    return;
                }
                self.voice.kick();
                connectedGuilds[message.guild.id].dispatcher = null;
            }

            // Alias command
            if (command == "aliases") {
                logCommand = true;
                const page = message.content.split(" ")[1] || '1';
                displayAlliases(message,page);
            }

            // Show commands command
            if (command == "cmds"){
                logCommand = true;
                var sCommands = "";
                var page = message.content.split(" ")[1] || '1';
                try{
                    page = parseInt(page);
                    for(i = (page-1) * 10; i < Math.min(cmdCommands.length,page*10); i++){
                        sCommands = sCommands + `${i+1}. ${connectedGuilds[message.guild.id].prefix}${cmdCommands[i]}\n`;
                    }

                    if (sCommands == ""){
                        sCommands = "[empty]";
                    }
        
                    CMembed(Discord,client, embed => {
                        embed.setTitle(`Commands | Page ${page}`);
                        embed.setFooter(`Say ${connectedGuilds[message.guild.id].prefix}cmds [page number]`);
                        embed.addField("\u2800", sCommands, false);
                        message.channel.send(embed);
                    });
                } catch (err) {
                    console.log(err);
                }
            }

            // Open apps command
            if (command == "openapps" && isAdmin(message.author.id, message)){
                logCommand = true;
                const guild = message.guild;
                if (connectedGuilds[guild.id].applications == true){
                    error(Discord, client, message, embed => {
                        embed.addField("\u2800", "Application is already open : limit of 1 open per server.", false);
                        message.channel.send(embed);
                    });
                    return;
                }
                const appTitle = "Application";
                const appURL = message.content.split(" ")[1] || connectedGuilds[guild.id].applicationLink;
                CMembed(Discord, client, embed => {
                    embed.addField("\u2800", appURL, false);
                    embed.setDescription("This is what your applicant will see.");
                    embed.setFooter("Application opened at")
                    embed.setTitle(appTitle);
                    message.channel.send(embed);
                });
                connectedGuilds[guild.id].applicationLink = appURL;
                connectedGuilds[guild.id].applications = true;
            }

            // Close apps command
            if (command == "closeapps" && isAdmin(message.author.id, message)){
                logCommand = true;
                const guild = message.guild;
                if (connectedGuilds[guild.id].applications == false){
                    error(Discord,client,message, embed => {
                        embed.addField("\u2800", "Applications are not open : no applications to close.", false);
                        message.channel.send(embed);
                    });
                    return;
                }
                CMembed(Discord,client,embed => {
                    embed.addField("\u2800", `Application closed by ${message.member}`,false);
                    embed.setFooter("Application closed at");
                    embed.setTitle("Application closed");
                    message.channel.send(embed);
                });
                connectedGuilds[guild.id].applicationLink = "Error code 2 : Application link not set.";
                connectedGuilds[guild.id].applications = false;
            }

            // Apply command
            if (command == "apply"){
                logCommand = true;
                CMembed(Discord,client,embed => {
                    embed.setTitle("Application");
                    embed.setDescription(connectedGuilds[guild.id].applicationLink);
                    message.author.send(embed);
                });
            }

            //Change command
            if (command == "change" && isAdmin(message.author.id, message)){
                logCommand = true;
                var changeType = message.content.split(" ")[1] || null;
                if (changeType != null){
                    const guild = message.guild;
                    changeType = changeType.toLowerCase();
                    // Prefix
                    if(changeType == 'prefix'){
                        const newPrefix = message.content.split(" ")[2] || null;
                        if (newPrefix == null) {
                            error(Discord,client,_,embed => {
                                embed.addField("\u2800","Error Code: 404", false);
                                message.channel.send(embed);
                            });
                            return;
                        }
                        if(newPrefix.length == 1) {
                            connectedGuilds[guild.id].prefix = newPrefix;
                            CMembed(Discord,client,embed => {
                                embed.setDescription(`New prefix set: ${newPrefix}`);
                                message.channel.send(embed);
                            });
                        } else {
                            error(Discord,client,_,embed => {
                                embed.addField("\u2800","Prefix must be 1 character in length", false);
                                message.channel.send(embed);
                            });
                            return;
                        }
                    }

                    // Commands log to a channel (true / false)
                    if(changeType == 'logcommands'){
                        const newValue = message.content.split(" ")[2] || null;
                        if (newValue == null) {
                            error(Discord,client,_,embed => {
                                embed.addField("\u2800","Error Code: 404", false);
                                message.channel.send(embed);
                            });
                            return;
                        }
                        if(newValue.toLowerCase() == 'true') {
                            connectedGuilds[guild.id].commandsLog = true;
                            CMembed(Discord,client,embed => {
                                var channel = message.guild.channels.cache.filter(chx => chx.type === "text").find(x => x.position === 0) || null;
                                const newChannel = (connectedGuilds[guild.id].commandLogChannel == 'default') ? (channel.id || "Err: no channel found") : connectedGuilds[guild.id].commandLogChannel;
                                embed.setDescription(`Commands now log to ${newChannel}`);
                                embed.setFooter('Command logging : true');
                                message.channel.send(embed);
                            });
                        } else if (newValue.toLowerCase() == 'false') {
                            connectedGuilds[guild.id].commandsLog = false;
                            CMembed(Discord,client,embed => {
                                embed.setDescription(`Commands will not be logged`);
                                embed.setFooter('Command logging : false');
                                message.channel.send(embed);
                            });
                        } else {
                            error(Discord,client,null,embed => {
                                embed.addField("\u2800","logcommands value must either be 'true' or 'false'", false);
                                embed.addField("\u2800", "Case does not matter", false);
                                message.channel.send(embed);
                            });
                            return;
                        }
                    }
                    
                    // Log Channel
                    if(changeType == 'log') {
                        var newChannel = message.content.split(" ")[2] || null;
                        if (newChannel == null) {
                            error(Discord,client,_,embed => {
                                embed.addField("\u2800","Error Code: 404", false);
                                message.channel.send(embed);
                            });
                            return;
                        }
                        if(newChannel.search("#") == -1) { // id
                            connectedGuilds[guild.id].commandLogChannel = newChannel;
                            CMembed(Discord,client,embed => {
                                embed.setDescription(`New log channel set: ${newChannel}`);
                                message.channel.send(embed);
                            });
                        } else {
                            newChannel = newChannel.replace("<#","");
                            newChannel = newChannel.replace(">","");
                            newChannel = newChannel.replace("#","");
                            try {
                                connectedGuilds[guild.id].commandLogChannel = newChannel;
                                CMembed(Discord,client,embed => {
                                    embed.setDescription(`New log channel set: ${newChannel}`);
                                    message.channel.send(embed);
                                });
                            } catch (err) {
                                error(Discord,client,null,embed => {
                                    embed.addField("\u2800","Error Code: 404", false);
                                    message.channel.send(embed);
                                });
                                console.log(err);
                                return;
                            }
                        }
                    }

                    // Admin Role
                    if(changeType == 'admin') {
                        var newAdmin = message.content.split(" ")[2] || null;
                        if (newAdmin == null) {
                            error(Discord,client,null,embed => {
                                embed.addField("\u2800","Error Code: 404", false);
                                message.channel.send(embed);
                            });
                            return;
                        }
                        if(newAdmin.search("@") == -1) { // id
                            connectedGuilds[guild.id].adminRole = newAdmin;
                            CMembed(Discord,client,embed => {
                                embed.setDescription(`New admin role set: ${newAdmin}`);
                                message.channel.send(embed);
                            });
                        } else {
                            newAdmin = newAdmin.replace("<@&","");
                            newAdmin = newAdmin.replace(">","");
                            newAdmin = newAdmin.replace("@","");
                            try {
                                newAdmin = parseInt(newAdmin);
                                connectedGuilds[guild.id].adminRole = newAdmin.toString();
                                CMembed(Discord,client,embed => {
                                    embed.setDescription(`New admin role set: ${newAdmin}`);
                                    message.channel.send(embed);
                                });
                            } catch (err) {
                                error(Discord,client,null,embed => {
                                    embed.addField("\u2800","Error Code: 404", false);
                                    message.channel.send(embed);
                                });
                                console.log(err);
                                return;
                            }
                        }
                    }

                    if (changeType != 'admin' && changeType != "log" && changeType != "logcommands" && changeType != "prefix"){
                        error(Discord,client,null,embed => {
                            embed.addField("\u2800","Invalid change type", false);
                            embed.addField("\u2800",`Use ${connectedGuilds[guild.id].prefix}change without parameters to get a list of all valid change types.\nie. '${connectedGuilds[guild.id].prefix}change'`, false);
                            message.channel.send(embed);
                        });
                        return;
                    }
                } else {
                    CMembed(Discord,client,embed => {
                        embed.setTitle("Settings to change");
                        const settings = "1. prefix (server prefix)\n2. log (logging channel)\n3. admin (bot admin role)\n4. logcommands (true/false)";
                        embed.addField("\u2800", settings, false);
                        message.channel.send(embed);
                        return;
                    });
                }
            }

            // Help command
            if (command == "help"){
                logCommand = true;
                const guild = message.guild;
                CMembed(Discord, client, embed => {
                    embed.setDescription(`Use ${connectedGuilds[guild.id].prefix}cmds to view a list of commands with their corresponding syntax.\nUse ${connectedGuilds[guild.id].prefix}als to view a list of command aliases.`);
                    embed.addField("\u2800","Join [the official Code Mentors Discord](https://discord.gg/mUNtDtD4dP) to get futher help or to report a bug in the bot.",false);
                    message.channel.send(embed);
                });
            }

            // Say command
            if (command == "say" && isAdmin(message.author.id, message)){
                logCommand = true;
                var msg = message.content.split(" ");
                msg.splice(0,1);
                msg = msg.join(" ");
                message.channel.send(msg);
                message.delete();
            }

            // Anouncement command : limited to Code Mentors server
            if (command == "announcement" && isAdmin(message.author.id, message) && isMyGuild(message)) {
                logCommand = true;
                const channel = message.guild.channels.cache.get('823686234248445983');
                var msg = message.content.split(" ");
                msg.splice(0,1);
                msg = msg.join(" ");
                const annMessage = channel.send(msg).then(msg => {
                    msg.crosspost();
                });
            } else if(command == "announcement"){
                error(Discord,client,null, embed => {
                    embed.addField("\u2800", "Command restricted to [the official Code Mentors Discord](https://discord.gg/mUNtDtD4dP)",false);
                    message.channel.send(embed);
                });
            }

            // Program update (announcement) command : limited to Code Mentors server
            if (command == "progupdate" && isAdmin(message.author.id, message) && isMyGuild(message)) {
                logCommand = true;
                const channel = message.guild.channels.cache.get('823686308869832755');
                var msg = message.content.split(" ");
                msg.splice(0,1);
                msg = msg.join(" ");
                const annMessage = channel.send(msg).then(msg => {
                    msg.crosspost();
                });
            } else if(command == "progupdate"){
                error(Discord,client,null, embed => {
                    embed.addField("\u2800", "Command restricted to [the official Code Mentors Discord](https://discord.gg/mUNtDtD4dP)",false);
                    message.channel.send(embed);
                });
            }

            /* IF A COMMAND WAS USED, LOG IT TO THE SERVER'S LOGGING CHANNEL */
            if(logCommand && connectedGuilds[message.guild.id].commandsLog) {
                message.delete();
                if(connectedGuilds[message.guild.id].commandLogChannel == 'default'){
                    var channel = message.guild.channels.cache.filter(chx => chx.type === "text").find(x => x.position === 0) || null;
                    if (message.guild.id == "823487710068080690"){
                        channel = message.guild.channels.cache.get("824148305013243944");
                    }
                    if (channel == null) { // no text channels found
                        return;
                    }
                    CMembed(Discord,client,embed => {
                        embed.setAuthor(message.author.tag, message.author.avatarURL({size : 256}));
                        embed.setDescription(`Command used in ${message.channel}`);
                        embed.addField("\u2800", message.content, false);
                        channel.send(embed);
                    });
                } else {
                    const channel = message.guild.channels.cache.get(connectedGuilds[message.guild.id].commandLogChannel);
                    if (message.guild.id == "823487710068080690"){
                        channel = message.guild.channels.cache.get("824148305013243944");
                    }
                    if (channel == null) { // no text channels found
                        return;
                    }
                    CMembed(Discord,client,embed => {
                        embed.setAuthor(message.author.tag, message.author.avatarURL({size : 256}));
                        embed.setDescription(`Command used in ${message.channel}`);
                        embed.addField("\u2800", message.content, false);
                        channel.send(embed);
                    });
                }
            }



            if(command == "verify"){
                error(Discord,client,message, embed => {
                    embed.setTitle("Command not available");
                    embed.setFooter("Command being developed");
                    message.channel.send(embed);
                });
                return;
            }

        })
    })
    .catch(err => console.log(err));
});

client.on("messageDelete", message => {
    if (message.author == client.user) return;
    const result = checkCommands(connectedGuilds[message.guild.id].prefix,message.content.split(" ")[0], result => {
        if (result == true || message.content.length == 0 || message.content.split(" ")[0].search("change") != -1) return;

        if(connectedGuilds[message.guild.id].commandLogChannel == 'default'){
            var channel = message.guild.channels.cache.filter(chx => chx.type === "text").find(x => x.position === 0) || null;
            if (message.guild.id == "823487710068080690"){
                channel = message.guild.channels.cache.get("824148305013243944");
            }
            if (channel == null) { // no text channels found
                return;
            }
            CMembed(Discord,client,embed => {
                embed.setAuthor(message.author.tag, message.author.avatarURL({size : 256}));
                embed.setFooter("Message Deleted");
                embed.setDescription(`Message deleted in ${message.channel}`);
                embed.addField("\u2800", message.content, false);
                channel.send(embed);
            });
        } else {
            var channel = message.guild.channels.cache.get(connectedGuilds[message.guild.id].commandLogChannel);
            if (message.guild.id == "823487710068080690"){
                channel = message.guild.channels.cache.get("824148305013243944");
            }
            if (channel == null){
                return;
            }
            CMembed(Discord,client,embed => {
                embed.setAuthor(message.author.tag, message.author.avatarURL({size : 256}));
                embed.setFooter("Message Deleted");
                embed.setDescription(`Message deleted in ${message.channel}`);
                embed.addField("\u2800", message.content, false);
                channel.send(embed);
            });
        } 
    });
});

client.on("messageUpdate", (oldMsg, newMsg) => {
    const self = client.user;
    if (oldMsg.content == newMsg.content || oldMsg.author == self) return;
    if(connectedGuilds[oldMsg.guild.id].commandLogChannel == 'default'){
        var channel = oldMsg.guild.channels.cache.filter(chx => chx.type === "text").find(x => x.position === 0) || null;
        if (channel == null) { // no text channels found
            return;
        }
        CMembed(Discord,client,embed => {
            embed.setAuthor(oldMsg.author.tag, oldMsg.author.avatarURL({size : 256}));
            embed.setFooter("Message Updated");
            embed.setDescription(`Message edited in ${oldMsg.channel}`);
            embed.addField("Old Message", oldMsg.content, false);
            embed.addField("New Message", newMsg.content, false);
            channel.send(embed);
        });
    } else {
        const channel = oldMsg.guild.channels.cache.get(connectedGuilds[oldMsg.guild.id].commandLogChannel);
        if (channel == null){
            return;
        }
        CMembed(Discord,client,embed => {
            embed.setAuthor(oldMsg.author.tag, oldMsg.author.avatarURL({size : 256}));
            embed.setFooter("Message Updated");
            embed.setDescription(`Message edited in ${oldMsg.channel}`);
            embed.addField("Old Message", oldMsg.content, false);
            embed.addField("New Message", newMsg.content, false);
            channel.send(embed);
        });
    }
});

client.on("guildCreate", guild => {
    addGuild(guild);
});

client.login(process.env.DISCORD_BOT_TOKEN);
