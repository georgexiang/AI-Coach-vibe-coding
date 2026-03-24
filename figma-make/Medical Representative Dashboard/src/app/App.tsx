import { CheckCircle2, Calendar, TrendingUp, MessageSquare, Presentation } from "lucide-react";
import { TopNav } from "./components/TopNav";
import { StatCard } from "./components/StatCard";
import { SessionItem } from "./components/SessionItem";
import { ActionCard } from "./components/ActionCard";
import { RecommendedScenario } from "./components/RecommendedScenario";
import { MiniRadarChart, MiniTrendChart } from "./components/MiniCharts";

const mockSessions = [
  {
    id: 1,
    hcpName: "Dr. Sarah Mitchell",
    specialty: "Cardiology",
    mode: "F2F" as const,
    score: 85,
    timeAgo: "2 hours ago",
    avatar: "https://images.unsplash.com/photo-1632053652571-a6a45052bbbd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmZW1hbGUlMjBkb2N0b3IlMjBwcm9mZXNzaW9uYWx8ZW58MXx8fHwxNzc0MzE1Nzc4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  },
  {
    id: 2,
    hcpName: "Dr. James Wong",
    specialty: "Oncology",
    mode: "Conference" as const,
    score: 72,
    timeAgo: "5 hours ago",
    avatar: "https://images.unsplash.com/photo-1632054226038-ed6997bfce1f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMGRvY3RvciUyMHByb2Zlc3Npb25hbHxlbnwxfHx8fDE3NzQyNTE3NjJ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  },
  {
    id: 3,
    hcpName: "Dr. Michael Chen",
    specialty: "Neurology",
    mode: "F2F" as const,
    score: 92,
    timeAgo: "1 day ago",
    avatar: "https://images.unsplash.com/photo-1762237798212-bcc000c00891?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYWxlJTIwcGh5c2ljaWFuJTIwaGVhZHNob3R8ZW58MXx8fHwxNzc0MzAwMDkyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  },
  {
    id: 4,
    hcpName: "Dr. Emily Roberts",
    specialty: "Endocrinology",
    mode: "Conference" as const,
    score: 55,
    timeAgo: "2 days ago",
    avatar: "https://images.unsplash.com/photo-1755189118414-14c8dacdb082?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBkb2N0b3IlMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzQzMjE4OTZ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  },
  {
    id: 5,
    hcpName: "Dr. Robert Thompson",
    specialty: "Rheumatology",
    mode: "F2F" as const,
    score: 88,
    timeAgo: "3 days ago",
    avatar: "https://images.unsplash.com/photo-1758691461516-7e716e0ca135?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzZW5pb3IlMjBwaHlzaWNpYW4lMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzQzMjE4OTd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  },
];

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      
      <main className="max-w-[1440px] mx-auto px-6 py-8">
        {/* Row 1: Stats Cards */}
        <div className="grid grid-cols-4 gap-6 mb-6">
          <StatCard
            label="Sessions Completed"
            value={24}
            icon={CheckCircle2}
            color="green"
            trend={{ value: "+3 this week", direction: "up" }}
          />
          
          <StatCard
            label="Average Score"
            value={78}
            color="blue"
            chart={<MiniRadarChart />}
          />
          
          <StatCard
            label="This Week"
            value={5}
            icon={Calendar}
            color="blue"
            progress={{ current: 5, total: 7 }}
          />
          
          <StatCard
            label="Improvement"
            value="+12%"
            icon={TrendingUp}
            color="green"
            chart={<MiniTrendChart />}
          />
        </div>

        {/* Row 2: Recent Sessions + Quick Actions */}
        <div className="grid grid-cols-5 gap-6">
          {/* Left Column: Recent Sessions (3/5 = 60%) */}
          <div className="col-span-3 bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Recent Training Sessions</h2>
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                View All
              </button>
            </div>
            
            <div className="space-y-2">
              {mockSessions.map((session) => (
                <SessionItem key={session.id} {...session} />
              ))}
            </div>
          </div>

          {/* Right Column: Quick Actions (2/5 = 40%) */}
          <div className="col-span-2 space-y-6">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Start Training</h2>
              
              <div className="space-y-4">
                <ActionCard
                  title="F2F HCP Training"
                  description="Practice 1-on-1 with digital HCP"
                  icon={MessageSquare}
                  gradient="blue"
                  onStart={() => console.log("Start F2F training")}
                />
                
                <ActionCard
                  title="Conference Training"
                  description="Practice department presentation"
                  icon={Presentation}
                  gradient="purple"
                  onStart={() => console.log("Start Conference training")}
                />
              </div>
            </div>

            <RecommendedScenario
              hcpName="Dr. Amanda Hayes"
              difficulty="Intermediate"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
