#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, '../src/models');

// List of model files to update
const modelFiles = [
  'audit-log.model.js',
  'availability-rule.model.js',
  'booking.model.js',
  'bookingRequest.model.js',
  'calendar-token.model.js',
  'invoice.model.js',
  'jwt-blacklist.model.js',
  'notification.model.js',
  'payment.model.js',
  'pricing-rule.model.js',
  'team-member.model.js',
  'team.model.js',
  'user-settings.model.js'
];

modelFiles.forEach(file => {
  const filePath = path.join(modelsDir, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file} - file not found`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Replace DataTypes.STRING(36) with DataTypes.UUID for id fields and foreign keys
  const patterns = [
    // Primary key id fields
    /type:\s*DataTypes\.STRING\(36\)([,\s]*)([\s\S]*?)(primaryKey:\s*true|defaultValue:\s*\(\)\s*=>\s*uuidv4\(\))/g,
    // Foreign key fields ending with _id or Id
    /(\w+[iI]d:\s*{[\s\S]*?)type:\s*DataTypes\.STRING\(36\)/g,
    // Any field that references another model
    /(references:\s*{[\s\S]*?)type:\s*DataTypes\.STRING\(36\)/g
  ];
  
  // Replace primary key patterns
  const newContent = content.replace(/type:\s*DataTypes\.STRING\(36\)/g, (match, offset) => {
    // Check if this is within an id field definition
    const before = content.substring(Math.max(0, offset - 100), offset);
    const after = content.substring(offset, Math.min(content.length, offset + 200));
    
    // Check if it's an ID field (primary key or foreign key)
    if (before.match(/\bid:\s*{/) || 
        before.match(/\w+_id:\s*{/) || 
        before.match(/\w+Id:\s*{/) ||
        before.match(/userId:\s*{/) ||
        before.match(/teamId:\s*{/) ||
        before.match(/bookingId:\s*{/) ||
        before.match(/eventTypeId:\s*{/) ||
        after.includes('primaryKey: true') ||
        after.includes('references:')) {
      modified = true;
      return 'type: DataTypes.UUID';
    }
    
    return match;
  });
  
  if (modified) {
    fs.writeFileSync(filePath, newContent);
    console.log(`✅ Updated ${file}`);
  } else {
    console.log(`⏭️  No changes needed for ${file}`);
  }
});

console.log('\n✅ UUID type fixes complete!');