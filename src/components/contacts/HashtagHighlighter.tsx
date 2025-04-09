import { useEffect, useRef } from 'react';

interface HashtagHighlighterProps {
  text: string;
  textarea: HTMLTextAreaElement | null;
}

export const HashtagHighlighter = ({ text, textarea }: HashtagHighlighterProps) => {
  const highlighterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!textarea || !highlighterRef.current) return;

    // Update scroll position immediately
    const syncScroll = () => {
      if (highlighterRef.current && textarea) {
        highlighterRef.current.scrollTop = textarea.scrollTop;
      }
    };

    // Handle all scroll events
    const handleScroll = () => {
      syncScroll();
      // Double check after any layout updates
      requestAnimationFrame(syncScroll);
    };

    // Sync on input events too
    textarea.addEventListener('input', syncScroll, { passive: true });

    const handleResize = () => {
      requestAnimationFrame(() => {
        if (highlighterRef.current && textarea) {
          const styles = window.getComputedStyle(textarea);
          
          // Match all basic styles
          highlighterRef.current.style.fontSize = styles.fontSize;
          highlighterRef.current.style.lineHeight = styles.lineHeight;
          highlighterRef.current.style.fontFamily = styles.fontFamily;
          highlighterRef.current.style.letterSpacing = styles.letterSpacing;
          highlighterRef.current.style.wordSpacing = styles.wordSpacing;
          highlighterRef.current.style.paddingTop = styles.paddingTop;
          highlighterRef.current.style.paddingRight = styles.paddingRight;
          highlighterRef.current.style.paddingBottom = styles.paddingBottom;
          highlighterRef.current.style.paddingLeft = styles.paddingLeft;
          highlighterRef.current.style.borderRadius = styles.borderRadius;
          highlighterRef.current.style.borderWidth = styles.borderWidth;
          highlighterRef.current.style.borderStyle = styles.borderStyle;
          highlighterRef.current.style.borderColor = 'transparent';
          highlighterRef.current.style.boxSizing = styles.boxSizing;

          // Handle scrollbar presence
          const hasVerticalScrollbar = textarea.scrollHeight > textarea.clientHeight;
          
          // Set dimensions accounting for scrollbar
          highlighterRef.current.style.width = hasVerticalScrollbar
            ? `${textarea.clientWidth}px`  // Use clientWidth to match textarea's inner width
            : styles.width;
          highlighterRef.current.style.height = styles.height;
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
    // Style the hashtags and sync scroll
    if (highlighterRef.current && textarea) {
      // Sync scroll position after content update
      highlighterRef.current.scrollTop = textarea.scrollTop;
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
      className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words text-transparent rounded-lg overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      style={{
        boxSizing: 'border-box',
        borderColor: 'transparent'
      }}
    />
  );
};