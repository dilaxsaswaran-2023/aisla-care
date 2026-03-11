import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PatientMap from "@/components/dashboard/PatientMap";

export const CaregiverLocation = () => {
  return (
    <Card className="care-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Patient Location Tracking</CardTitle>
        <CardDescription>Real-time GPS monitoring</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <PatientMap />
      </CardContent>
    </Card>
  );
};
