import React, { useState } from "react";
import { motion } from "framer-motion";
import { ContentItem } from "@/types/omdb";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface RecommendationGridProps {
  recommendations: ContentItem[];
  onSelectItem?: (item: ContentItem) => void;
}

export const RecommendationGrid: React.FC<RecommendationGridProps> = ({
  recommendations,
  onSelectItem,
}) => {
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);

  const handleItemClick = (item: ContentItem) => {
    setSelectedItem(item);
    if (onSelectItem) {
      onSelectItem(item);
    }
  };

  const handleCloseDetails = () => {
    setSelectedItem(null);
  };

  return (
    <div className="font-body">
      {/* Grid of recommendations */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {recommendations &&
          recommendations.map((item) => (
            <motion.div
              key={item.id || item.imdbID}
              className="cursor-pointer rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleItemClick(item)}
            >
              <div className="relative pb-[150%] bg-gray-200 dark:bg-gray-800">
                {item.poster_path ? (
                  <img
                    src={item.poster_path}
                    alt={item.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-300 dark:bg-gray-700">
                    <span className="text-gray-500 dark:text-gray-400 text-sm text-center px-2">
                      No image available
                    </span>
                  </div>
                )}
              </div>
              <div className="p-3 bg-white dark:bg-gray-900">
                <h3 className="text-sm font-medium line-clamp-2 h-10">
                  {item.title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {item.release_date
                    ? new Date(item.release_date).getFullYear()
                    : item.Year || "Unknown year"}
                </p>
              </div>
            </motion.div>
          ))}
      </div>

      {/* Detail view */}
      {selectedItem && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
          onClick={handleCloseDetails}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10"
                onClick={handleCloseDetails}
              >
                <X className="h-5 w-5" />
              </Button>

              <div className="flex flex-col md:flex-row">
                <div className="md:w-1/3 relative pb-[150%] md:pb-0">
                  {selectedItem.poster_path ? (
                    <img
                      src={selectedItem.poster_path}
                      alt={selectedItem.title}
                      className="absolute inset-0 w-full h-full object-cover md:relative"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-300 dark:bg-gray-700 md:relative">
                      <span className="text-gray-500 dark:text-gray-400">
                        No image available
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-6 md:w-2/3">
                  <h2 className="text-2xl font-bold mb-2">
                    {selectedItem.title}
                  </h2>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium">Year:</p>
                      <p className="text-lg">
                        {selectedItem.release_date
                          ? new Date(selectedItem.release_date).getFullYear()
                          : selectedItem.Year || "Unknown"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">contentRating:</p>
                      <p className="text-lg">
                        {selectedItem.contentRating ||
                          selectedItem.content_rating}
                      </p>
                      {/* Debug logging for content rating fields */}
                      {console.log(
                        "[RecommendationGrid] Selected item content rating fields:",
                        {
                          title: selectedItem.title,
                          content_rating: selectedItem.content_rating,
                          contentRating: selectedItem.contentRating,
                          Rated: selectedItem.Rated,
                          hasContentRating: !!selectedItem.content_rating,
                          hasContentRatingField:
                            "content_rating" in selectedItem,
                          hasRatedField: "Rated" in selectedItem,
                          allKeys: Object.keys(selectedItem),
                        },
                      )}
                    </div>
                  </div>

                  {selectedItem.overview || selectedItem.Plot ? (
                    <div className="mb-4">
                      <p className="text-sm font-medium mb-1">Plot:</p>
                      <p className="text-gray-700 dark:text-gray-300">
                        {selectedItem.overview || selectedItem.Plot}
                      </p>
                    </div>
                  ) : null}

                  {selectedItem.recommendationReason && (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm font-medium mb-1">
                        Why it's recommended:
                      </p>
                      <p className="text-gray-700 dark:text-gray-300">
                        {selectedItem.recommendationReason}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default RecommendationGrid;
