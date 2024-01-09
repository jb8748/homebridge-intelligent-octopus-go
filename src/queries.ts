import axios from 'axios';

import { IntelligentOctopusGoPlatform } from './platform';

export class OctopusDispatch {
  public startDtUtc:Date;
  public endDtUtc:Date;

  constructor(object) {
    this.startDtUtc = new Date(object.startDtUtc.replace(' ', 'T'));
    this.endDtUtc = new Date(object.endDtUtc.replace(' ', 'T'));
  }

  toString() {
    return `{startDtUTC: ${this.startDtUtc.toLocaleString('sv')}, endDtUTC: ${this.endDtUtc.toLocaleString('sv')}}`;
  }
}

export class OctopusQueries {

  private octopusToken:string|undefined;
  private octopusTokenExpires:Date|undefined;
  private plannedSlotsArray:Array<OctopusDispatch> = [];

  private static octopusURL = 'https://api.octopus.energy/v1/graphql/';

  private static tokenQuery = (APIKey:string) => {
    return { 'query': `mutation {obtainKrakenToken(input: {APIKey: "${APIKey}"}){token}}` };
  };

  private static plannedSlotsQuery = (accountNumber:string) => {
    // eslint-disable-next-line max-len
    return { 'query': `query {plannedDispatches(accountNumber: "${accountNumber}"){startDtUtc: startDt endDtUtc: endDt chargeKwh: delta meta { source location }}}` };
  };

  constructor(
    private readonly platform: IntelligentOctopusGoPlatform,
  ) {}

  get plannedSlots() {
    return this.plannedSlotsArray;
  }

  async getOctopusToken(): Promise<string> {
    // eslint-disable-next-line max-len
    if (this.octopusToken !== undefined && this.octopusTokenExpires !== undefined && new Date(Date.now() + 6000) < this.octopusTokenExpires) {
      return Promise.resolve(this.octopusToken);
    } else {
      this.platform.log.info('New token requested');
      return axios.post(OctopusQueries.octopusURL, OctopusQueries.tokenQuery(this.platform.config.apikey)).then(
        response => {
          this.platform.log.info(response.data.data.obtainKrakenToken.token);
          const newToken:string = response.data.data.obtainKrakenToken.token;
          this.octopusToken = newToken;
          //Need to set time out to remove the token when it might expire
          //Let's try decoding it
          const tokenParts = newToken.split('.');
          const jsonContent = JSON.parse(atob(tokenParts[1]));
          const expiryInSeconds = Number.parseInt(jsonContent.exp);
          this.octopusTokenExpires = new Date(expiryInSeconds * 1000);
          this.platform.log.info(this.octopusTokenExpires.toISOString());
          return this.octopusToken;
        },
      ).catch(
        rejected => {
          this.octopusToken = undefined;
          this.octopusTokenExpires = undefined;
          throw rejected;
        },
      );
    }
  }

  async getPlannedSlots(): Promise<Array<OctopusDispatch>> {
    return this.getOctopusToken()
      .then(
        (token) => axios.post(
          OctopusQueries.octopusURL,
          OctopusQueries.plannedSlotsQuery(this.platform.config.accountNumber),
          {headers: {'Authorization':'JWT '+token}})
          .then(response => {
            try {
              if (response.data.errors !== undefined) {
              //Something went wrong - might investigate what later
                this.plannedSlotsArray = [];
                throw new Error('Server returned an error');
              } else {
                this.platform.log.info(response.data);
                let plannedSlots:Array<object> = response.data.plannedDispatches;
                // eslint-disable-next-line max-len
                plannedSlots = [{'startDtUtc':'2023-07-25 10:47:00+00:00', 'endDtUtc':'2023-07-25 10:48:00+00:00', 'chargeKwh':'-12.00', 'meta':{'source':'smart-charge', 'location':null}}];
                this.plannedSlotsArray = plannedSlots.map( x => new OctopusDispatch(x));
                this.platform.log.info(this.getStandardDispatches().toString());
                return this.plannedSlots;
              }
            } catch(e:any) {
              this.platform.log.info(e.toString());
              throw e;
            }
          }),
      )
      .catch(
        (reason) => {
          this.platform.log.info('Failed to get slots');
          this.platform.log.info(reason);
          this.plannedSlotsArray = [];
          throw reason;
        },
      );
  }

