<p align="center">

<img src="https://github.com/homebridge/branding/raw/latest/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>

<span align="center">

# Homebridge Intelligent Octopus Go

</span>

This is a plugin to retrieve car charging slots from Octopus for those on the Intelligent Octopus Go tariff. It converts those (along with knowledge of the default off-peak hours) into a series of switches in Homekit. You can then use those in automations to control other devices.



### Configuration

Requires your Octopus Account Number and your Octopus API key.

### Operation

There are four switches:

Default Off-peak Active - switches on between 23:30 and 05:30 in the Europe/London timezone every day

Charging Slot Active - swtiches on whenever the time is within one of the slots provided by the API

Off-peak Active - switches on when either it's the default off peak or a charging slot is active

Extra Slot Active - switches on when a slot outside the normal 23:30-05:30 period is active


