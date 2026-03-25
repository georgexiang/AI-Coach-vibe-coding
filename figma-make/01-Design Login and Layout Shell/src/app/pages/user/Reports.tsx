import { TrendingUp, Award, Target, Clock } from 'lucide-react';

export default function UserReports() {
  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Performance Reports</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">87%</div>
            <div className="text-sm text-gray-600">Average Score</div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                <Award className="w-6 h-6" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">12</div>
            <div className="text-sm text-gray-600">Certifications</div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
                <Target className="w-6 h-6" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">95%</div>
            <div className="text-sm text-gray-600">Completion Rate</div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-100 text-orange-600 rounded-lg">
                <Clock className="w-6 h-6" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">24.5h</div>
            <div className="text-sm text-gray-600">Total Time</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Performance Overview</h2>
          <div className="h-64 flex items-center justify-center text-gray-500">
            Chart placeholder - Performance trends over time
          </div>
        </div>
      </div>
    </div>
  );
}
