const BaseDevice = require("./BaseDevice");

class WiFiDevice extends BaseDevice {
  constructor(name, roomName, homeId) {
    super(name, roomName, homeId);
    this.type = "wifi";
    this.state = { power: true, connected: true };
  }

  handleCommand(command) {
    if (command.power !== undefined) this.state.power = command.power;
    if (command.connected !== undefined) this.state.connected = command.connected;
    this.publishState();
  }
}

module.exports = WiFiDevice;
