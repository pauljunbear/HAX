'use client'

import { useState } from 'react'
import { MagneticSlider } from '@/components/MagneticSlider'

export default function TestPage() {
  const [value1, setValue1] = useState(50)
  const [value2, setValue2] = useState(25)
  const [value3, setValue3] = useState(0)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-2xl font-bold mb-8">Magnetic Slider Test Page</h1>
      
      <div className="max-w-xl space-y-8">
        {/* Default slider */}
        <div className="space-y-4">
          <h2 className="text-xl">Default Slider</h2>
          <p className="text-gray-400">Default snap points at 0, 25, 50, 75, 100</p>
          <MagneticSlider
            value={value1}
            onChange={setValue1}
            label="Default Slider"
          />
          <p className="text-sm text-gray-400">Current value: {value1}</p>
        </div>

        {/* Custom snap points */}
        <div className="space-y-4">
          <h2 className="text-xl">Custom Snap Points</h2>
          <p className="text-gray-400">Snap points at 0, 20, 40, 60, 80, 100</p>
          <MagneticSlider
            value={value2}
            onChange={setValue2}
            label="Custom Snap Points"
            snapPoints={[0, 20, 40, 60, 80, 100]}
            snapThreshold={8}
          />
          <p className="text-sm text-gray-400">Current value: {value2}</p>
        </div>

        {/* Disabled slider */}
        <div className="space-y-4">
          <h2 className="text-xl">Disabled Slider</h2>
          <p className="text-gray-400">This slider is disabled and cannot be interacted with</p>
          <MagneticSlider
            value={value3}
            onChange={setValue3}
            label="Disabled Slider"
            disabled
          />
          <p className="text-sm text-gray-400">Current value: {value3}</p>
        </div>

        <div className="mt-8 p-4 bg-gray-800 rounded-lg">
          <h2 className="text-xl mb-4">Testing Instructions</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>Drag the sliders to feel the magnetic snap points</li>
            <li>Notice the haptic feedback when crossing snap points (on supported devices)</li>
            <li>Try keyboard navigation with Tab and Arrow keys</li>
            <li>Test touch interaction on mobile devices</li>
            <li>Verify that the disabled slider cannot be interacted with</li>
          </ul>
        </div>
      </div>
    </div>
  )
} 