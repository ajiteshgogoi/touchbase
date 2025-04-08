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
      requestAnimationFrame(() => {
        if (highlighterRef.current && textarea) {
          highlighterRef.current.scrollTop = textarea.scrollTop;
        }
      });
    };

    const handleResize = () => {
      requestAnimationFrame(() => {
        if (highlighterRef.current && textarea) {
          const styles = window.getComputedStyle(textarea);
          highlighterRef.current.style.width = styles.width;
          highlighterRef.current.style.height = styles.height;
          highlighterRef.current.style.fontSize = styles.fontSize;
          highlighterRef.current.style.lineHeight = styles.lineHeight;
        }
      });
    };

    // Create ResizeObserver to watch for textarea size changes
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(textarea);

    // Use passive scroll listener for better performance
    textarea.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial sync
    handleResize();
    handleScroll();
    
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
            return `<span class="text-primary-400 dark:text-primary-500">${match}</span>`;
          }
          return `<span class="text-primary-600 dark:text-primary-400">${match}</span>`;
        }
      );
      highlighterRef.current.innerHTML = styledText;
    }
  }, [text]);

  return (
    <div
      ref={highlighterRef}
      className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words overflow-hidden text-transparent px-[15px] py-[10px] -ml-[0.25px]"
      style={{
        fontSize: textarea ? window.getComputedStyle(textarea).fontSize : '1rem',
        fontFamily: textarea ? window.getComputedStyle(textarea).fontFamily : 'system-ui, -apple-system, sans-serif',
        lineHeight: textarea ? window.getComputedStyle(textarea).lineHeight : '1.5rem',
        width: textarea?.offsetWidth + 'px',
        height: textarea?.offsetHeight + 'px'
      }}
    />
  );
};