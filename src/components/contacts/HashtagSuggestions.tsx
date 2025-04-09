import { useEffect } from 'react';
import { useFloating, offset, shift, autoUpdate, flip } from '@floating-ui/react';

interface HashtagSuggestionsProps {
  suggestions: string[];
  onSelect: (hashtag: string) => void;
  referenceElement: HTMLElement | null;
  visible: boolean;
}

export const HashtagSuggestions = ({
  suggestions,
  onSelect,
  referenceElement,
  visible
}: HashtagSuggestionsProps) => {
  const {
    refs,
    floatingStyles,
    update
  } = useFloating({
    placement: 'bottom-start',
    middleware: [
      offset(6), // Add some space between the input and suggestions
      shift(), // Shift to keep in viewport
      flip(), // Flip to opposite side if needed
    ],
    whileElementsMounted: autoUpdate,
    elements: {
      reference: referenceElement
    }
  });

  useEffect(() => {
    if (visible && referenceElement) {
      update();
    }
  }, [visible, referenceElement, update]);

  if (!visible || suggestions.length === 0) return null;

  return (
    <div
      ref={refs.setFloating}
      style={floatingStyles}
      className="z-50 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg dark:shadow-soft-dark border border-gray-200 dark:border-gray-700 max-h-32 overflow-y-auto transition-all duration-200 mobile:max-h-28 min-w-[150px] max-w-[90vw]"
    >
      <ul className="py-1">
        {suggestions.map((hashtag, index) => (
          <li
            key={index}
            className="px-4 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/30 cursor-pointer text-sm text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
            onClick={() => onSelect(hashtag)}
          >
            {hashtag}
          </li>
        ))}
      </ul>
    </div>
  );
};