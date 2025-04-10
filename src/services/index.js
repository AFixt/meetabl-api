/**
 * Services index
 *
 * Exposes all services for the application
 *
 * @author meetabl Team
 */

const notificationService = require('./notification.service');
const calendarService = require('./calendar.service');

module.exports = {
  notificationService,
  calendarService
};
