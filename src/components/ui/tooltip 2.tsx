'use client';

import React, { useState } from 'react';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  children, 
  content, 
  position = 'top' 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2',
  };

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      
      {isVisible && (
        <div 
          className={`absolute z-50 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded shadow-sm whitespace-nowrap ${positionClasses[position]}`}
        >
          {content}
          <div 
            className={`absolute ${
              position === 'top' ? 'bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45' :
              position === 'bottom' ? 'top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rotate-45' :
              position === 'left' ? 'right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 rotate-45' :
              'left-0 top-1/2 transform -translate-x-1/2 -translate-y-1/2 rotate-45'
            } w-2 h-2 bg-gray-800`}
          />
        </div>
      )}
    </div>
  );
};

export default Tooltip; 