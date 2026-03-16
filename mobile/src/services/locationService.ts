import {PermissionsAndroid, Platform} from 'react-native';
import Geolocation, {
  type AuthorizationResult,
  type GeoError,
  type GeoPosition,
} from 'react-native-geolocation-service';

import type {Coordinates, LocationReading} from '../types/models';

class LocationService {
  private hasRequestedAndroidPermission = false;
  private lastKnownLocation: LocationReading | null = null;

  getCachedLocation(): Coordinates | null {
    return this.lastKnownLocation;
  }

  private async hasLocationPermission(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const authorization = await Geolocation.requestAuthorization(
        'whenInUse',
      ).catch<AuthorizationResult>(() => 'denied');

      return authorization === 'granted';
    }

    const fineLocation = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const coarseLocation =
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
    const hasExistingPermission =
      (await PermissionsAndroid.check(fineLocation)) ||
      (await PermissionsAndroid.check(coarseLocation));

    if (hasExistingPermission) {
      return true;
    }

    if (this.hasRequestedAndroidPermission) {
      return false;
    }

    this.hasRequestedAndroidPermission = true;

    const result = await PermissionsAndroid.requestMultiple([
      fineLocation,
      coarseLocation,
    ]);

    return (
      result[fineLocation] === PermissionsAndroid.RESULTS.GRANTED ||
      result[coarseLocation] === PermissionsAndroid.RESULTS.GRANTED
    );
  }

  private static buildLocationReading(position: GeoPosition): LocationReading {
    const capturedAt = Number.isFinite(position.timestamp)
      ? new Date(position.timestamp).toISOString()
      : new Date().toISOString();

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: Number.isFinite(position.coords.accuracy)
        ? position.coords.accuracy
        : null,
      capturedAt,
    };
  }

  async getCurrentLocation(): Promise<LocationReading> {
    const hasPermission = await this.hasLocationPermission();

    if (!hasPermission) {
      throw new Error(
        'Location permission is required to share the patient location.',
      );
    }

    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => {
          const nextLocation = LocationService.buildLocationReading(position);
          this.lastKnownLocation = nextLocation;
          resolve(nextLocation);
        },
        (error: GeoError) => {
          reject(
            new Error(
              error.message || 'Unable to capture the current location.',
            ),
          );
        },
        {
          accuracy: {
            android: 'balanced',
            ios: 'hundredMeters',
          },
          enableHighAccuracy: false,
          timeout: 15_000,
          maximumAge: 60_000,
          forceRequestLocation: true,
          showLocationDialog: true,
        },
      );
    });
  }
}

export const locationService = new LocationService();
