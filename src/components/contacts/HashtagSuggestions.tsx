import { useEffect, useRef } from 'react';

interface HashtagSuggestionsProps {
  suggestions: string[];
  onSelect: (hashtag: string) => void;
  position: { top: number; left: number };
  visible: boolean;
}

export const HashtagSuggestions = ({
  suggestions,
  onSelect,
  position,
  visible
}: HashtagSuggestionsProps) => {
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible && suggestionsRef.current) {
      // Ensure suggestions are visible within viewport
      const rect = suggestionsRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      if (rect.bottom > viewportHeight) {
        suggestionsRef.current.style.top = `${position.top - rect.height}px`;
      }
      if (rect.right > viewportWidth) {
        suggestionsRef.current.style.left = `${position.left - rect.width}px`;
      }
    }
  }, [position, visible]);

  if (!visible || suggestions.length === 0) return null;

  return (
    <div
      ref={suggestionsRef}
      className="absolute z-50 bg-white rounded-lg shadow-lg border border-gray-200 max-h-48 overflow-y-auto"
      style={{
        top: position.top,
        left: position.left,
        minWidth: '150px'
      }}
    >
      <ul className="py-1">
        {suggestions.map((hashtag, index) => (
          <li
            key={index}
            className="px-4 py-2 hover:bg-primary-50 cursor-pointer text-sm text-gray-700 hover:text-primary-600"
            onClick={() => onSelect(hashtag)}
          >
            {hashtag}
          </li>
        ))}
      </ul>
    </div>
  );
};