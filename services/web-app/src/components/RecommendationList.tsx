```typescript
import React from 'react';
import useSWR from 'swr';
import Image from 'next/image';

// --- Type Definitions ---

/**
 * Represents a single content recommendation item.
 * This structure should align with the data returned by the recommendation-engine service.
 */
export interface Recommendation {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  url: string;
  type: 'article' | 'video' | 'course'; // Example content types
  source: string; // e.g., 'TechCrunch', 'YouTube', 'Coursera'
  score: number; // Relevance score from the ML model, can be used for sorting or display
}

/**
 * Props for the RecommendationList component.
 */
export interface RecommendationListProps {
  /**
   * The unique identifier for the user to fetch personalized recommendations.
   */
  userId: string;
}

// --- Helper Components ---

/**
 * A skeleton loader component to display while recommendations are being fetched.
 * This provides a better user experience by showing a placeholder of the content layout.
 */
const SkeletonCard: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden animate-pulse">
    <div className="w-full h-48 bg-gray-300 dark:bg-gray-700"></div>
    <div className="p-4">
      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
      <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
      <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-full mb-2"></div>
      <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
    </div>
  </div>
);

/**
 * A component to display a single recommendation item in a card format.
 * @param {object} props - The component props.
 * @param {Recommendation} props.item - The recommendation item to display.
 */
const RecommendationCard: React.FC<{ item: Recommendation }> = ({ item }) => (
  <a
    href={item.url}
    target="_blank"
    rel="noopener noreferrer"
    className="block bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 ease-in-out group"
    // In a real app, you would add an onClick handler here to send an event to the event-tracker service
    // onClick={() => trackClick(item.id, userId)}
  >
    <div className="relative w-full h-48">
      <Image
        src={item.imageUrl}
        alt={item.title}
        layout="fill"
        objectFit="cover"
        className="group-hover:scale-105 transition-transform duration-300"
      />
      <span className="absolute top-2 right-2 bg-blue-500 text-white text-xs font-semibold px-2 py-1 rounded-full capitalize">
        {item.type}
      </span>
    </div>
    <div className="p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{item.source}</p>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {item.title}
      </h3>
      <p className="text-gray-700 dark:text-gray-300 text-sm line-clamp-3">
        {item.description}
      </p>
    </div>
  </a>
);

// --- Main Component ---

/**
 * Fetches and displays a list of personalized content recommendations for a given user.
 * It handles loading, error, and empty states gracefully using the SWR hook.
 *
 * @param {RecommendationListProps} props - The component props.
 * @returns {JSX.Element} The rendered RecommendationList component.
 */
const RecommendationList: React.FC<RecommendationListProps> = ({ userId }) => {
  // A simple fetcher function for SWR. In a larger app, this would be centralized in an API client.
  const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
      const error = new Error('An error occurred while fetching the data.');
      // Attach extra info to the error object.
      error.message = (await res.json()).message || 'Failed to fetch recommendations.';
      throw error;
    }
    return res.json();
  };

  // Use SWR for data fetching, caching, and revalidation.
  // The API endpoint is assumed to be handled by the Next.js backend or an API gateway.
  const { data: recommendations, error, isLoading } = useSWR<Recommendation[]>(
    userId ? `/api/recommendations?userId=${userId}` : null, // Don't fetch if userId is not available
    fetcher
  );

  /**
   * Renders the content based on the current state of the data fetching.
   */
  const renderContent = () => {
    if (error) {
      return (
        <div className="text-center py-10 px-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-red-600 dark:text-red-400 font-semibold">
            Oops! Something went wrong.
          </p>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {error.message || 'We couldn\'t load your recommendations. Please try again later.'}
          </p>
        </div>
      );
    }

    if (isLoading) {
      // Display a grid of skeleton loaders during the initial load.
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      );
    }

    if (!recommendations || recommendations.length === 0) {
      return (
        <div className="text-center py-10 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-gray-800 dark:text-gray-200 font-semibold">
            No Recommendations Yet
          </p>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Keep interacting with our content, and we'll find some great recommendations for you!
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {recommendations.map((item) => (
          <RecommendationCard key={item.id} item={item} />
        ))}
      </div>
    );
  };

  return (
    <section className="py-8 sm:py-12">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Recommended for You
        </h2>
        {renderContent()}
      </div>
    </section>
  );
};

export default RecommendationList;
```