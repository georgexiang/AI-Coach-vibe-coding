export default function UserHistory() {
  const history = [
    {
      scenario: 'Cardiac Emergency Scenario',
      completedAt: 'March 24, 2026',
      duration: '42 min',
      score: 92,
      status: 'Passed',
    },
    {
      scenario: 'Medication Administration',
      completedAt: 'March 21, 2026',
      duration: '28 min',
      score: 88,
      status: 'Passed',
    },
    {
      scenario: 'Patient Assessment Module',
      completedAt: 'March 18, 2026',
      duration: '35 min',
      score: 76,
      status: 'Passed',
    },
  ];

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Training History</h1>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Scenario
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Completed
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {history.map((record, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{record.scenario}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {record.completedAt}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {record.duration}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-lg font-bold text-gray-900">{record.score}%</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
