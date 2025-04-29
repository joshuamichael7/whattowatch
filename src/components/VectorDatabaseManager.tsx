import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VectorDatabaseImporter from "@/components/VectorDatabaseImporter";
import VectorSearchTester from "@/components/VectorSearchTester";
import { useAuth } from "@/contexts/AuthContext";

const VectorDatabaseManager: React.FC = () => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("import");

  if (!isAdmin) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Admin Access Required</h2>
        <p>You need admin privileges to access this feature.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Vector Database Manager</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="import">Import Content</TabsTrigger>
          <TabsTrigger value="search">Test Search</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="mt-6">
          <VectorDatabaseImporter />
        </TabsContent>

        <TabsContent value="search" className="mt-6">
          <VectorSearchTester />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VectorDatabaseManager;
