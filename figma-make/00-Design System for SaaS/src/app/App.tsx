import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Settings,
  BarChart3,
  MessageSquare,
  Database,
  FileText,
  BookOpen,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { TopNav } from './components/TopNav';
import { AdminSidebar } from './components/AdminSidebar';
import { ScoreCard } from './components/ScoreCard';
import { HCPProfileCard } from './components/HCPProfileCard';
import { ServiceConfigCard } from './components/ServiceConfigCard';
import { RadarChart } from './components/RadarChart';
import { DimensionBar } from './components/DimensionBar';
import { DataTable } from './components/DataTable';
import { StatusBadge } from './components/StatusBadge';
import { FormField } from './components/FormField';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { AudioControls } from './components/AudioControls';
import { ChatBubble } from './components/ChatBubble';
import { ChatInput } from './components/ChatInput';
import { EmptyState } from './components/EmptyState';
import { LoadingState } from './components/LoadingState';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from './components/ui/breadcrumb';

function App() {
  const [language, setLanguage] = useState<'CN' | 'EN'>('EN');
  const [formValue, setFormValue] = useState('');
  const [sliderValue, setSliderValue] = useState(50);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', active: true },
    { icon: Users, label: 'HCP Profiles', active: false },
    { icon: MessageSquare, label: 'Training Sessions', active: false },
    { icon: BarChart3, label: 'Analytics', active: false },
    { icon: Settings, label: 'Settings', active: false },
  ];

  const radarData = [
    { dimension: 'Product Knowledge', score: 85 },
    { dimension: 'Communication', score: 72 },
    { dimension: 'Objection Handling', score: 68 },
    { dimension: 'Rapport Building', score: 90 },
    { dimension: 'Closing Skills', score: 75 },
  ];

  const tableData = [
    { id: 1, name: 'Dr. Zhang Wei', sessions: 12, avgScore: 85, status: 'Active' },
    { id: 2, name: 'Dr. Li Ming', sessions: 8, avgScore: 72, status: 'Active' },
    { id: 3, name: 'Dr. Wang Fang', sessions: 15, avgScore: 91, status: 'Active' },
    { id: 4, name: 'Dr. Chen Yun', sessions: 5, avgScore: 68, status: 'Pending' },
  ];

  const tableColumns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'sessions', label: 'Sessions', sortable: true },
    { key: 'avgScore', label: 'Avg Score', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => <StatusBadge status={value as any} />,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <TopNav
        navLinks={[
          { label: 'Dashboard', href: '/' },
          { label: 'Training', href: '/training' },
          { label: 'Reports', href: '/reports' },
        ]}
        currentLanguage={language}
        onLanguageChange={setLanguage}
        userName="John Doe"
      />

      <div className="flex">
        {/* Sidebar */}
        <AdminSidebar menuItems={menuItems} />

        {/* Main Content */}
        <div className="flex-1 p-8">
          {/* Breadcrumb */}
          <Breadcrumb className="mb-6">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/components">Design System</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Showcase</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <h1 className="text-3xl font-semibold mb-2">Medical Training Platform Design System</h1>
          <p className="text-muted-foreground mb-8">
            AI Coach for Pharma MR Training - Component Library
          </p>

          <Tabs defaultValue="cards" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="cards">Cards</TabsTrigger>
              <TabsTrigger value="data">Data Display</TabsTrigger>
              <TabsTrigger value="forms">Forms</TabsTrigger>
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="feedback">Feedback</TabsTrigger>
            </TabsList>

            {/* Cards Tab */}
            <TabsContent value="cards" className="space-y-8">
              <section>
                <h2 className="text-xl font-semibold mb-4">Score Cards</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ScoreCard
                    score={85}
                    label="Overall Performance"
                    trend="up"
                    trendValue={12}
                    sparklineData={[65, 70, 68, 75, 80, 85]}
                  />
                  <ScoreCard
                    score={72}
                    label="Communication Skills"
                    trend="down"
                    trendValue={5}
                    sparklineData={[80, 78, 75, 73, 72, 72]}
                  />
                  <ScoreCard
                    score={91}
                    label="Product Knowledge"
                    trend="up"
                    trendValue={8}
                    sparklineData={[75, 80, 83, 86, 89, 91]}
                  />
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">HCP Profile Cards</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <HCPProfileCard
                    name="Dr. Zhang Wei"
                    specialty="Cardiology"
                    hospital="Beijing Union Medical Hospital"
                    personalityTags={['Analytical', 'Detail-oriented', 'Evidence-based']}
                    difficulty="Hard"
                  />
                  <HCPProfileCard
                    name="Dr. Li Ming"
                    specialty="Endocrinology"
                    hospital="Shanghai First People's Hospital"
                    personalityTags={['Friendly', 'Open-minded', 'Patient-focused']}
                    difficulty="Easy"
                  />
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">Service Configuration Cards</h2>
                <div className="space-y-4 max-w-2xl">
                  <ServiceConfigCard
                    icon={Database}
                    name="AI Speech Recognition"
                    status="active"
                    description="Real-time speech-to-text processing"
                  >
                    <div className="pt-4 space-y-4">
                      <FormField
                        label="API Endpoint"
                        value="https://api.example.com/speech"
                        placeholder="Enter API endpoint"
                      />
                      <FormField
                        label="Confidence Threshold"
                        type="slider"
                        value={sliderValue}
                        onChange={setSliderValue}
                        min={0}
                        max={100}
                      />
                    </div>
                  </ServiceConfigCard>
                  <ServiceConfigCard
                    icon={FileText}
                    name="Content Management"
                    status="inactive"
                    description="Training materials and resources"
                  />
                </div>
              </section>
            </TabsContent>

            {/* Data Display Tab */}
            <TabsContent value="data" className="space-y-8">
              <section>
                <h2 className="text-xl font-semibold mb-4">Radar Chart</h2>
                <div className="max-w-2xl bg-white p-6 rounded-lg border">
                  <RadarChart data={radarData} />
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">Dimension Bars</h2>
                <div className="max-w-2xl space-y-4">
                  <DimensionBar label="Product Knowledge" score={85} color="strength" />
                  <DimensionBar label="Communication Skills" score={72} color="weakness" />
                  <DimensionBar label="Objection Handling" score={68} color="weakness" />
                  <DimensionBar label="Rapport Building" score={90} color="strength" />
                  <DimensionBar label="Area for Improvement" score={65} color="improvement" />
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">Data Table</h2>
                <DataTable columns={tableColumns} data={tableData} pageSize={5} />
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">Status Badges</h2>
                <div className="flex flex-wrap gap-3">
                  <StatusBadge status="Active" />
                  <StatusBadge status="Draft" />
                  <StatusBadge status="Error" />
                  <StatusBadge status="Pending" />
                </div>
              </section>
            </TabsContent>

            {/* Forms Tab */}
            <TabsContent value="forms" className="space-y-8">
              <section>
                <h2 className="text-xl font-semibold mb-4">Form Fields</h2>
                <div className="max-w-2xl space-y-6">
                  <FormField
                    label="Training Session Name"
                    value={formValue}
                    onChange={setFormValue}
                    placeholder="Enter session name"
                    required
                  />
                  <FormField
                    label="HCP Specialty"
                    type="select"
                    options={[
                      { value: 'cardiology', label: 'Cardiology' },
                      { value: 'endocrinology', label: 'Endocrinology' },
                      { value: 'oncology', label: 'Oncology' },
                    ]}
                    placeholder="Select specialty"
                  />
                  <FormField
                    label="Difficulty Level"
                    type="slider"
                    value={sliderValue}
                    onChange={setSliderValue}
                    min={0}
                    max={100}
                  />
                  <FormField
                    label="Notes"
                    type="textarea"
                    placeholder="Enter your notes here..."
                  />
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">Language Switcher</h2>
                <LanguageSwitcher currentLanguage={language} onChange={setLanguage} />
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">Audio Controls</h2>
                <AudioControls />
              </section>
            </TabsContent>

            {/* Chat Tab */}
            <TabsContent value="chat" className="space-y-8">
              <section>
                <h2 className="text-xl font-semibold mb-4">Chat Interface</h2>
                <div className="max-w-3xl bg-white border rounded-lg p-6">
                  <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                    <ChatBubble
                      variant="left"
                      name="Dr. Zhang Wei"
                      message="Good morning. What brings you here today?"
                      timestamp="10:23 AM"
                    />
                    <ChatBubble
                      variant="right"
                      message="Good morning Doctor. I'd like to discuss our new cardiovascular medication that could benefit your patients."
                      timestamp="10:24 AM"
                    />
                    <ChatBubble
                      variant="left"
                      name="Dr. Zhang Wei"
                      message="I'm very busy. Can you tell me quickly why this is better than what I'm currently prescribing?"
                      timestamp="10:24 AM"
                    />
                    <ChatBubble
                      variant="right"
                      message="Of course. Our clinical trials show a 30% improvement in patient outcomes with fewer side effects. May I share the data with you?"
                      timestamp="10:25 AM"
                    />
                  </div>
                  <ChatInput
                    placeholder="Type your response..."
                    onSend={(msg) => console.log('Sent:', msg)}
                  />
                </div>
              </section>
            </TabsContent>

            {/* Feedback Tab */}
            <TabsContent value="feedback" className="space-y-8">
              <section>
                <h2 className="text-xl font-semibold mb-4">Empty State</h2>
                <div className="border rounded-lg bg-white">
                  <EmptyState
                    icon={BookOpen}
                    title="No Training Sessions Yet"
                    message="Get started by creating your first training session with an AI-powered HCP simulation."
                    actionLabel="Create Session"
                    onAction={() => alert('Create session clicked')}
                  />
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">Loading States</h2>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Card Loading</h3>
                    <LoadingState variant="card" count={2} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Table Loading</h3>
                    <LoadingState variant="table" count={3} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-3">List Loading</h3>
                    <LoadingState variant="list" count={4} />
                  </div>
                </div>
              </section>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default App;
