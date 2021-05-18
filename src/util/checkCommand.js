console.log("Loading... checkCommand.js");

const a = require('./info/a')
const aliases = a.a;

module.exports = (prefix, input, callback) => {
    var result = false;
    for([key,value] of Object.entries(aliases)){
        if (result) break;
        if(`${prefix}${key}` == input){
            result = true;
            break;
        }
        const tempAliases = value;
        for (i = 0; i < tempAliases.length; i++){
            var alias = tempAliases[i];
            if (`${prefix}${alias}` == input){
                result = true;
                break;
            }
        }
    }
    callback(result);
}

console.log("checkCommand.js loaded... Success!");