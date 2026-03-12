import { FirebaseTestComponent } from "@/components/FirebaseTestComponent";
import PortalLayout from "@/components/layout/PortalLayout";
import { useState } from "react";

const FirebaseTest = () => {
  const [activeTab] = useState("test");

  return (
    <PortalLayout
      title="AISLA"
      subtitle="Firebase Test"
      navItems={[]}
      activeTab={activeTab}
      onTabChange={() => {}}
      pageTitle="Firebase Real-Time Alerts Test"
      pageDescription="Verify Firestore listener receives alerts from backend"
    >
      <div className="max-w-2xl">
        <FirebaseTestComponent />
      </div>
    </PortalLayout>
  );
};

export default FirebaseTest;
