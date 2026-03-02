import React, { Component, ReactNode } from 'react'
import styles from './ErrorBoundary.module.css'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary component to catch and display React errors gracefully
 * Prevents the entire app from crashing when a component throws an error
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    // In production, you might want to log to an error tracking service
    // e.g., Sentry, LogRocket, etc.
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className={styles.container}>
          <div className={styles.card}>
            <h1 className={styles.title}>Something went wrong</h1>
            <p className={styles.message}>
              We apologize for the inconvenience. An unexpected error has occurred.
            </p>
            {this.state.error && (
              <details className={styles.details}>
                <summary className={styles.summary}>Error details</summary>
                <pre className={styles.error}>{this.state.error.toString()}</pre>
                {this.state.error.stack && (
                  <pre className={styles.stack}>{this.state.error.stack}</pre>
                )}
              </details>
            )}
            <div className={styles.actions}>
              <button onClick={this.handleReset} className={styles.button}>
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className={styles.buttonSecondary}
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
