const backendOrigin = 'http://185.252.234.120:5030';

export const APP_CONFIG = {
  name: 'AISLA Care',
  environment: 'development',
  apiBaseUrl: `${backendOrigin}/api`,
  socketUrl: backendOrigin,
} as const;
