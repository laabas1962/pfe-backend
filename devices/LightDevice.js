const BaseDevice = require("./BaseDevice");

class LightDevice extends BaseDevice {
  constructor(name, roomName, homeId) {
    super(name, roomName, homeId);
    this.type = "light";
    this.state = { power: false, brightness: 100 };
  }

  handleCommand(command) {
    if (command.power !== undefined) this.state.power = command.power;
    if (command.brightness !== undefined) this.state.brightness = command.brightness;
    this.publishState();
  }
}

module.exports = LightDevice;
