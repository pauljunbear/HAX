# /test - Run Tests

Run the test suite for imHAX.

## Instructions

### Quick Test (Default)

Run Jest unit tests:

```bash
npm test
```

### With Coverage

```bash
npm run test:coverage
```

### Watch Mode

```bash
npm run test:watch
```

### E2E Tests

```bash
npm run test:e2e        # Headless
npm run test:e2e:open   # Interactive Cypress UI
```

### Accessibility Tests

```bash
npm run test:a11y
```

## Test Structure

```
src/
├── components/
│   ├── *.test.tsx      # Component tests
│   └── __mocks__/      # Mock files
├── hooks/
│   └── *.test.ts       # Hook tests
└── lib/
    ├── effects/__tests__/
    └── performance/__tests__/

cypress/
├── e2e/
│   ├── onboarding.cy.ts
│   └── accessibility.cy.ts
└── support/
```

## Coverage Thresholds

The project requires 80% coverage for:

- Branches
- Functions
- Lines
- Statements

## Common Issues

### Tests Failing?

1. Clear Jest cache: `npm run clean`
2. Reinstall deps: `rm -rf node_modules && npm install`
3. Check for missing mocks in `__mocks__/`
