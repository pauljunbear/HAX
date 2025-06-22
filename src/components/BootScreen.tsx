'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const bootSequence = [
  { text: '[SYSTEM] INITIALIZING SECURE PROTOCOL v2.7.3...', delay: 100 },
  { text: '[AUTH] BIOMETRIC VERIFICATION REQUIRED...', delay: 300 },
  { text: '[AUTH] SCANNING...', delay: 200 },
  { text: '[PASS] IDENTITY CONFIRMED: LEVEL 9 CLEARANCE', delay: 150 },
  { text: '[CRYPTO] ESTABLISHING ENCRYPTED CHANNEL...', delay: 250 },
  { text: '[CRYPTO] AES-256 ENCRYPTION ACTIVE', delay: 150 },
  { text: '[INTEL] LOADING SURVEILLANCE MODULES...', delay: 200 },
  { text: ' > MODULE: PATTERN_RECOGNITION_ENGINE', delay: 100 },
  { text: ' > MODULE: SIGNAL_ANALYSIS_SUITE', delay: 100 },
  { text: ' > MODULE: TACTICAL_ENHANCEMENT_FILTERS', delay: 100 },
  { text: '[INTEL] ALL SYSTEMS OPERATIONAL', delay: 200 },
  { text: '[NET] CONNECTING TO SECURE GRID...', delay: 300 },
  { text: '[NET] UPLINK ESTABLISHED // PING: 12ms', delay: 200 },
  { text: '[READY] ACCESS GRANTED. WELCOME, OPERATOR.', delay: 500 },
];

const BootScreen: React.FC<{ onBootComplete: () => void }> = ({ onBootComplete }) => {
  const [lines, setLines] = useState<{ text: string; id: number }[]>([]);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    let currentDelay = 0;
    bootSequence.forEach((line, index) => {
      currentDelay += line.delay;
      setTimeout(() => {
        setLines(prev => [...prev, { text: line.text, id: index }]);
      }, currentDelay);
    });

    const totalBootTime = currentDelay + 1000;
    setTimeout(() => {
      setShowCursor(false);
      onBootComplete();
    }, totalBootTime);
  }, [onBootComplete]);

  return (
    <motion.div
      className="fixed inset-0 bg-dark-bg text-terminal-green font-mono flex items-center justify-center z-[100]"
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <div className="w-full max-w-3xl p-8">
        {lines.map((line, i) => (
          <motion.p
            key={line.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.1 }}
            className="text-sm"
          >
            {line.text}
          </motion.p>
        ))}
        {showCursor && <span className="w-2 h-4 bg-terminal-green inline-block animate-blink" />}
      </div>
    </motion.div>
  );
};

export default BootScreen;
