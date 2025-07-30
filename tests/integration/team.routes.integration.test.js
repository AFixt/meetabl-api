/**
 * Team Routes Integration Tests
 * Tests for team/organization management endpoints
 */

const request = require('supertest');
const { getTestApp } = require('./test-app');
const { User, Team, TeamMember, RefreshToken } = require('../../src/models');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

// Mock subscription service
jest.mock('../../src/services/subscription.service', () => ({
  requireFeature: () => (req, res, next) => next(),
  requireWithinLimit: () => (req, res, next) => next(),
  checkFeatureAccess: jest.fn().mockResolvedValue(true),
  checkUsageLimit: jest.fn().mockResolvedValue(true)
}));

describe('Team Routes Integration Tests', () => {
  let app;
  let testUser;
  let authToken;
  let testTeam;
  let secondUser;
  let secondUserToken;

  beforeAll(async () => {
    // Initialize app
    app = await getTestApp();
    
    // Create test users
    testUser = await User.create({
      id: uuidv4(),
      firstName: 'Team',
      lastName: 'Owner',
      email: 'team-owner@meetabl.com',
      password: await bcrypt.hash('TeamOwner123!', 10),
      timezone: 'America/New_York',
      isActive: true,
      isEmailVerified: true
    });

    secondUser = await User.create({
      id: uuidv4(),
      firstName: 'Team',
      lastName: 'Member',
      email: 'team-member@meetabl.com',
      password: await bcrypt.hash('TeamMember123!', 10),
      timezone: 'America/New_York',
      isActive: true,
      isEmailVerified: true
    });

    // Generate auth tokens
    authToken = jwt.sign(
      { 
        id: testUser.id, 
        email: testUser.email,
        type: 'access'
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    secondUserToken = jwt.sign(
      { 
        id: secondUser.id, 
        email: secondUser.email,
        type: 'access'
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Clean up test data
    if (testTeam) {
      await TeamMember.destroy({ where: { teamId: testTeam.id } });
      await Team.destroy({ where: { id: testTeam.id } });
    }
    if (testUser) {
      await User.destroy({ where: { id: testUser.id } });
    }
    if (secondUser) {
      await User.destroy({ where: { id: secondUser.id } });
    }
  });

  describe('POST /api/teams', () => {
    it('should create a new team successfully', async () => {
      const teamData = {
        name: 'Test Team',
        description: 'Integration test team',
        settings: {
          allowMemberInvites: true,
          defaultMeetingDuration: 30
        }
      };

      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send(teamData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Team created successfully',
        data: {
          team: expect.objectContaining({
            name: 'Test Team',
            description: 'Integration test team',
            ownerId: testUser.id
          })
        }
      });

      testTeam = response.body.data.team;
    });

    it('should validate team data', async () => {
      const invalidTeamData = {
        // Missing required name
        description: 'Invalid team'
      };

      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidTeamData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Validation failed')
      });
    });

    it('should reject without authentication', async () => {
      await request(app)
        .post('/api/teams')
        .send({ name: 'Unauthorized Team' })
        .expect(401);
    });
  });

  describe('GET /api/teams', () => {
    it('should retrieve user teams', async () => {
      const response = await request(app)
        .get('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          teams: expect.arrayContaining([
            expect.objectContaining({
              id: testTeam.id,
              name: 'Test Team'
            })
          ])
        }
      });
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/teams?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          teams: expect.any(Array),
          pagination: expect.objectContaining({
            page: 1,
            limit: 10,
            total: expect.any(Number)
          })
        }
      });
    });
  });

  describe('GET /api/teams/:id', () => {
    it('should retrieve team details', async () => {
      const response = await request(app)
        .get(`/api/teams/${testTeam.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          team: expect.objectContaining({
            id: testTeam.id,
            name: 'Test Team',
            description: 'Integration test team',
            ownerId: testUser.id
          })
        }
      });
    });

    it('should return 404 for non-existent team', async () => {
      const fakeId = uuidv4();
      const response = await request(app)
        .get(`/api/teams/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Team not found'
      });
    });
  });

  describe('PUT /api/teams/:id', () => {
    it('should update team successfully', async () => {
      const updateData = {
        name: 'Updated Test Team',
        description: 'Updated description',
        settings: {
          allowMemberInvites: false,
          defaultMeetingDuration: 60
        }
      };

      const response = await request(app)
        .put(`/api/teams/${testTeam.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Team updated successfully',
        data: {
          team: expect.objectContaining({
            id: testTeam.id,
            name: 'Updated Test Team',
            description: 'Updated description'
          })
        }
      });
    });

    it('should prevent non-owner from updating', async () => {
      const updateData = {
        name: 'Unauthorized Update'
      };

      await request(app)
        .put(`/api/teams/${testTeam.id}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send(updateData)
        .expect(403);
    });
  });

  describe('Team Members endpoints', () => {
    describe('POST /api/teams/:id/members', () => {
      it('should add team member successfully', async () => {
        const memberData = {
          userId: secondUser.id,
          role: 'member',
          permissions: {
            canCreateMeetings: true,
            canManageMembers: false
          }
        };

        const response = await request(app)
          .post(`/api/teams/${testTeam.id}/members`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(memberData)
          .expect(201);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Team member added successfully',
          data: {
            member: expect.objectContaining({
              userId: secondUser.id,
              teamId: testTeam.id,
              role: 'member'
            })
          }
        });
      });

      it('should prevent duplicate members', async () => {
        const memberData = {
          userId: secondUser.id,
          role: 'member'
        };

        await request(app)
          .post(`/api/teams/${testTeam.id}/members`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(memberData)
          .expect(409);
      });
    });

    describe('GET /api/teams/:id/members', () => {
      it('should retrieve team members', async () => {
        const response = await request(app)
          .get(`/api/teams/${testTeam.id}/members`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            members: expect.arrayContaining([
              expect.objectContaining({
                userId: testUser.id,
                role: 'owner'
              }),
              expect.objectContaining({
                userId: secondUser.id,
                role: 'member'
              })
            ])
          }
        });
      });

      it('should include user details if requested', async () => {
        const response = await request(app)
          .get(`/api/teams/${testTeam.id}/members?includeUserDetails=true`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.data.members[0]).toHaveProperty('user');
        expect(response.body.data.members[0].user).toMatchObject({
          firstName: expect.any(String),
          lastName: expect.any(String),
          email: expect.any(String)
        });
      });
    });

    describe('DELETE /api/teams/:id/members/:userId', () => {
      it('should remove team member', async () => {
        const response = await request(app)
          .delete(`/api/teams/${testTeam.id}/members/${secondUser.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Team member removed successfully'
        });

        // Verify removal
        const members = await TeamMember.findAll({ where: { teamId: testTeam.id } });
        expect(members).toHaveLength(1); // Only owner remains
      });

      it('should prevent removing team owner', async () => {
        await request(app)
          .delete(`/api/teams/${testTeam.id}/members/${testUser.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);
      });
    });
  });

  describe('POST /api/teams/:id/calendars', () => {
    it('should create shared calendar', async () => {
      const calendarData = {
        name: 'Team Calendar',
        description: 'Shared team calendar',
        settings: {
          defaultAvailability: {
            monday: { start: '09:00', end: '17:00' },
            tuesday: { start: '09:00', end: '17:00' },
            wednesday: { start: '09:00', end: '17:00' },
            thursday: { start: '09:00', end: '17:00' },
            friday: { start: '09:00', end: '17:00' }
          }
        }
      };

      const response = await request(app)
        .post(`/api/teams/${testTeam.id}/calendars`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(calendarData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Shared calendar created successfully',
        data: {
          calendar: expect.objectContaining({
            teamId: testTeam.id,
            name: 'Team Calendar'
          })
        }
      });
    });
  });

  describe('DELETE /api/teams/:id', () => {
    it('should delete team successfully', async () => {
      // Create a separate team for deletion test
      const deleteTeam = await Team.create({
        id: uuidv4(),
        name: 'Delete Test Team',
        ownerId: testUser.id
      });

      const response = await request(app)
        .delete(`/api/teams/${deleteTeam.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Team deleted successfully'
      });

      // Verify deletion
      const deletedTeam = await Team.findByPk(deleteTeam.id);
      expect(deletedTeam).toBeNull();
    });

    it('should prevent non-owner from deleting', async () => {
      await request(app)
        .delete(`/api/teams/${testTeam.id}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(403);
    });
  });
});