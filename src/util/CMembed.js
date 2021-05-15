console.log("Loading... CMembed.js");
// Error
const error = require('./error')

module.exports = (Discord, client, callback) => {
    const d = new Date();
    const self = client.user;
    const embed = new Discord.MessageEmbed()
    .setAuthor(self.tag, self.avatarURL({size : 256}))
    .setColor(0x3286a6)
    .setTimestamp(d.toISOString());

    callback(embed);
}

console.log("CMembed.js loaded... Success!");