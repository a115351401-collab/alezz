/**
 * Vercel Speed Insights initialization
 * 
 * This module initializes Vercel Speed Insights to track web vitals
 * and performance metrics for the website.
 */

import { injectSpeedInsights } from '@vercel/speed-insights';

// Initialize Speed Insights
// The function will automatically inject the tracking script
// and start monitoring web vitals (LCP, FID, CLS, etc.)
injectSpeedInsights({
  // Optional: Set debug mode to see events in console during development
  // debug: process.env.NODE_ENV === 'development',
  
  // Optional: Sample rate (0-1) - defaults to 1 (100%)
  // sampleRate: 1,
  
  // Optional: beforeSend callback to modify or filter events
  // beforeSend: (event) => {
  //   // You can modify or filter events here
  //   return event;
  // }
});
