/**
 * Generate coverage reports and update documentation
 * 
 * This script runs Jest with coverage and updates the documentation
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create badges directory if it doesn't exist
const badgesDir = path.join(__dirname, '../docs/badges');
if (!fs.existsSync(badgesDir)) {
  fs.mkdirSync(badgesDir, { recursive: true });
}

// Run Jest with coverage
console.log('Running tests with coverage...');
try {
  execSync('npx jest --coverage --coverageReporters=json-summary --coverageReporters=html --coverageReporters=text', { 
    stdio: 'inherit' 
  });
} catch (error) {
  console.error('Tests failed but continuing with coverage generation');
}

// Generate badges
console.log('Generating coverage badges...');
try {
  execSync('npx jest-coverage-badges --input coverage/coverage-summary.json --output docs/badges', { 
    stdio: 'inherit' 
  });
} catch (error) {
  console.error('Failed to generate coverage badges:', error.message);
  process.exit(1);
}

// Read coverage summary to update documentation
console.log('Updating coverage documentation...');
try {
  const coverageSummary = JSON.parse(fs.readFileSync(path.join(__dirname, '../coverage/coverage-summary.json'), 'utf8'));
  const total = coverageSummary.total;
  
  const coverageDoc = path.join(__dirname, '../docs/TEST_COVERAGE.md');
  let docContent = fs.readFileSync(coverageDoc, 'utf8');
  
  // Update coverage metrics in table
  docContent = docContent.replace(/\| Branches\s+\|\s+[\d.]+%\+?\s+\|/, 
    `| Branches  | ${total.branches.pct.toFixed(2)}% |`);
  
  docContent = docContent.replace(/\| Functions\s+\|\s+[\d.]+%\+?\s+\|/, 
    `| Functions | ${total.functions.pct.toFixed(2)}% |`);
  
  docContent = docContent.replace(/\| Lines\s+\|\s+[\d.]+%\+?\s+\|/, 
    `| Lines     | ${total.lines.pct.toFixed(2)}% |`);
  
  docContent = docContent.replace(/\| Statements\s+\|\s+[\d.]+%\+?\s+\|/, 
    `| Statements | ${total.statements.pct.toFixed(2)}% |`);
  
  // Add badge embedding
  if (!docContent.includes('## Coverage Badges')) {
    docContent += `
## Coverage Badges

![Statements](badges/badge-statements.svg)
![Branches](badges/badge-branches.svg)
![Functions](badges/badge-functions.svg)
![Lines](badges/badge-lines.svg)

`;
  }
  
  fs.writeFileSync(coverageDoc, docContent);
  console.log('Documentation updated successfully!');
} catch (error) {
  console.error('Failed to update documentation:', error.message);
}