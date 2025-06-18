/**
 * Team Collaboration Workflow Integration Test
 *
 * Tests the complete team creation and collaboration features
 *
 * @author meetabl Team
 */

const { request, utils, models } = require('../setup');
const app = require('../../../src/app');

describe('Team Collaboration Workflow', () => {
  let owner, member1, member2;
  let ownerTokens, member1Tokens, member2Tokens;
  let team;

  beforeAll(async () => {
    await utils.resetDatabase();

    // Create test users
    owner = await utils.createTestUser({
      firstName: 'Team',
      lastName: 'Owner',
      email: 'owner@example.com',
      username: 'teamowner'
    });

    member1 = await utils.createTestUser({
      firstName: 'Team',
      lastName: 'Member1',
      email: 'member1@example.com',
      username: 'member1'
    });

    member2 = await utils.createTestUser({
      firstName: 'Team',
      lastName: 'Member2',
      email: 'member2@example.com',
      username: 'member2'
    });

    // Generate tokens
    ownerTokens = utils.generateAuthTokens(owner);
    member1Tokens = utils.generateAuthTokens(member1);
    member2Tokens = utils.generateAuthTokens(member2);
  });

  afterAll(async () => {
    await utils.cleanup();
  });

  describe('Team setup and management', () => {
    test('Step 1: Create a new team', async () => {
      const teamData = {
        name: 'Engineering Team',
        description: 'Product development team working on meetabl platform'
      };

      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${ownerTokens.accessToken}`)
        .send(teamData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(teamData.name);
      expect(response.body.data.ownerId).toBe(owner.id);
      team = response.body.data;

      // Verify owner is automatically added as admin
      const ownerMembership = await models.TeamMember.findOne({
        where: {
          teamId: team.id,
          userId: owner.id
        }
      });
      expect(ownerMembership).toBeTruthy();
      expect(ownerMembership.role).toBe('admin');
    });

    test('Step 2: Add team members', async () => {
      // Add member1 as admin
      const addMember1Response = await request(app)
        .post(`/api/teams/${team.id}/members`)
        .set('Authorization', `Bearer ${ownerTokens.accessToken}`)
        .send({
          userId: member1.id,
          role: 'admin'
        })
        .expect(201);

      expect(addMember1Response.body.success).toBe(true);
      expect(addMember1Response.body.data.role).toBe('admin');

      // Add member2 as regular member
      const addMember2Response = await request(app)
        .post(`/api/teams/${team.id}/members`)
        .set('Authorization', `Bearer ${ownerTokens.accessToken}`)
        .send({
          userId: member2.id,
          role: 'member'
        })
        .expect(201);

      expect(addMember2Response.body.success).toBe(true);
      expect(addMember2Response.body.data.role).toBe('member');
    });

    test('Step 3: View team members', async () => {
      const response = await request(app)
        .get(`/api/teams/${team.id}/members`)
        .set('Authorization', `Bearer ${ownerTokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.members.length).toBe(3);
      
      const roles = response.body.data.members.map(m => m.role);
      expect(roles).toContain('admin');
      expect(roles).toContain('member');
    });

    test('Step 4: Update team member role', async () => {
      // Promote member2 to admin
      const response = await request(app)
        .put(`/api/teams/${team.id}/members/${member2.id}`)
        .set('Authorization', `Bearer ${ownerTokens.accessToken}`)
        .send({ role: 'admin' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('admin');
    });

    test('Step 5: Create team calendar', async () => {
      const calendarData = {
        name: 'Team Standup Calendar',
        description: 'Daily standup meetings',
        defaultDuration: 15,
        bufferTime: 5
      };

      const response = await request(app)
        .post(`/api/teams/${team.id}/calendars`)
        .set('Authorization', `Bearer ${ownerTokens.accessToken}`)
        .send(calendarData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(calendarData.name);
    });

    test('Step 6: Non-admin cannot modify team', async () => {
      // First, demote member2 back to member
      await request(app)
        .put(`/api/teams/${team.id}/members/${member2.id}`)
        .set('Authorization', `Bearer ${ownerTokens.accessToken}`)
        .send({ role: 'member' })
        .expect(200);

      // Now try to add a member as non-admin
      const response = await request(app)
        .post(`/api/teams/${team.id}/members`)
        .set('Authorization', `Bearer ${member2Tokens.accessToken}`)
        .send({
          userId: utils.uuidv4(),
          role: 'member'
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('permission');
    });

    test('Step 7: Leave team', async () => {
      const response = await request(app)
        .delete(`/api/teams/${team.id}/members/me`)
        .set('Authorization', `Bearer ${member2Tokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('left the team');

      // Verify member is removed
      const membership = await models.TeamMember.findOne({
        where: {
          teamId: team.id,
          userId: member2.id
        }
      });
      expect(membership).toBeNull();
    });

    test('Step 8: Remove team member', async () => {
      // Re-add member2 first
      await request(app)
        .post(`/api/teams/${team.id}/members`)
        .set('Authorization', `Bearer ${ownerTokens.accessToken}`)
        .send({
          userId: member2.id,
          role: 'member'
        })
        .expect(201);

      // Now remove them
      const response = await request(app)
        .delete(`/api/teams/${team.id}/members/${member2.id}`)
        .set('Authorization', `Bearer ${ownerTokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('removed');
    });

    test('Step 9: Transfer team ownership', async () => {
      const response = await request(app)
        .put(`/api/teams/${team.id}`)
        .set('Authorization', `Bearer ${ownerTokens.accessToken}`)
        .send({
          ownerId: member1.id
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.ownerId).toBe(member1.id);

      // Verify in database
      const updatedTeam = await models.Team.findByPk(team.id);
      expect(updatedTeam.ownerId).toBe(member1.id);
    });

    test('Step 10: Delete team', async () => {
      // New owner (member1) deletes the team
      const response = await request(app)
        .delete(`/api/teams/${team.id}`)
        .set('Authorization', `Bearer ${member1Tokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify team is deleted
      const deletedTeam = await models.Team.findByPk(team.id);
      expect(deletedTeam).toBeNull();

      // Verify all memberships are deleted
      const memberships = await models.TeamMember.findAll({
        where: { teamId: team.id }
      });
      expect(memberships.length).toBe(0);
    });
  });

  describe('Team booking scenarios', () => {
    let teamWithBookings;
    let teamCalendar;

    test('Create team with shared calendar', async () => {
      // Create new team
      const teamResponse = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${ownerTokens.accessToken}`)
        .send({
          name: 'Sales Team',
          description: 'Customer success and sales'
        })
        .expect(201);

      teamWithBookings = teamResponse.body.data;

      // Add all members
      await request(app)
        .post(`/api/teams/${teamWithBookings.id}/members`)
        .set('Authorization', `Bearer ${ownerTokens.accessToken}`)
        .send({ userId: member1.id, role: 'admin' })
        .expect(201);

      await request(app)
        .post(`/api/teams/${teamWithBookings.id}/members`)
        .set('Authorization', `Bearer ${ownerTokens.accessToken}`)
        .send({ userId: member2.id, role: 'member' })
        .expect(201);

      // Create shared calendar
      const calendarResponse = await request(app)
        .post(`/api/teams/${teamWithBookings.id}/calendars`)
        .set('Authorization', `Bearer ${ownerTokens.accessToken}`)
        .send({
          name: 'Sales Calls',
          description: 'Customer calls and demos',
          defaultDuration: 30,
          isPublic: true
        })
        .expect(201);

      teamCalendar = calendarResponse.body.data;
    });

    test('Team members can view team bookings', async () => {
      // Create a booking for the team
      const customer = await utils.createTestUser({
        email: 'customer@example.com',
        username: 'customer'
      });

      const booking = await utils.createTestBooking(owner.id, {
        teamId: teamWithBookings.id,
        calendarId: teamCalendar.id,
        attendeeEmail: customer.email,
        title: 'Product Demo'
      });

      // All team members can view the booking
      for (const tokens of [ownerTokens, member1Tokens, member2Tokens]) {
        const response = await request(app)
          .get(`/api/teams/${teamWithBookings.id}/bookings`)
          .set('Authorization', `Bearer ${tokens.accessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.bookings.length).toBeGreaterThan(0);
        expect(response.body.data.bookings[0].id).toBe(booking.id);
      }
    });
  });
});