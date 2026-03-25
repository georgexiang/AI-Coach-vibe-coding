import { useState } from "react";
import SessionFilters from "../components/SessionFilters";
import SessionTable from "../components/SessionTable";

export default function SessionHistory() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-gray-900">Training History</h1>
      
      <SessionFilters searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      
      <SessionTable searchQuery={searchQuery} />
    </div>
  );
}
