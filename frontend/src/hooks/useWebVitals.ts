import { onCLS, onINP, onFCP, onLCP, onTTFB } from 'web-vitals'

/**
 * Hook to monitor Web Vitals performance metrics
 * Sends metrics to console in development and could be extended to send to analytics
 */
export function useWebVitals() {
  const sendToAnalytics = (metric: any) => {
    // In development, log to console
    if (import.meta.env.DEV) {
      console.log(`[Web Vitals] ${metric.name}:`, metric.value, metric)
    }
    
    // In production, you could send to your analytics service
    // Example: sendToAnalyticsService(metric)
  }

  const reportWebVitals = () => {
    onCLS(sendToAnalytics)
    onINP(sendToAnalytics)
    onFCP(sendToAnalytics)
    onLCP(sendToAnalytics)
    onTTFB(sendToAnalytics)
  }

  return { reportWebVitals }
}
