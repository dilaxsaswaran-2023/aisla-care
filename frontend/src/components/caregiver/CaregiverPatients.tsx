import { PatientManagement } from "@/components/caregiver/PatientManagement";

interface CaregiverPatientsProps {
  isMobile: boolean;
}

export const CaregiverPatients = ({ isMobile }: CaregiverPatientsProps) => {
  return <PatientManagement isMobile={isMobile} />;
};
