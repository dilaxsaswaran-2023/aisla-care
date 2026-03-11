import type {Coordinates} from '../types/models';

const defaultCoordinates: Coordinates = {
  latitude: 6.9271,
  longitude: 79.8612,
};

class LocationService {
  private lastKnownLocation = defaultCoordinates;

  getCachedLocation(): Coordinates {
    return this.lastKnownLocation;
  }

  async getCurrentLocation(): Promise<Coordinates> {
    return this.lastKnownLocation;
  }
}

export const locationService = new LocationService();
