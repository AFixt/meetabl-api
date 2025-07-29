/**
 * Generate coverage reports and update documentation
 *
 * This script runs Jest with coverage and updates the documentation
 */

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Badges directory path
const badgesDir = path.join(__dirname, '../docs/badges');

// Badge generation helper
function generateBadge(label, value, color) {
  const badgeColor = getBadgeColor(parseFloat(value));
  return `https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(value)}%25-${badgeColor}`;
}

function getBadgeColor(percentage) {
  if (percentage >= 90) return 'brightgreen';
  if (percentage >= 80) return 'green';
  if (percentage >= 70) return 'yellowgreen';
  if (percentage >= 60) return 'yellow';
  if (percentage >= 50) return 'orange';
  return 'red';
}

// Helper function to simulate fetch if not available in Node.js
async function fetch(url) {
  const https = require('https');
  const http = require('http');
  
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    
    client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          text: () => Promise.resolve(data)
        });
      });
      
    }).on('error', reject);
  });
}

// Main async function
async function generateCoverage() {
  try {
    console.log('🧪 Running API tests with coverage...');
    
    // Create badges directory if it doesn't exist
    try {
      await fs.access(badgesDir);
    } catch {
      await fs.mkdir(badgesDir, { recursive: true });
    }

    // Run Jest with coverage
    try {
      execSync('npx jest --coverage --coverageReporters=json-summary --coverageReporters=html --coverageReporters=text --coverageReporters=lcov', {
        stdio: 'inherit'
      });
    } catch (error) {
      console.error('⚠️  Tests failed but continuing with coverage generation');
    }

    // Read coverage summary and generate badges
    console.log('📊 Generating coverage badges...');
    const coverageSummaryPath = path.join(__dirname, '../coverage/coverage-summary.json');
    
    try {
      const coverageSummaryContent = await fs.readFile(coverageSummaryPath, 'utf8');
      const coverageSummary = JSON.parse(coverageSummaryContent);
      const { total } = coverageSummary;

      // Generate badge URLs and download them
      const badges = [
        { name: 'statements', value: total.statements.pct },
        { name: 'branches', value: total.branches.pct },
        { name: 'functions', value: total.functions.pct },
        { name: 'lines', value: total.lines.pct }
      ];

      for (const badge of badges) {
        const badgeUrl = generateBadge(badge.name, badge.value.toFixed(1), getBadgeColor(badge.value));
        const badgePath = path.join(badgesDir, `badge-${badge.name}.svg`);
        
        try {
          const response = await fetch(badgeUrl);
          const svgContent = await response.text();
          await fs.writeFile(badgePath, svgContent);
          console.log(`✅ Generated ${badge.name} badge: ${badge.value.toFixed(2)}%`);
        } catch (error) {
          console.error(`❌ Failed to generate ${badge.name} badge:`, error.message);
        }
      }

      // Generate overall coverage badge
      const overallCoverage = (total.statements.pct + total.branches.pct + total.functions.pct + total.lines.pct) / 4;
      const overallBadgeUrl = generateBadge('coverage', overallCoverage.toFixed(1), getBadgeColor(overallCoverage));
      const overallBadgePath = path.join(badgesDir, 'badge-overall.svg');
      
      try {
        const response = await fetch(overallBadgeUrl);
        const svgContent = await response.text();
        await fs.writeFile(overallBadgePath, svgContent);
        console.log(`✅ Generated overall coverage badge: ${overallCoverage.toFixed(2)}%`);
      } catch (error) {
        console.error('❌ Failed to generate overall coverage badge:', error.message);
      }

      // Update documentation
      await updateCoverageDocumentation(total);

      // Generate detailed coverage report
      await generateDetailedCoverageReport(total, coverageSummary);

      console.log('✨ Coverage badges and report generated successfully!');
      console.log(`📈 Overall Coverage: ${overallCoverage.toFixed(2)}%`);
      console.log(`   - Statements: ${total.statements.pct.toFixed(2)}%`);
      console.log(`   - Branches: ${total.branches.pct.toFixed(2)}%`);
      console.log(`   - Functions: ${total.functions.pct.toFixed(2)}%`);
      console.log(`   - Lines: ${total.lines.pct.toFixed(2)}%`);

    } catch (error) {
      console.error('❌ Failed to read coverage summary:', error.message);
      
      // Fallback: try to generate badges with jest-coverage-badges
      try {
        console.log('🔄 Falling back to jest-coverage-badges...');
        execSync('npx jest-coverage-badges --input coverage/coverage-summary.json --output docs/badges', {
          stdio: 'inherit'
        });
      } catch (fallbackError) {
        console.error('❌ Fallback badge generation also failed:', fallbackError.message);
      }
    }
  } catch (error) {
    console.error('Error in coverage generation:', error);
    process.exit(1);
  }
}

