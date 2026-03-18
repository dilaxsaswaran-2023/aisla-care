import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import CameraFeed from '@/components/devices/CameraFeed';
import PatientMap from '@/components/dashboard/PatientMap';

const LiveMonitoring = () => {
  return (
    <div className="space-y-6">
      <Card className="care-card overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-gradient-to-r from-background via-primary/5 to-background pb-3">
          <CardTitle className="text-base">Live Camera Monitoring</CardTitle>
          <CardDescription>Real-time feeds with people detection</CardDescription>
        </CardHeader>
        <CardContent>
          <CameraFeed />
        </CardContent>
      </Card>
      <Card className="care-card overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-gradient-to-r from-background via-primary/5 to-background pb-3">
          <CardTitle className="text-base">GPS Location Tracking</CardTitle>
          <CardDescription>Real-time patient location monitoring</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <PatientMap />
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveMonitoring;
