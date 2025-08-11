#!/usr/bin/env node
/**
 * Script to create test prices in Stripe for development
 * Run with: node scripts/create-stripe-test-prices.js
 */

require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function createTestPrices() {
  try {
    console.log('Creating test prices in Stripe...');
    
    // Create Basic product
    const basicProduct = await stripe.products.create({
      name: 'Meetabl Basic',
      description: 'Great for professionals and small teams',
    });
    console.log('Created Basic product:', basicProduct.id);
    
    // Create Basic monthly price
    const basicMonthly = await stripe.prices.create({
      product: basicProduct.id,
      unit_amount: 1100, // $11.00
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      nickname: 'Basic Monthly',
    });
    console.log('Created Basic monthly price:', basicMonthly.id);
    
    // Create Basic annual price
    const basicAnnual = await stripe.prices.create({
      product: basicProduct.id,
      unit_amount: 10800, // $108.00 ($9/month)
      currency: 'usd',
      recurring: {
        interval: 'year',
      },
      nickname: 'Basic Annual',
    });
    console.log('Created Basic annual price:', basicAnnual.id);
    
    // Create Professional product
    const proProduct = await stripe.products.create({
      name: 'Meetabl Professional',
      description: 'Advanced features for power users',
    });
    console.log('Created Professional product:', proProduct.id);
    
    // Create Professional monthly price
    const proMonthly = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 2100, // $21.00
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      nickname: 'Professional Monthly',
    });
    console.log('Created Professional monthly price:', proMonthly.id);
    
    // Create Professional annual price
    const proAnnual = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 20400, // $204.00 ($17/month)
      currency: 'usd',
      recurring: {
        interval: 'year',
      },
      nickname: 'Professional Annual',
    });
    console.log('Created Professional annual price:', proAnnual.id);
    
    console.log('\n✅ Test prices created successfully!');
    console.log('\nUpdate your configuration files with these IDs:');
    console.log(`
BASIC:
  - Monthly: ${basicMonthly.id}
  - Annual: ${basicAnnual.id}
  
PROFESSIONAL:
  - Monthly: ${proMonthly.id}
  - Annual: ${proAnnual.id}
    `);
    
  } catch (error) {
    console.error('Error creating test prices:', error.message);
    process.exit(1);
  }
}

createTestPrices();