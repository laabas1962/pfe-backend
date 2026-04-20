const BaseDevice = require("./BaseDevice");

class ACDevice extends BaseDevice {
  constructor(name, roomName, homeId) {
    super(name, roomName, homeId);
    this.type = "ac";
    this.state = { power: false, temperature: 24, mode: "cool" };
  }

  handleCommand(command) {
    if (command.power !== undefined) this.state.power = command.power;
    if (command.temperature !== undefined) this.state.temperature = command.temperature;
    if (command.mode !== undefined) this.state.mode = command.mode;
    this.publishState();
  }
}

module.exports = ACDevice;
