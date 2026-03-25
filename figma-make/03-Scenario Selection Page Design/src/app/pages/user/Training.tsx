import { PlayCircle, Clock, Star } from 'lucide-react';

export default function UserTraining() {
  const scenarios = [
    {
      title: 'Emergency Cardiac Care',
      description: 'Learn to handle cardiac emergencies and perform CPR',
      duration: '45 min',
      difficulty: 'Advanced',
      rating: 4.8,
    },
    {
      title: 'Patient Assessment',
      description: 'Master comprehensive patient assessment techniques',
      duration: '30 min',
      difficulty: 'Intermediate',
      rating: 4.6,
    },
    {
      title: 'Medication Administration',
      description: 'Safe practices for medication administration',
      duration: '25 min',
      difficulty: 'Beginner',
      rating: 4.9,
    },
  ];

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Training Scenarios</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenarios.map((scenario, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-48 bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <PlayCircle className="w-16 h-16 text-white opacity-80" />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">{scenario.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{scenario.description}</p>
                
                <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{scenario.duration}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span>{scenario.rating}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    {scenario.difficulty}
                  </span>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                    Start
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
