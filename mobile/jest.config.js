module.exports = {
  preset: 'react-native',
  moduleNameMapper: {
    '\\.(ttf)$': '<rootDir>/__mocks__/fileMock.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-community|react-native-vector-icons)/)',
  ],
};
