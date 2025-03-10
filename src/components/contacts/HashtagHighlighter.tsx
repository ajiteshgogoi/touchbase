import { useEffect, useRef } from 'react';

interface HashtagHighlighterProps {
  text: string;
  textarea: HTMLTextAreaElement | null;
}

export const HashtagHighlighter = ({ text, textarea }: HashtagHighlighterProps) => {
  const highlighterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!textarea || !highlighterRef.current) return;

    // Update scroll position and dimensions when textarea scrolls or resizes
    const handleScroll = () => {
      if (highlighterRef.current && textarea) {
        highlighterRef.current.scrollTop = textarea.scrollTop;
      }
    };

    const handleResize = () => {
      if (highlighterRef.current && textarea) {
        highlighterRef.current.style.width = `${textarea.offsetWidth}px`;
        highlighterRef.current.style.height = `${textarea.offsetHeight}px`;
      }
    };

    // Create ResizeObserver to watch for textarea size changes
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(textarea);

    textarea.addEventListener('scroll', handleScroll);
    
    return () => {
      textarea.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [textarea]);

  useEffect(() => {
    // Style the hashtags
    if (highlighterRef.current) {
      const styledText = text.replace(
        /#[a-zA-Z]\w{0,13}(?=[^\w]|$)/g,
        match => {
          if (match.length >= 2 && match.length <= 15) {
            return `<span class="text-primary-400">${match}</span>`;
          }
          return `<span class="text-primary-600">${match}</span>`;
        }
      );
      highlighterRef.current.innerHTML = styledText;
    }
  }, [text]);

  return (
    <div
      ref={highlighterRef}
      className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words text-transparent bg-transparent px-4 py-2.5 z-10"
      style={{
        fontSize: '1rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        lineHeight: '1.5rem',
        width: textarea?.offsetWidth + 'px',
        height: textarea?.offsetHeight + 'px'
      }}
    />
  );
};