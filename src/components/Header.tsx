'use client';

import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-blue-600 text-white p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold">Imager</h1>
        <div className="flex items-center space-x-4">
          <span className="text-sm">Real-time Image Effects</span>
        </div>
      </div>
    </header>
  );
};

export default Header; 