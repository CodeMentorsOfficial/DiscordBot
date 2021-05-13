require('dotenv').config();

const Discord = require('discord.js');

var applications = false;
var applicationLink = "Error code 2: Contact someone with the @Admin or @Mentor role.";

var prefix = ":";

const client = new Discord.Client();



/* FUNCTIONS */

function isAdmin(id, message){
    const adminRole = message.guild.roles.cache.find(role => role.name == "Admin");
    if (message.member.roles.highest.position >= adminRole.position){
        return true;
    }
    return false;
}

function errorMessage(msg, message){
    const mentorRole = message.guild.roles.cache.find(role => role.name == "Mentor");
    const embed = new Discord.MessageEmbed()
    .setTitle("Error")
    .setDescription(msg)
    .addField("\u2800",`Contact anyone with the ${mentorRole || "@Mentor"} role to report a bug with the bot.`,false)
    .setColor(0xcc0000);

    message.channel.send(embed);
}

/* EVENT HOOKS */

client.on('ready', () => {
    const channel = client.channels.cache.find(channel => channel.id === "824148305013243944") || null;
    if (channel != null){
        channel.send("Bot restarted.");
    }
    client.user.setActivity(`Prefix ${prefix}`, { type: 'WATCHING' })
        .catch(console.error);
    client.user.setStatus('dnd')
        .catch(console.error);
    // Final line of code .. display ready in log
    console.log(`The bot has logged in as ${client.user.tag}`);
});

client.on('message', (message) => {
    var adminRole = null;
    var logCommandUsed = false;
    var d = new Date();
    if(message.guild){
        // Used for error message
        adminRole = message.guild.roles.cache.find(role => role.name == "Admin");
    }

    var cmd = message.content.split(" ")[0].toLowerCase(); //[prefix][command]

    if(cmd == prefix + "openapps" && isAdmin(message.author.id, message)){                                                    // New Command 
        logCommandUsed = true;                                              
        if(applications){
            errorMessage("Error Code: 1",message);
        } else {
            applicationLink = (message.content.split(" ").length <= 1) ? applicationLink : message.content.split(" ")[1];
            if (message.content.split(" ").length <= 1) {
                errorMessage("Error code: 2", message);
                return;
            }
            applications = true;
            console.log(`${message.author.tag} opened applications: ${d.toISOString()}`);
        }
        message.delete();
    } else if (cmd == prefix + "closeapps" && isAdmin(message.author.id, message)) {
        logCommandUsed = true;        
        if(!applications){
            errorMessage("Error Code: 3",message);
        } else {
            applicationLink = "Error code 2: Contact someone with the @Admin or @Mentor role.";
            applications = false;
                
            console.log(`${message.author.tag} closed applications: ${d.toISOString()}`);
        }
        applications = false;
        message.delete();
    } else if ((cmd == prefix + "openapps" || cmd == prefix + "closeapps") && !isAdmin(message.author.id, message)){
        errorMessage(`Invalid permissions : Minimum permissions: ${adminRole || "@Admin"}.`, message);
        console.log("Sending error message...");
    } else if (cmd == prefix + "apply"){                                                                                           // New command
        logCommandUsed = true;        
        const embed = new Discord.MessageEmbed()
        .setTitle("Code Mentor Application")
        .setDescription(applicationLink)
        .setFooter("Good luck!")
        .setColor(0x3286a6);

        message.author.send(embed);
        message.delete();
    }

    if (logCommandUsed){
        const channel = client.channels.cache.find(channel => channel.id === "824148305013243944")
        const embed = new Discord.MessageEmbed()
        .setDescription(`Command used in ${message.channel}`)
        .addField("\u2800",message.content,false)
        .setColor(0x3286a6)
        .setTimestamp(d.toISOString())
        .setAuthor(message.author.tag, message.author.avatarURL({size : 256}));

        channel.send(embed);
    }
});

client.on("guildCreate", (guild) => { // Private bot
    if(guild.id.toString() != "823487710068080690"){
        console.log(`Left server: ${guild.id}`);
        guild.leave();
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);

/*
    NO BOT CODE BEYOND THIS POINT
*/


/*
ERROR CODES:
1 - Applications already open.
2 - Application link not set.
3 - Applications already closed.
*/