async function updateCoverageDocumentation(total) {
  try {
    console.log('📝 Updating coverage documentation...');
    const coverageDoc = path.join(__dirname, '../docs/TEST_COVERAGE.md');
    
    let docContent;
    try {
      docContent = await fs.readFile(coverageDoc, 'utf8');
    } catch {
      console.log('📝 TEST_COVERAGE.md not found, creating new one');
      docContent = `# API Test Coverage

This document tracks the test coverage metrics for the meetabl API.

## Current Coverage

`;
    }

    // Update coverage metrics in table
    docContent = docContent.replace(
      /\| Branches\s+\|\s+[\d.]+%.*?\|/,
      `| Branches  | ${total.branches.pct.toFixed(2)}% |`
    );

    docContent = docContent.replace(
      /\| Functions\s+\|\s+[\d.]+%.*?\|/,
      `| Functions | ${total.functions.pct.toFixed(2)}% |`
    );

    docContent = docContent.replace(
      /\| Lines\s+\|\s+[\d.]+%.*?\|/,
      `| Lines     | ${total.lines.pct.toFixed(2)}% |`
    );

    docContent = docContent.replace(
      /\| Statements\s+\|\s+[\d.]+%.*?\|/,
      `| Statements | ${total.statements.pct.toFixed(2)}% |`
    );

    // If no table exists, add one
    if (!docContent.includes('| Metric')) {
      const tableSection = `
| Metric | Coverage | Status |
|--------|----------|--------|
| **Statements** | ${total.statements.pct.toFixed(2)}% | ${total.statements.pct >= 65 ? '✅ Good' : '⚠️ Needs Improvement'} |
| **Branches** | ${total.branches.pct.toFixed(2)}% | ${total.branches.pct >= 60 ? '✅ Good' : '⚠️ Needs Improvement'} |
| **Functions** | ${total.functions.pct.toFixed(2)}% | ${total.functions.pct >= 70 ? '✅ Good' : '⚠️ Needs Improvement'} |
| **Lines** | ${total.lines.pct.toFixed(2)}% | ${total.lines.pct >= 65 ? '✅ Good' : '⚠️ Needs Improvement'} |

`;
      docContent += tableSection;
    }

    // Add badge embedding if not present
    if (!docContent.includes('## Coverage Badges')) {
      docContent += `
## Coverage Badges

![Overall Coverage](badges/badge-overall.svg)
![Statements](badges/badge-statements.svg)
![Branches](badges/badge-branches.svg)
![Functions](badges/badge-functions.svg)
![Lines](badges/badge-lines.svg)

`;
    }

    await fs.writeFile(coverageDoc, docContent);
    console.log('✅ Updated TEST_COVERAGE.md');
    
  } catch (error) {
    console.error('⚠️  Failed to update documentation:', error.message);
  }
}

