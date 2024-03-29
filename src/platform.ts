import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { IntelligentOctopusGoPlatformAccessory } from './platformAccessory';
import { OctopusQueries, callAtX9MinuteTimer, callAt00SecondTimer, OctopusStatuses } from './queries';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class IntelligentOctopusGoPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();

      // now that everything should be set up we can start polling the Octopus API for changes

      const octopusQueryObject = new OctopusQueries(this);

      //const repeatingSlotsFunction = () => {
      //  octopusQueryObject.getPlannedSlots().catch(() => '').finally(() => callAtX9MinuteTimer(repeatingSlotsFunction));
      //};

      //repeatingSlotsFunction();

      const repeatingTimeCheckFunction = () => {
        log.info('Minute timer fired');
        octopusQueryObject.getSlotStatuses().then((statuses:OctopusStatuses) => {
          log.info(statuses.toString());
          for (const acc of this.accessories) {
            //log.info(acc.UUID);
            const service = acc.getService(this.api.hap.Service.Switch);
            if (service !== undefined) {
              const char = service.getCharacteristic(this.api.hap.Characteristic.On);
              switch (acc.UUID) {
                case(this.api.hap.uuid.generate('IOGPDefaultTime')):
                  char.updateValue(statuses.standardOffpeak);
                  break;
                case(this.api.hap.uuid.generate('IOGPOffpeakTime')):
                  char.updateValue(statuses.offpeak);
                  break;
                case(this.api.hap.uuid.generate('IOGPChargingSlotActive')):
                  char.updateValue(statuses.charging);
                  break;
                case(this.api.hap.uuid.generate('IOGPExtraSlotActive')):
                  char.updateValue(statuses.extraOffpeak);
                  break;
              }
            }
          }
        }).finally(() => callAt00SecondTimer(repeatingTimeCheckFunction));
      };

      repeatingTimeCheckFunction();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {

    // We don't need to discover devices - there is a fixed list
    const intelligentOctopusGoDevices = [
      {
        uniqueId: 'IOGPDefaultTime',
        displayName: 'Default Off-peak Active',
      },
      {
        uniqueId: 'IOGPOffpeakTime',
        displayName: 'Off-peak Active',
      },
      {
        uniqueId: 'IOGPChargingSlotActive',
        displayName: 'Charging Slot Active',
      },
      {
        uniqueId: 'IOGPExtraSlotActive',
        displayName: 'Extra Slot Active',
      },
    ];

    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of intelligentOctopusGoDevices) {

      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(device.uniqueId);

      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      if (existingAccessory) {
        // the accessory already exists
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        // existingAccessory.context.device = device;
        // this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        new IntelligentOctopusGoPlatformAccessory(this, existingAccessory);

        // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
        // remove platform accessories when no longer present
        // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', device.displayName);

        // create a new accessory
        const accessory = new this.api.platformAccessory(device.displayName, uuid);

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.device = device;

        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        new IntelligentOctopusGoPlatformAccessory(this, accessory);

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }
}
