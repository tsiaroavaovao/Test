const fs = require("fs");
const login = require("ws3-fca");
const express = require("express");
const axios = require("axios");
const app = express();

const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
let appState = null;
try {
    appState = JSON.parse(fs.readFileSync("appstate.json", "utf8"));
} catch (error) {
    console.error("Failed to load appstate.json", error);
}

const port = config.port || 3000;
const commandFiles = fs.readdirSync('./cmds').filter(file => file.endsWith('.js'));
const commands = {};
commandFiles.forEach(file => {
    const command = require(`./cmds/${file}`);
    commands[command.name] = command;
});

let activeCommand = null;

login({ appState }, (err, api) => {
    if (err) return console.error(err);
    
    api.setOptions({
        forceLogin: true,
        listenEvents: true,
        logLevel: "silent",
        selfListen: false
    });

    function handleMessage(event) {
        const prefix = config.prefix;
        const message = event.body.trim().toLowerCase();
        const senderId = event.senderID;

        if (message.startsWith(prefix)) {
            const args = message.slice(prefix.length).split(/ +/);
            const commandName = args.shift().toLowerCase();
            
            if (commands[commandName]) {
                if (commandName === "help") {
                    return commands[commandName].execute(api, event, args);
                }
                activeCommand = commandName;
                return commands[commandName].execute(api, event, args);
            }
        } else if (message === "stop" && activeCommand) {
            api.sendMessage(`La commande ${activeCommand} est désactivée.`, event.threadID);
            activeCommand = null;
        } else if (activeCommand && commands[activeCommand]) {
            return commands[activeCommand].execute(api, event, message.split(/ +/));
        }
    }

    api.listenMqtt((err, event) => {
        if (err) return console.error("Listening error:", err);
        if (event.type === "message") handleMessage(event);
    });
});

app.get("/", (req, res) => {
    res.send("Bot is running");
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