async function generateDetailedCoverageReport(total, coverageSummary) {
  try {
    const reportPath = path.join(__dirname, '../docs/API_COVERAGE_REPORT.md');
    const reportContent = `# API Coverage Report

Generated on: ${new Date().toISOString()}

## Summary

| Metric | Coverage | Total | Covered | Uncovered |
|--------|----------|-------|---------|-----------|
| **Statements** | ${total.statements.pct.toFixed(2)}% | ${total.statements.total} | ${total.statements.covered} | ${total.statements.skipped} |
| **Branches** | ${total.branches.pct.toFixed(2)}% | ${total.branches.total} | ${total.branches.covered} | ${total.branches.skipped} |
| **Functions** | ${total.functions.pct.toFixed(2)}% | ${total.functions.total} | ${total.functions.covered} | ${total.functions.skipped} |
| **Lines** | ${total.lines.pct.toFixed(2)}% | ${total.lines.total} | ${total.lines.covered} | ${total.lines.skipped} |

## Coverage Thresholds

- **Global Minimum**: 60-70% depending on metric
- **Controllers**: 70-80% minimum for all metrics
- **Services**: 75-85% minimum for all metrics  
- **Models**: 65-75% minimum for all metrics

## File-Level Coverage

${generateFileLevelReport(coverageSummary)}

## Recommendations

${generateAPIRecommendations(total)}

## HTML Report

For detailed coverage information, view the [HTML coverage report](../coverage/index.html).

## CI/CD Integration

Coverage is automatically generated and reported in:
- GitHub Actions pull requests
- Scheduled nightly runs
- Push to main branch

Last updated: ${new Date().toLocaleString()}
`;

    await fs.writeFile(reportPath, reportContent);
    console.log('✅ Generated detailed coverage report');
    
  } catch (error) {
    console.error('⚠️  Failed to generate detailed coverage report:', error.message);
  }
}

function generateFileLevelReport(coverageSummary) {
  try {
    const files = Object.keys(coverageSummary).filter(key => key !== 'total');
    const lowCoverageFiles = files
      .map(file => ({
        file,
        coverage: coverageSummary[file],
        avg: (coverageSummary[file].statements.pct + 
              coverageSummary[file].branches.pct + 
              coverageSummary[file].functions.pct + 
              coverageSummary[file].lines.pct) / 4
      }))
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 10);

    if (lowCoverageFiles.length === 0) return '✅ All files meet coverage thresholds!';

    let report = '### Files Needing Attention (Lowest 10)\n\n';
    report += '| File | Avg Coverage | Statements | Branches | Functions | Lines |\n';
    report += '|------|--------------|------------|----------|-----------|-------|\n';

    lowCoverageFiles.forEach(({ file, coverage, avg }) => {
      report += `| ${file.replace(process.cwd(), '.')} | ${avg.toFixed(1)}% | ${coverage.statements.pct.toFixed(1)}% | ${coverage.branches.pct.toFixed(1)}% | ${coverage.functions.pct.toFixed(1)}% | ${coverage.lines.pct.toFixed(1)}% |\n`;
    });

    return report;
  } catch (error) {
    return '⚠️ Unable to generate file-level report';
  }
}

function generateAPIRecommendations(total) {
  const recommendations = [];
  
  if (total.statements.pct < 65) {
    recommendations.push('- **Statements**: Add more unit tests to cover uncovered statements');
  }
  
  if (total.branches.pct < 60) {
    recommendations.push('- **Branches**: Add tests for conditional logic and edge cases');
  }
  
  if (total.functions.pct < 70) {
    recommendations.push('- **Functions**: Ensure all functions have corresponding test cases');
  }
  
  if (total.lines.pct < 65) {
    recommendations.push('- **Lines**: Increase line coverage by testing more code paths');
  }

  if (recommendations.length === 0) {
    return '✅ All coverage targets are met! Consider increasing thresholds for higher quality.';
  }

  return recommendations.join('\n');
}

// Run the main function
if (require.main === module) {
  generateCoverage();
}

module.exports = { generateCoverage };
