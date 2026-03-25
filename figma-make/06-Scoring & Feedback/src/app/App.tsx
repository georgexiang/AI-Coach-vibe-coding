import { TrendingUp, FileText, Share2, ArrowLeft } from 'lucide-react';
import { CircularProgress } from './components/CircularProgress';
import { PerformanceRadar } from './components/PerformanceRadar';
import { DimensionCard } from './components/DimensionCard';
import { FeedbackSection } from './components/FeedbackSection';

export default function App() {
  const overallScore = 78;
  const previousScore = 73;
  const scoreDiff = overallScore - previousScore;
  const grade = 'B+';

  const dimensions = [
    { name: 'Key Message Delivery', score: 82 },
    { name: 'Objection Handling', score: 71 },
    { name: 'Communication Skills', score: 85 },
    { name: 'Product Knowledge', score: 76 },
    { name: 'Scientific Information', score: 68 },
  ];

  const radarData = [
    { dimension: 'Key Message', current: 82, previous: 78 },
    { dimension: 'Objection\nHandling', current: 71, previous: 65 },
    { dimension: 'Communication', current: 85, previous: 80 },
    { dimension: 'Product\nKnowledge', current: 76, previous: 72 },
    { dimension: 'Scientific\nInfo', current: 68, previous: 63 },
  ];

  const feedbackItems = [
    {
      dimension: 'Key Message Delivery',
      score: 82,
      strengths: ['Effectively used Phase III survival data to address efficacy concerns'],
      improvements: ['Could have reinforced the key message at the end of the conversation'],
      suggestions: ['Always summarize key messages before closing the discussion'],
    },
    {
      dimension: 'Objection Handling',
      score: 71,
      strengths: ['Acknowledged the physician\'s concerns promptly and respectfully'],
      improvements: ['Could have addressed safety profile comparison more proactively'],
      suggestions: ['Prepare 2-3 specific statistics for each key message', 'Practice handling common objections with data-driven responses'],
    },
    {
      dimension: 'Communication Skills',
      score: 85,
      strengths: ['Maintained excellent eye contact and professional demeanor', 'Used appropriate medical terminology'],
      improvements: ['Occasionally spoke too quickly when discussing complex data'],
      suggestions: ['Pause after presenting key data points to allow for processing'],
    },
    {
      dimension: 'Product Knowledge',
      score: 76,
      strengths: ['Demonstrated solid understanding of product mechanism of action'],
      improvements: ['Hesitated when asked about dosing in special populations'],
      suggestions: ['Review special population dosing guidelines thoroughly', 'Create a quick reference card for complex dosing scenarios'],
    },
    {
      dimension: 'Scientific Information',
      score: 68,
      strengths: ['Cited relevant clinical trial data accurately'],
      improvements: ['Could not provide detailed methodology of the pivotal trial when asked'],
      suggestions: ['Study the complete trial methodology sections', 'Prepare lay summaries of complex trial designs'],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Top Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-8">
              <div className="relative">
                <CircularProgress score={overallScore} size={140} strokeWidth={12} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-4xl font-bold text-gray-900">{overallScore}</div>
                  <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mt-1">
                    {grade}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-600">
                  <TrendingUp className="w-5 h-5" />
                  <span className="font-semibold">↑ {scoreDiff} points vs last session</span>
                </div>
                <div className="space-y-1">
                  <h1 className="text-xl font-semibold text-gray-900">
                    F2F Training with Dr. Wang Wei
                  </h1>
                  <p className="text-sm text-gray-600">
                    March 24, 2026 — 15 min
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Radar Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Overview</h2>
              <PerformanceRadar data={radarData} />
            </div>

            {/* Dimension Breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Dimension Breakdown</h2>
              <div className="space-y-3">
                {dimensions.map((dimension, index) => (
                  <DimensionCard key={index} name={dimension.name} score={dimension.score} />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Detailed Feedback</h2>
            <div className="overflow-y-auto max-h-[700px] pr-2">
              <FeedbackSection items={feedbackItems} />
            </div>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Try Again
              </button>
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Export PDF
              </button>
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                <Share2 className="w-4 h-4" />
                Share with Manager
              </button>
            </div>
            <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold">
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}