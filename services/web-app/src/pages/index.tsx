```typescript
import type { NextPage } from 'next';
import Head from 'next/head';
import { useState, useEffect, useCallback } from 'react';
import RecommendationList from '../components/RecommendationList';

// --- Type Definitions ---

/**
 * Represents a single piece of recommended content.
 * This type should be shared across the frontend and backend services.
 */
export interface Recommendation {
  id: string;
  title: string;
  description: string;
  type: 'article' | 'video' | 'course';
  imageUrl: string;
  url: string;
  score: number; // The relevance score from the recommendation engine
}

/**
 * Represents the structure of an event to be tracked.
 */
interface TrackingEvent {
  type: 'VIEW' | 'CLICK';
  userId: string;
  contentId: string;
  timestamp: string;
}

// --- Constants ---

const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8080';
const MOCK_USERS = ['user-101', 'user-256', 'user-42'];

// --- API Helper Functions ---

/**
 * Sends a tracking event to the backend via the API Gateway.
 * This function is designed to fire and forget, logging errors without blocking UI.
 * @param event - The event data to track, excluding the timestamp which is added internally.
 */
const trackEvent = async (event: Omit<TrackingEvent, 'timestamp'>): Promise<void> => {
  try {
    const response = await fetch(`${API_GATEWAY_URL}/v1/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Use keepalive for requests that might be sent during page unload
      keepalive: true,
      body: JSON.stringify({
        ...event,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      // In a production app, we would log this to an error monitoring service
      // (e.g., Sentry, DataDog) rather than just logging to the console.
      console.error('Failed to track event:', response.statusText, await response.text());
    }
  } catch (error) {
    console.error('Error sending tracking event:', error);
  }
};

/**
 * The main page of the content recommendation platform.
 * It fetches and displays personalized recommendations for the selected user.
 */
const HomePage: NextPage = () => {
  // --- State Management ---
  const [userId, setUserId] = useState<string>(MOCK_USERS[0]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- Data Fetching ---

  /**
   * Fetches content recommendations for the current user from the backend API.
   * Uses useCallback to prevent re-creation on every render unless userId changes.
   */
  const fetchRecommendations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_GATEWAY_URL}/v1/recommendations?userId=${userId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'An unknown server error occurred.' }));
        throw new Error(errorData.message || `Failed to fetch recommendations: ${response.statusText}`);
      }

      const data: { recommendations: Recommendation[] } = await response.json();
      setRecommendations(data.recommendations || []);

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred while fetching data.');
      setRecommendations([]); // Clear previous recommendations on error
    } finally {
      setIsLoading(false);
    }
  }, [userId]); // Dependency array ensures this function is stable if userId doesn't change

  // Effect to fetch data when the component mounts or the userId changes.
  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  // --- Event Handlers ---

  /**
   * Handles user clicks on a recommendation item.
   * It sends a 'CLICK' event to the tracking service.
   * @param contentId - The ID of the content that was clicked.
   */
  const handleRecommendationClick = (contentId: string) => {
    console.log(`User ${userId} clicked on content ${contentId}`);
    trackEvent({ type: 'CLICK', userId, contentId });
    // In a real app, you would also navigate the user to the content URL,
    // for example: window.open(url, '_blank');
  };

  /**
   * Renders the main content area based on the current state (loading, error, or data).
   */
  const renderContent = () => {
    if (isLoading) {
      return <div className="status-indicator loading">Fetching your recommendations...</div>;
    }

    if (error) {
      return <div className="status-indicator error">Error: {error}</div>;
    }

    if (recommendations.length === 0) {
      return <div className="status-indicator empty">No recommendations found for you at this time.</div>;
    }

    return (
      <RecommendationList
        recommendations={recommendations}
        onItemClick={handleRecommendationClick}
      />
    );
  };

  // --- Render ---

  return (
    <div className="container">
      <Head>
        <title>Personalized Recommendations | AI Content Platform</title>
        <meta name="description" content="AI-Powered Content Recommendation System" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="header">
        <h1>AI-Powered Content Recommendations</h1>
        <p>Discover content tailored just for you.</p>
      </header>

      <main className="main-content">
        <div className="user-switcher">
          <h2>Viewing as:</h2>
          <div className="user-buttons">
            {MOCK_USERS.map((user) => (
              <button
                key={user}
                onClick={() => setUserId(user)}
                className={userId === user ? 'active' : ''}
                disabled={isLoading}
              >
                {user}
              </button>
            ))}
          </div>
        </div>

        <section className="recommendations-section">
          <h2>For You</h2>
          {renderContent()}
        </section>
      </main>

      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} AI Content Platform. All rights reserved.</p>
      </footer>

      {/* Basic styling using styled-jsx for component-scoped CSS */}
      <style jsx>{`
        .container {
          min-height: 100vh;
          padding: 0 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          background-color: #f8f9fa;
          color: #343a40;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        .header {
          width: 100%;
          padding: 2rem 0;
          text-align: center;
          border-bottom: 1px solid #dee2e6;
        }
        .header h1 {
          margin: 0;
          line-height: 1.15;
          font-size: 3rem;
        }
        .header p {
          font-size: 1.25rem;
          color: #6c757d;
        }
        .main-content {
          padding: 3rem 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          max-width: 1200px;
        }
        .user-switcher {
          width: 100%;
          padding: 1.5rem;
          margin-bottom: 2rem;
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
          text-align: center;
        }
        .user-switcher h2 {
          margin-top: 0;
          margin-bottom: 1rem;
          font-size: 1.5rem;
        }
        .user-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          justify-content: center;
        }
        .user-buttons button {
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          font-weight: 500;
          border-radius: 5px;
          border: 1px solid #007bff;
          background-color: #ffffff;
          color: #007bff;
          cursor: pointer;
          transition: all 0.2s ease-in-out;
        }
        .user-buttons button:hover:not(:disabled) {
          background-color: #e9ecef;
        }
        .user-buttons button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .user-buttons button.active {
          background-color: #007bff;
          color: #ffffff;
          font-weight: bold;
        }
        .recommendations-section {
          width: 100%;
        }
        .recommendations-section h2 {
          font-size: 2rem;
          margin-bottom: 1.5rem;
          border-bottom: 2px solid #dee2e6;
          padding-bottom: 0.5rem;
        }
        .status-indicator {
          text-align: center;
          font-size: 1.2rem;
          padding: 3rem 1rem;
          border-radius: 8px;
          margin-top: 1rem;
        }
        .status-indicator.loading, .status-indicator.empty {
          color: #6c757d;
          background-color: #e9ecef;
        }
        .status-indicator.error {
          color: #721c24;
          background-color: #f8d7da;
          border: 1px solid #f5c6cb;
        }
        .footer {
          width: 100%;
          padding: 2rem 0;
          border-top: 1px solid #eaeaea;
          display: flex;
          justify-content: center;
          align-items: center;
        }
      `}</style>
    </div>
  );
};

export default HomePage;
```