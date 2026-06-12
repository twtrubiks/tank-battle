module.exports = {
  testEnvironment: 'jsdom',
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/main.js',
    '!src/**/*.config.js'
  ],
  coverageDirectory: 'coverage',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^phaser$': '<rootDir>/tests/mocks/phaser.js'
  },
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  setupFiles: ['<rootDir>/tests/setup.js']
};
