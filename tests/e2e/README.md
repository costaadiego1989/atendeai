# Automation Module E2E Tests

This directory contains end-to-end tests for the Automations module, covering all major user workflows and features.

## Test Files

### Main Test Files
- **automations.spec.ts** - Core automations module tests (CRUD operations, wizard, details, export/import)
- **automation-search.spec.ts** - Advanced search functionality tests
- **automation-wizard.spec.ts** - Automation wizard configuration tests
- **automation-flow.spec.ts** - Flow diagram visualization tests
- **automation-metrics.spec.ts** - Performance metrics and analytics tests

### Test Structure

Each test file follows this pattern:
1. **Setup** - Login and navigate to the automations page
2. **Test cases** - Individual test scenarios with assertions
3. **Cleanup** - Automatic cleanup after each test

## Running Tests

### Install Dependencies
```bash
npm install --save-dev @playwright/test
npx playwright install
```

### Run All Tests
```bash
npm run test:e2e
```

### Run Specific Test File
```bash
npm run test:e2e -- automations.spec.ts
```

### Run Specific Test
```bash
npm run test:e2e -- --grep "should create new automation"
```

### Run in Headless Mode
```bash
npm run test:e2e -- --headed=false
```

### Run in Headed Mode
```bash
npm run test:e2e -- --headed=true
```

### Run with UI Mode
```bash
npm run test:e2e -- --ui
```

### Run with Trace Viewer
```bash
npm run test:e2e -- --trace on
```

### Run with Video Recording
```bash
npm run test:e2e -- --video retain-on-failure
```

## Test Coverage

### Core Functionality
- ✅ Display automations list with search
- ✅ Create new automations using wizard
- ✅ Edit existing automations
- ✅ Delete automations
- ✅ View automation details
- ✅ Test automations before saving
- ✅ Export automation configurations
- ✅ Import automation configurations

### Advanced Search
- ✅ Search by automation name
- ✅ Search by automation description
- ✅ Search by trigger type
- ✅ Search by action type
- ✅ Search by status
- ✅ Search by date range
- ✅ Combine multiple search criteria
- ✅ Save and load search configurations
- ✅ Display search results count
- ✅ Handle empty search results
- ✅ Clear all search filters

### Automation Wizard
- ✅ Navigate through wizard steps
- ✅ Complete basic information step
- ✅ Configure triggers in step 2
- ✅ Configure actions in step 3
- ✅ Test automation before finishing
- ✅ Handle validation errors
- ✅ Save automation as draft
- ✅ Load and edit draft automations
- ✅ Cancel wizard without saving
- ✅ Display contextual help
- ✅ Handle template selection

### Flow Diagram
- ✅ Display automation flow diagram
- ✅ Navigate with keyboard
- ✅ Zoom in/out/reset
- ✅ Pan diagram
- ✅ Export diagram
- ✅ Display node details on click
- ✅ Handle complex flow diagrams
- ✅ Handle conditional flows
- ✅ Display performance metrics

### Metrics & Analytics
- ✅ Display metrics dashboard
- ✅ Filter by time range
- ✅ Filter by automation status
- ✅ Export metrics data
- ✅ Display detailed execution logs
- ✅ Display error analysis
- ✅ Display performance insights
- ✅ Display automation comparison
- ✅ Display real-time metrics
- ✅ Display health score
- ✅ Display cost analysis
- ✅ Display predictive analytics

## Accessibility Testing

All tests verify:
- Keyboard navigation
- Screen reader announcements
- High contrast mode support
- ARIA labels and roles

## Performance Testing

Tests include:
- Loading state verification
- Network error handling
- Performance metrics display

## Best Practices

### Test Organization
- Each test focuses on a single behavior
- Tests are independent and don't rely on previous test state
- Use descriptive test names that clearly state what is being tested
- Add comments to explain complex test scenarios

### Test Data
- Use realistic test data
- Avoid hardcoding values that could change
- Use data attributes (`data-testid`) for element selection

### Assertions
- Use meaningful assertions
- Verify both success and failure paths
- Check for appropriate error messages

## Troubleshooting

### Tests Failing Due to Element Not Found
- Check if the element exists in the DOM
- Verify the data-testid attribute is correct
- Check if the page has loaded properly

### Tests Timing Out
- Increase timeout for slow operations
- Add explicit waits for dynamic content
- Check if the application is running

### Tests Failing Due to Authentication
- Verify login credentials are correct
- Check if the application requires additional authentication steps
- Verify the baseURL is correct

## CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
        
      - name: Run E2E tests
        run: npm run test:e2e
        
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v2
        with:
          name: playwright-report
          path: playwright-report/
```

## Contributing

When adding new tests:
1. Follow the existing test structure and naming conventions
2. Use descriptive test names
3. Include both success and failure paths
4. Add comments to explain complex scenarios
5. Update this README with new test coverage

## License

This test suite is part of the AtendeAi project.