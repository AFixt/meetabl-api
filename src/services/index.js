/**
 * Services index
 *
 * Exposes all services for the application with lazy loading
 *
 * @author meetabl Team
 */

// Lazy loaded services to avoid initialization issues in Lambda
module.exports = {
  get notificationService() {
    return require('./notification.service');
  },
  get calendarService() {
    return require('./calendar.service');
  },
  get teamService() {
    return require('./team.service');
  }
};
