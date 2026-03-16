import React from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';

import {colors} from './src/constants/colors';
import {applyPoppinsDefaults} from './src/constants/typography';
import {RootNavigator} from './src/navigation/RootNavigator';

applyPoppinsDefaults();

export default function App(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.drawer} />
      <RootNavigator />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
