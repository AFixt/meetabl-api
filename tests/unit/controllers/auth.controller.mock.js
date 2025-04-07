/**
 * Auth controller mock for tests
 * 
 * This provides mock implementations of auth controller functions
 * 
 * @author AccessMeet Team
 */

// Mock controller functions
const mockRegister = jest.fn(async (req, res) => {
  // Check if email is already in use
  if (req.body.email === 'existing@example.com') {
    return res.status(400).json({
      error: {
        code: 'bad_request',
        message: 'Email already in use'
      }
    });
  }
  
  // Return success
  return res.status(201).json({
    id: 'new-user-id',
    name: req.body.name,
    email: req.body.email,
    token: 'mock.jwt.token'
  });
});

const mockLogin = jest.fn(async (req, res) => {
  // Check if email exists
  if (req.body.email !== 'test@example.com') {
    return res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Invalid email or password'
      }
    });
  }
  
  // Check password
  if (req.body.password !== 'Password123!') {
    return res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Invalid email or password'
      }
    });
  }
  
  // Return success
  return res.status(200).json({
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    token: 'mock.jwt.token',
    refreshToken: 'mock.refresh.token'
  });
});

const mockRefreshToken = jest.fn(async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({
      error: {
        code: 'bad_request',
        message: 'Refresh token is required'
      }
    });
  }
  
  // Check token is valid
  if (refreshToken === 'valid.refresh.token') {
    return res.status(200).json({
      token: 'new.access.token',
      refreshToken: 'new.refresh.token'
    });
  } else {
    return res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Invalid refresh token'
      }
    });
  }
});

module.exports = {
  mockRegister,
  mockLogin,
  mockRefreshToken
};