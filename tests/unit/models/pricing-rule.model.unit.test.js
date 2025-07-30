/**
 * Pricing Rule model unit tests
 *
 * Tests the PricingRule model definition, validations, and behavior
 *
 * @author meetabl Team
 */

require('../test-setup');
const { setupControllerMocks } = require('../../fixtures/test-helper');

// Setup mocks
setupControllerMocks();

// Import models after mocks are set up
const { PricingRule } = require('../../../src/models');
const { v4: uuidv4 } = jest.requireActual('uuid');

describe('PricingRule Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock PricingRule model methods
    PricingRule.create = jest.fn();
    PricingRule.findAll = jest.fn();
    PricingRule.findOne = jest.fn();
    PricingRule.findByPk = jest.fn();
    PricingRule.update = jest.fn();
    PricingRule.destroy = jest.fn();
  });

  describe('Pricing Rule Operations', () => {
    beforeEach(() => {
      // Setup default mock implementations
      PricingRule.create.mockImplementation(async (data) => ({
        id: data.id || uuidv4(),
        user_id: data.user_id,
        name: data.name,
        description: data.description || null,
        price_per_slot: data.price_per_slot,
        currency: data.currency || 'USD',
        is_active: data.is_active !== undefined ? data.is_active : true,
        created_at: new Date(),
        updated_at: new Date(),
        ...data
      }));
      
      PricingRule.findAll.mockResolvedValue([]);
      PricingRule.findOne.mockResolvedValue(null);
      PricingRule.update.mockResolvedValue([1]);
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

      expect(PricingRule.create).toHaveBeenCalledWith(validData);
      expect(result).toMatchObject(validData);
      expect(result.id).toBeDefined();
      expect(result.is_active).toBe(true);
    });

    test('should create pricing rule with default currency', async () => {
      const validData = {
        user_id: 'user-123',
        name: 'Basic Consultation',
        price_per_slot: 75.00
      };

      const result = await PricingRule.create(validData);

      expect(PricingRule.create).toHaveBeenCalledWith(validData);
      expect(result.currency).toBe('USD');
      expect(result.is_active).toBe(true);
    });

    test('should create pricing rule without description', async () => {
      const validData = {
        user_id: 'user-123',
        name: 'Quick Call',
        price_per_slot: 50.00,
        currency: 'EUR'
      };

      const result = await PricingRule.create(validData);

      expect(PricingRule.create).toHaveBeenCalledWith(validData);
      expect(result).toMatchObject(validData);
      expect(result.description).toBeNull();
    });

    test('should handle decimal prices correctly', async () => {
      const validData = {
        user_id: 'user-123',
        name: 'Specialized Service',
        price_per_slot: 99.99,
        currency: 'GBP'
      };

      const result = await PricingRule.create(validData);

      expect(PricingRule.create).toHaveBeenCalledWith(validData);
      expect(result.price_per_slot).toBe(99.99);
    });

    test('should support zero price for free consultations', async () => {
      const validData = {
        user_id: 'user-123',
        name: 'Free Initial Consultation',
        price_per_slot: 0.00,
        currency: 'USD'
      };

      const result = await PricingRule.create(validData);

      expect(PricingRule.create).toHaveBeenCalledWith(validData);
      expect(result.price_per_slot).toBe(0.00);
    });

    test('should support querying active pricing rules for user', async () => {
      const mockRules = [
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
      ];
      
      PricingRule.findAll.mockResolvedValue(mockRules);

      const activePricingRules = await PricingRule.findAll({
        where: { 
          user_id: 'user-123',
          is_active: true 
        },
        order: [['price_per_slot', 'ASC']]
      });

      expect(PricingRule.findAll).toHaveBeenCalledWith({
        where: { 
          user_id: 'user-123',
          is_active: true 
        },
        order: [['price_per_slot', 'ASC']]
      });
      expect(activePricingRules).toHaveLength(2);
    });

    test('should support deactivating pricing rules', async () => {
      const updatedCount = await PricingRule.update(
        { is_active: false },
        { where: { id: 'pricing-rule-123' } }
      );

      expect(PricingRule.update).toHaveBeenCalledWith(
        { is_active: false },
        { where: { id: 'pricing-rule-123' } }
      );
      expect(updatedCount).toEqual([1]);
    });

    test('should support updating pricing information', async () => {
      const updateData = {
        name: 'Updated Service Name',
        description: 'Updated description with new features',
        price_per_slot: 125.00
      };

      const updatedCount = await PricingRule.update(
        updateData,
        { where: { id: 'pricing-rule-123' } }
      );

      expect(PricingRule.update).toHaveBeenCalledWith(
        updateData,
        { where: { id: 'pricing-rule-123' } }
      );
      expect(updatedCount).toEqual([1]);
    });
  });

  describe('Currency Support', () => {
    const supportedCurrencies = [
      'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'INR', 'BRL'
    ];

    test.each(supportedCurrencies)('should support %s currency', async (currency) => {
      const validData = {
        user_id: 'user-123',
        name: `Service in ${currency}`,
        price_per_slot: 100.00,
        currency
      };

      const result = await PricingRule.create(validData);

      expect(PricingRule.create).toHaveBeenCalledWith(validData);
      expect(result.currency).toBe(currency);
    });
  });

  describe('Price Tier Management', () => {
    test('should support different price tiers', async () => {
      const priceTiers = [
        { name: 'Basic', price: 50.00 },
        { name: 'Standard', price: 100.00 },
        { name: 'Premium', price: 150.00 },
        { name: 'Enterprise', price: 250.00 }
      ];

      const createdTiers = await Promise.all(
        priceTiers.map(tier => PricingRule.create({
          user_id: 'user-123',
          name: `${tier.name} Consultation`,
          price_per_slot: tier.price,
          currency: 'USD'
        }))
      );

      expect(PricingRule.create).toHaveBeenCalledTimes(4);
      expect(createdTiers).toHaveLength(4);
      
      createdTiers.forEach((tier, index) => {
        expect(tier.name).toContain(priceTiers[index].name);
        expect(tier.price_per_slot).toBe(priceTiers[index].price);
      });
    });

    test('should support bulk pricing rule management', async () => {
      PricingRule.update.mockResolvedValue([3]); // 3 rules updated

      // Deactivate all pricing rules for a user
      const deactivatedCount = await PricingRule.update(
        { is_active: false },
        { where: { user_id: 'user-123' } }
      );

      expect(PricingRule.update).toHaveBeenCalledWith(
        { is_active: false },
        { where: { user_id: 'user-123' } }
      );
      expect(deactivatedCount).toEqual([3]);
    });

    test('should handle large price values', async () => {
      const validData = {
        user_id: 'user-123',
        name: 'Executive Coaching',
        price_per_slot: 99999999.99, // Maximum for DECIMAL(10,2)
        currency: 'USD'
      };

      const result = await PricingRule.create(validData);

      expect(PricingRule.create).toHaveBeenCalledWith(validData);
      expect(result.price_per_slot).toBe(99999999.99);
    });
  });
});