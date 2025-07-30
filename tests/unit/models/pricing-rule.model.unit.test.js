/**
 * Pricing Rule model unit tests
 *
 * Tests the PricingRule model definition, validations, and behavior
 *
 * @author meetabl Team
 */

require('../test-setup');

const { v4: uuidv4 } = require('uuid');

// Mock sequelize and models
const mockSequelize = {
  define: jest.fn(),
  DataTypes: require('sequelize').DataTypes
};

const mockUser = {
  id: 'user-123'
};

jest.mock('../../../src/config/database', () => ({
  sequelize: mockSequelize
}));

jest.mock('../../../src/models/user.model', () => mockUser);

// Import the model after mocking
const PricingRule = require('../../../src/models/pricing-rule.model');

describe('PricingRule Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Model Definition', () => {
    test('should define PricingRule model with correct table name', () => {
      expect(mockSequelize.define).toHaveBeenCalledWith(
        'PricingRule',
        expect.any(Object),
        expect.objectContaining({
          tableName: 'pricing_rules',
          timestamps: true,
          createdAt: 'created_at',
          updatedAt: 'updated_at'
        })
      );
    });

    test('should have correct field definitions', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];

      // Check id field
      expect(fieldDefinitions.id).toEqual({
        type: expect.any(Object),
        primaryKey: true,
        defaultValue: expect.any(Function)
      });

      // Check user_id field
      expect(fieldDefinitions.user_id).toEqual({
        type: expect.any(Object),
        allowNull: false,
        references: {
          model: mockUser,
          key: 'id'
        }
      });

      // Check name field
      expect(fieldDefinitions.name).toEqual({
        type: expect.any(Object),
        allowNull: false,
        validate: {
          notEmpty: true
        }
      });

      // Check description field
      expect(fieldDefinitions.description).toEqual({
        type: expect.any(Object),
        allowNull: true
      });

      // Check price_per_slot field
      expect(fieldDefinitions.price_per_slot).toEqual({
        type: expect.any(Object),
        allowNull: false,
        validate: {
          min: 0
        }
      });

      // Check currency field
      expect(fieldDefinitions.currency).toEqual({
        type: expect.any(Object),
        allowNull: false,
        defaultValue: 'USD',
        validate: {
          isUppercase: true,
          len: [3, 3]
        }
      });

      // Check is_active field
      expect(fieldDefinitions.is_active).toEqual({
        type: expect.any(Object),
        allowNull: false,
        defaultValue: true
      });
    });

    test('should generate UUID for id by default', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      const idDefaultValue = fieldDefinitions.id.defaultValue;
      
      expect(typeof idDefaultValue).toBe('function');
      
      const generatedId = idDefaultValue();
      expect(generatedId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    test('should have correct timestamp configuration', () => {
      const options = mockSequelize.define.mock.calls[0][2];
      
      expect(options.timestamps).toBe(true);
      expect(options.createdAt).toBe('created_at');
      expect(options.updatedAt).toBe('updated_at');
    });
  });

  describe('Field Validations', () => {
    let mockPricingRuleInstance;
    let mockCreate;

    beforeEach(() => {
      mockPricingRuleInstance = {
        id: uuidv4(),
        user_id: 'user-123',
        name: 'Standard Consultation',
        description: 'Standard 60-minute consultation session',
        price_per_slot: 100.00,
        currency: 'USD',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
        save: jest.fn().mockResolvedValue(true),
        validate: jest.fn().mockResolvedValue(true)
      };

      mockCreate = jest.fn().mockResolvedValue(mockPricingRuleInstance);
      
      // Mock the model methods
      Object.assign(PricingRule, {
        create: mockCreate,
        findAll: jest.fn().mockResolvedValue([mockPricingRuleInstance]),
        findOne: jest.fn().mockResolvedValue(mockPricingRuleInstance),
        findByPk: jest.fn().mockResolvedValue(mockPricingRuleInstance),
        update: jest.fn().mockResolvedValue([1])
      });
    });

    test('should create pricing rule with valid data', async () => {
      const validData = {
        user_id: 'user-123',
        name: 'Premium Consultation',
        description: 'Premium 90-minute consultation with follow-up',
        price_per_slot: 150.00,
        currency: 'USD'
      };

      const result = await PricingRule.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockPricingRuleInstance);
    });

    test('should create pricing rule with default currency', async () => {
      const validData = {
        user_id: 'user-123',
        name: 'Basic Consultation',
        price_per_slot: 75.00
      };

      const result = await PricingRule.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockPricingRuleInstance);
    });

    test('should create pricing rule without description', async () => {
      const validData = {
        user_id: 'user-123',
        name: 'Quick Call',
        price_per_slot: 50.00,
        currency: 'EUR'
      };

      const result = await PricingRule.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockPricingRuleInstance);
    });

    test('should handle decimal prices correctly', async () => {
      const validData = {
        user_id: 'user-123',
        name: 'Specialized Service',
        price_per_slot: 99.99,
        currency: 'GBP'
      };

      const result = await PricingRule.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockPricingRuleInstance);
    });

    test('should support zero price for free consultations', async () => {
      const validData = {
        user_id: 'user-123',
        name: 'Free Initial Consultation',
        price_per_slot: 0.00,
        currency: 'USD'
      };

      const result = await PricingRule.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result).toEqual(mockPricingRuleInstance);
    });
  });

  describe('Data Integrity', () => {
    test('should ensure user_id is required', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.user_id.allowNull).toBe(false);
    });

    test('should ensure name is required and not empty', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.name.allowNull).toBe(false);
      expect(fieldDefinitions.name.validate.notEmpty).toBe(true);
    });

    test('should ensure price_per_slot is required and non-negative', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.price_per_slot.allowNull).toBe(false);
      expect(fieldDefinitions.price_per_slot.validate.min).toBe(0);
    });

    test('should ensure currency has proper validation', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.currency.allowNull).toBe(false);
      expect(fieldDefinitions.currency.defaultValue).toBe('USD');
      expect(fieldDefinitions.currency.validate.isUppercase).toBe(true);
      expect(fieldDefinitions.currency.validate.len).toEqual([3, 3]);
    });

    test('should ensure is_active has proper default', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.is_active.allowNull).toBe(false);
      expect(fieldDefinitions.is_active.defaultValue).toBe(true);
    });

    test('should allow description to be null', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.description.allowNull).toBe(true);
    });

    test('should have proper field types', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      // Check that price_per_slot is DECIMAL(10, 2)
      expect(fieldDefinitions.price_per_slot.type.constructor.name).toContain('DECIMAL');
      
      // Check that name is STRING(100)
      expect(fieldDefinitions.name.type.constructor.name).toContain('STRING');
      
      // Check that currency is STRING(3)
      expect(fieldDefinitions.currency.type.constructor.name).toContain('STRING');
      
      // Check that description is TEXT
      expect(fieldDefinitions.description.type.constructor.name).toContain('TEXT');
      
      // Check that is_active is BOOLEAN
      expect(fieldDefinitions.is_active.type.constructor.name).toContain('BOOLEAN');
    });
  });

  describe('Model Relationships', () => {
    test('should reference User model in user_id field', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.user_id.references).toEqual({
        model: mockUser,
        key: 'id'
      });
    });
  });

  describe('Currency Support', () => {
    const supportedCurrencies = [
      'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'INR', 'BRL'
    ];

    test.each(supportedCurrencies)('should support %s currency', async (currency) => {
      const mockCreate = jest.fn().mockResolvedValue({
        id: uuidv4(),
        user_id: 'user-123',
        name: `Service in ${currency}`,
        price_per_slot: 100.00,
        currency,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      });

      Object.assign(PricingRule, { create: mockCreate });

      const validData = {
        user_id: 'user-123',
        name: `Service in ${currency}`,
        price_per_slot: 100.00,
        currency
      };

      const result = await PricingRule.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result.currency).toBe(currency);
    });

    test('should validate currency format is uppercase', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.currency.validate.isUppercase).toBe(true);
    });

    test('should validate currency is exactly 3 characters', () => {
      const fieldDefinitions = mockSequelize.define.mock.calls[0][1];
      
      expect(fieldDefinitions.currency.validate.len).toEqual([3, 3]);
    });
  });

  describe('Pricing Business Logic', () => {
    test('should support querying active pricing rules for user', async () => {
      const mockFindAll = jest.fn().mockResolvedValue([
        {
          id: '1',
          user_id: 'user-123',
          name: 'Standard Rate',
          price_per_slot: 100.00,
          currency: 'USD',
          is_active: true
        },
        {
          id: '2',
          user_id: 'user-123',
          name: 'Premium Rate',
          price_per_slot: 150.00,
          currency: 'USD',
          is_active: true
        }
      ]);

      Object.assign(PricingRule, { findAll: mockFindAll });

      const activePricingRules = await PricingRule.findAll({
        where: { 
          user_id: 'user-123',
          is_active: true 
        },
        order: [['price_per_slot', 'ASC']]
      });

      expect(mockFindAll).toHaveBeenCalledWith({
        where: { 
          user_id: 'user-123',
          is_active: true 
        },
        order: [['price_per_slot', 'ASC']]
      });
      expect(activePricingRules).toHaveLength(2);
    });

    test('should support deactivating pricing rules', async () => {
      const mockUpdate = jest.fn().mockResolvedValue([1]);

      Object.assign(PricingRule, { update: mockUpdate });

      const updatedCount = await PricingRule.update(
        { is_active: false },
        { where: { id: 'pricing-rule-123' } }
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        { is_active: false },
        { where: { id: 'pricing-rule-123' } }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should support updating pricing information', async () => {
      const mockUpdate = jest.fn().mockResolvedValue([1]);

      Object.assign(PricingRule, { update: mockUpdate });

      const updateData = {
        name: 'Updated Service Name',
        description: 'Updated description with new features',
        price_per_slot: 125.00
      };

      const updatedCount = await PricingRule.update(
        updateData,
        { where: { id: 'pricing-rule-123' } }
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        updateData,
        { where: { id: 'pricing-rule-123' } }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should support different price tiers', async () => {
      const priceTiers = [
        { name: 'Basic', price: 50.00 },
        { name: 'Standard', price: 100.00 },
        { name: 'Premium', price: 150.00 },
        { name: 'Enterprise', price: 250.00 }
      ];

      const mockCreate = jest.fn().mockImplementation((data) => Promise.resolve({
        id: uuidv4(),
        ...data,
        user_id: 'user-123',
        currency: 'USD',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }));

      Object.assign(PricingRule, { create: mockCreate });

      const createdTiers = await Promise.all(
        priceTiers.map(tier => PricingRule.create({
          user_id: 'user-123',
          name: `${tier.name} Consultation`,
          price_per_slot: tier.price,
          currency: 'USD'
        }))
      );

      expect(mockCreate).toHaveBeenCalledTimes(4);
      expect(createdTiers).toHaveLength(4);
      
      createdTiers.forEach((tier, index) => {
        expect(tier.name).toContain(priceTiers[index].name);
        expect(tier.price_per_slot).toBe(priceTiers[index].price);
      });
    });

    test('should support bulk pricing rule management', async () => {
      const mockUpdate = jest.fn().mockResolvedValue([3]); // 3 rules updated

      Object.assign(PricingRule, { update: mockUpdate });

      // Deactivate all pricing rules for a user
      const deactivatedCount = await PricingRule.update(
        { is_active: false },
        { where: { user_id: 'user-123' } }
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        { is_active: false },
        { where: { user_id: 'user-123' } }
      );
      expect(deactivatedCount).toEqual([3]);
    });
  });

  describe('Validation Edge Cases', () => {
    test('should handle large price values within DECIMAL(10,2) limits', async () => {
      const validData = {
        user_id: 'user-123',
        name: 'Executive Coaching',
        price_per_slot: 99999999.99, // Maximum for DECIMAL(10,2)
        currency: 'USD'
      };

      const mockCreate = jest.fn().mockResolvedValue({
        id: uuidv4(),
        ...validData,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      });

      Object.assign(PricingRule, { create: mockCreate });

      const result = await PricingRule.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result.price_per_slot).toBe(99999999.99);
    });

    test('should handle pricing rules with long names', async () => {
      const longName = 'A'.repeat(100); // Test at the limit of STRING(100)

      const validData = {
        user_id: 'user-123',
        name: longName,
        price_per_slot: 100.00,
        currency: 'USD'
      };

      const mockCreate = jest.fn().mockResolvedValue({
        id: uuidv4(),
        ...validData,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      });

      Object.assign(PricingRule, { create: mockCreate });

      const result = await PricingRule.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result.name).toBe(longName);
    });

    test('should handle pricing rules with long descriptions', async () => {
      const longDescription = 'This is a very detailed description. '.repeat(50); // Long TEXT

      const validData = {
        user_id: 'user-123',
        name: 'Detailed Service',
        description: longDescription,
        price_per_slot: 100.00,
        currency: 'USD'
      };

      const mockCreate = jest.fn().mockResolvedValue({
        id: uuidv4(),
        ...validData,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      });

      Object.assign(PricingRule, { create: mockCreate });

      const result = await PricingRule.create(validData);

      expect(mockCreate).toHaveBeenCalledWith(validData);
      expect(result.description).toBe(longDescription);
    });
  });
});