  getStandardDispatches(): Array<OctopusDispatch> {
    //Return the normal 23:30 to 05:30 slots - always return two days so we don't have to worry about current time.
    const currentDate = new Date();
    const todayString = currentDate.toLocaleDateString('sv', {timeZone: 'Europe/London'});
    currentDate.setDate(currentDate.getDate() + 1);
    const tomorrowString = currentDate.toLocaleDateString('sv', {timeZone: 'Europe/London'});
    currentDate.setDate(currentDate.getDate() - 2);
    const yesterdayString = currentDate.toLocaleDateString('sv', {timeZone: 'Europe/London'});
    const slots:Array<OctopusDispatch> = [];
    slots.push(new OctopusDispatch(
      {startDtUtc:(yesterdayString+'T23:30'+OctopusQueries.getTimezoneOffset(yesterdayString+'T23:30')),
        endDtUtc:(todayString+'T05:30'+OctopusQueries.getTimezoneOffset(todayString+'T05:30'))},
    ));
    slots.push(new OctopusDispatch(
      {startDtUtc:(todayString+'T23:30'+OctopusQueries.getTimezoneOffset(todayString+'T23:30')),
        endDtUtc:(tomorrowString+'T05:30'+OctopusQueries.getTimezoneOffset(tomorrowString+'T05:30'))},
    ));
    return slots;
  }

  static getTimezoneOffset(isoDateTimeString:string, timeZone = 'Europe/London'):string {
    // For a given dateTime what is the offset from UTC in a specific place (timezone)
    // Returns an error if the time doesn't exist - e.g. clocks have gone forward in the UK and 01:00 never happens that day
    // When clocks go back returns based on the clocks having changed. e.g the second 01:00 when clocks go back at 02:00 in the UK

    // For the moment assume the time is UTC
    const utcDateObject = new Date(isoDateTimeString + 'Z');

    if (isNaN(utcDateObject.getTime())) {
      throw new Error('Invalid date string');
    }

    // Get an 'approximatly' ISO formatted string but in the time at the time zone
    const tzDateTime = utcDateObject.toLocaleString('sv', { timeZone: timeZone});
    //console.log('tzDateTime: ' + tzDateTime);

    // Let's find the difference (in millis) between the two
    // Easiest is to convert string to date object in UTC. Then subtract our original.
    let difference = new Date(tzDateTime + 'Z').getTime() - utcDateObject.getTime();
    //console.log('Difference: ' + difference.toString());

    if (difference === 0) {
      // The timezone is observing UTC so nothing to check.
      // Don't do anything, and continue
    } else {
      // If not, let's adjust the original time by the calculated difference and check
      // that the timezone time matches the isoDateTimeString

      // Create the offset UTC
      const offsetDate = new Date(Date.parse(isoDateTimeString + 'Z') - difference);

      // Get an 'approx' ISO string in the time zone
      const tzDateTime2 = offsetDate.toLocaleString('sv', { timeZone: timeZone}).replace(' ', 'T');

      //console.log('tzDateTime2: ' + tzDateTime2);
      // This tzDateTime2 should match the original requested isoDateTimeString
      if (tzDateTime2.startsWith(isoDateTimeString)) {
        // It does, so we have the correct offset for the given dateTime
        // Everything is good - continue
      } else {
        // The times are different!
        // Most likely reason is that we've been asked for a time around the DST change so we have the wrong offset for this specific time
        // So let's get a new difference based on this adjusted UTC time

        difference = new Date(tzDateTime2 + 'Z').getTime() - offsetDate.getTime();
        //console.log('Difference2: ' + difference.toString());

        // Run the test again using the new difference
        const offsetDate2 = new Date(Date.parse(isoDateTimeString + 'Z') - difference);
        const tzDateTime3 = offsetDate2.toLocaleString('sv', { timeZone: timeZone}).replace(' ', 'T');
        //console.log('tzDateTime3: ' + tzDateTime2);

        if (tzDateTime3.startsWith(isoDateTimeString)) {
          // Now we have the right time - so we have the corret offset
          // Everything is good - continue
        } else {
          // No, still different
          // This means the time we have been asked for doesn't exist in the timezone, e.g. 01:00 when clocks jump form 00:59 to 02:00
          throw new Error('Invalid time in timeZone ' + timeZone);
        }
      }
    }

    // Convert difference into hours and minutes
    const hours = Math.trunc(difference / 3600000);
    const minutes = (difference % 3600000) / 60000;

    const offset = (hours >= 0 ? '+' : '-') + Math.abs(hours).toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0');
    //console.log('Calculated offset is: ' + offset);

    // Belt and braces check - this should always pass but just in case.
    const check = new Date(isoDateTimeString + offset).toLocaleString('sv', {timeZone: timeZone}).replace(' ', 'T');
    //console.log('Check date string is: ' + check);
    if (!check.startsWith(isoDateTimeString)) {
      throw new Error('Invalid check for timeZone ' + timeZone);
    }
    return offset;
  }
}