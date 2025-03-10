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
    if (!visible || !suggestionsRef.current) return;

    const updatePosition = () => {
      if (!suggestionsRef.current) return;

      const rect = suggestionsRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const parentRect = suggestionsRef.current.parentElement?.getBoundingClientRect();

      if (!parentRect) return;

      // Calculate available space in different directions
      const spaceBelow = viewportHeight - (parentRect.top + position.top);
      const spaceAbove = parentRect.top + position.top;
      const spaceRight = viewportWidth - (parentRect.left + position.left);
      
      // Adjust vertical position
      let top = position.top;
      if (rect.height > spaceBelow && spaceAbove > spaceBelow) {
        top = Math.max(position.top - rect.height, 0);
      }

      // Adjust horizontal position
      let left = position.left;
      if (rect.width > spaceRight) {
        left = Math.max(position.left - rect.width, 0);
      }

      // Apply smooth transition
      suggestionsRef.current.style.transition = 'top 0.2s, left 0.2s';
      suggestionsRef.current.style.top = `${top}px`;
      suggestionsRef.current.style.left = `${left}px`;
    };

    // Update position initially and on resize
    updatePosition();
    const handleResize = () => {
      requestAnimationFrame(updatePosition);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position, visible]);

  if (!visible || suggestions.length === 0) return null;

  return (
    <div
      ref={suggestionsRef}
      className="absolute z-50 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 max-h-48 overflow-y-auto transition-all duration-200"
      style={{
        top: position.top,
        left: position.left,
        minWidth: '150px',
        maxWidth: '90vw',
        willChange: 'transform, opacity'
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