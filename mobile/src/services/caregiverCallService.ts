import {
  Alert,
  Linking,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';

export const caregiverPhoneNumber = '0766484625';

const directCallModule = NativeModules.DirectCallModule as
  | {
      placeCall: (phoneNumber: string) => Promise<void>;
    }
  | undefined;

async function callCaregiver(): Promise<void> {
  const phoneUrl = `tel:${caregiverPhoneNumber}`;

  if (Platform.OS === 'android') {
    try {
      const hasCallPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.CALL_PHONE,
      );
      const callPermissionGranted = hasCallPermission
        ? PermissionsAndroid.RESULTS.GRANTED
        : await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CALL_PHONE,
            {
              title: 'Phone call access',
              message:
                'AISLA needs permission to call Annie directly from the dashboard.',
              buttonPositive: 'Allow',
              buttonNegative: 'Deny',
            },
          );

      if (callPermissionGranted === PermissionsAndroid.RESULTS.GRANTED) {
        if (directCallModule) {
          await directCallModule.placeCall(caregiverPhoneNumber);
          return;
        }

        throw new Error('Direct call module unavailable.');
      }
    } catch {
      // Fall back to the dialer below if direct calling fails.
    }
  }

  try {
    const canOpen = await Linking.canOpenURL(phoneUrl);
    if (!canOpen) {
      Alert.alert('Calling unavailable', caregiverPhoneNumber);
      return;
    }

    await Linking.openURL(phoneUrl);
  } catch {
    Alert.alert('Unable to start call', caregiverPhoneNumber);
  }
}

export const caregiverCallService = {
  callCaregiver,
};
