import React, { useCallback, useState } from 'react';

interface AlphabetScrollbarProps {
  onLetterSelect: (letter: string) => void;
  activeSection?: string;
}

const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const AlphabetScrollbar: React.FC<AlphabetScrollbarProps> = ({
  onLetterSelect,
  activeSection
}) => {
  const [isActive, setIsActive] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  const handleTouchStart = useCallback((letter: string) => {
    setIsActive(true);
    setSelectedLetter(letter);
    onLetterSelect(letter);
  }, [onLetterSelect]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isActive) return;

    const touch = e.touches[0];
    if (!touch) return;
    
    const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
    const letterElement = elements.find(el => el.getAttribute('data-letter'));
    
    if (letterElement) {
      const letter = letterElement.getAttribute('data-letter') as string;
      if (letter !== selectedLetter) {
        setSelectedLetter(letter);
        onLetterSelect(letter);
      }
    }
  }, [isActive, selectedLetter, onLetterSelect]);

  const handleTouchEnd = useCallback(() => {
    setIsActive(false);
    setSelectedLetter(null);
  }, []);

  return (
    <div
      className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col justify-center z-50 h-full max-h-full"
      style={{ maxHeight: 'calc(100vh - 200px)' }}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {isActive && selectedLetter && (
        <div className="absolute right-8 top-1/2 -translate-y-1/2 w-20 h-20 flex items-center justify-center bg-gray-800/90 rounded-2xl backdrop-blur-lg">
          <span className="text-4xl font-semibold text-white">{selectedLetter}</span>
        </div>
      )}
      <div className="flex flex-col gap-[1px] py-1">
        {ALPHABET.map((letter) => (
          <button
            key={letter}
            data-letter={letter}
            onTouchStart={() => handleTouchStart(letter)}
            onClick={() => onLetterSelect(letter)}
            className={`w-6 h-4 flex items-center justify-center rounded-sm text-xs font-medium cursor-pointer
              ${activeSection === letter
                ? 'text-primary-600 scale-110'
                : 'text-gray-500 hover:text-primary-600'}
              ${isActive ? 'touch-none' : 'touch-pan-y'}
              transition-transform duration-150`}
          >
            {letter}
          </button>
        ))}
      </div>
    </div>
  );
};