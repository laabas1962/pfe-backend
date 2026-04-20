const BaseDevice = require("./BaseDevice");

class TVDevice extends BaseDevice {
  constructor(name, roomName, homeId) {
    super(name, roomName, homeId);
    this.type = "tv";
    this.state = { power: false, channel: 1, volume: 10 };
  }

  handleCommand(command) {
    if (command.power !== undefined) this.state.power = command.power;
    if (command.channel !== undefined) this.state.channel = command.channel;
    if (command.volume !== undefined) this.state.volume = command.volume;
    if (command.action !== undefined) this.state.lastAction = command.action;
    this.publishState();
  }
}

module.exports = TVDevice;
