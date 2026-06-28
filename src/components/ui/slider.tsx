'use client';

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

import { cn } from '@/lib/utils';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    // py-2.5 gives a ~24px clickable band around the 4px track so a click ANYWHERE
    // on the bar jumps the thumb to that position (Radix maps the Root's pointerdown
    // to the value). Without it the only reliable target was the 14px thumb, so the
    // track felt unclickable. cursor-pointer signals the bar is interactive.
    className={cn(
      'relative flex w-full touch-none select-none items-center group cursor-pointer py-2.5',
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="slider-track relative h-1 w-full grow overflow-hidden rounded-full bg-primary/20">
      <SliderPrimitive.Range className="slider-range absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="slider-thumb block h-4 w-4 rounded-full border-2 border-primary bg-background shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:scale-110 hover:shadow-lg active:scale-105" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
