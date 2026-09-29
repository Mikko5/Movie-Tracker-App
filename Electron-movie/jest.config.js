module.exports = {
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/test'],
    moduleFileExtensions: ['js', 'mjs'],
    transform: {
        '^.+\\.m?js$': 'babel-jest'
    },
    setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/core/**'  // Exclude Electron main process
    ],
    coverageDirectory: 'coverage',
    testMatch: ['**/*.test.js'],
    testPathIgnorePatterns: ['/node_modules/', '/test/e2e/'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
    }
};
