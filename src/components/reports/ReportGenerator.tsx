import React, { useState } from 'react';

/**
 * อาโป: ReportGenerator Component (PSG UI Protocol V3.1)
 */
export const ReportGenerator = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg">
      <div className="flex gap-4">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="h-9 px-6 rounded-full border"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="h-9 px-6 rounded-full border"
        />
      </div>
      <div className="flex gap-4">
        <button className="h-9 px-6 rounded-full bg-cyan-600 text-white">
          Export PDF
        </button>
        <button className="h-9 px-6 rounded-full bg-cyan-600 text-white">
          Export Excel
        </button>
      </div>
    </div>
  );
};
