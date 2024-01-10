import { Service, PlatformAccessory, CharacteristicValue, Perms } from 'homebridge';

import { IntelligentOctopusGoPlatform } from './platform';

/**
 * Intelligent Octupus Go Platform Accessory
 * An instance of this class is created for each switch type.
 */
export class IntelligentOctopusGoPlatformAccessory {
  private service: Service;


  constructor(
    private readonly platform: IntelligentOctopusGoPlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'James Ball')
      .setCharacteristic(this.platform.Characteristic.Model, '1.0.0')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.uniqueId);

    // get the Swtich service if it exists, otherwise create a new Switch service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.displayName` in the `discoverDevices` method.
    this.platform.log.debug('Accesssory context ->', accessory.context.displayName);
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // set permissions and register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On).updateValue(false)
      .setProps({
      // We don't want these switches to be controlled by anyone else, so set permissions to exclude writing
        perms: [Perms.PAIRED_READ, Perms.NOTIFY, Perms.EVENTS],
      })
      .onSet(this.setOn.bind(this))               // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this));               // GET - bind to the `getOn` method below
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory.
   * Need to work out the correct way to do read only. This will prevent change but shouldn't ever be called.
   */
  async setOn(value: CharacteristicValue) {

    this.platform.log.info('Attempt to set Characteristic On ->', value);
    const isOn = this.accessory.getService(this.platform.Service.Switch)?.getCharacteristic(this.platform.Characteristic.On)?.value;
    return isOn === true;

  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getOn(): Promise<CharacteristicValue> {
    // implement your own code to check if the device is on
    const isOn = this.accessory.getService(this.platform.Service.Switch)?.getCharacteristic(this.platform.Characteristic.On)?.value;

    this.platform.log.debug('Get Characteristic On ->', isOn);

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    return isOn === true;
  }


}
