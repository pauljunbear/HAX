// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/src/lib/effects/__tests__/setupTests.ts',
    '<rootDir>/src/lib/performance/__tests__/setupTests.ts',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  transformIgnorePatterns: ['node_modules/(?!(@react-three|three)/)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@react-three/fiber$': '<rootDir>/src/components/__mocks__/react-three-fiber.tsx',
    '^@react-three/drei$': '<rootDir>/src/components/__mocks__/react-three-fiber.tsx',
    '^three$': '<rootDir>/src/components/__mocks__/three.js',
    '^test-module$': '<rootDir>/src/__mocks__/dynamic-modules/test-module.js',
    '^dependency-module$': '<rootDir>/src/__mocks__/dynamic-modules/dependency-module.js',
    '^large-module$': '<rootDir>/src/__mocks__/dynamic-modules/large-module.js',
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/src/components/__mocks__/fileMock.js',
  },
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
