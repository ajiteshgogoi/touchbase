import { useCallback, memo, useMemo, useState, useRef } from 'react';
import { VariableSizeList as List } from 'react-window';
import { AlphabetScrollbar } from './AlphabetScrollbar';
import { Contact, ImportantEvent, Interaction } from '../../lib/supabase/types';
import { ContactCard } from './ContactCard';

interface VirtualizedContactListProps {
  contacts: Contact[];
  eventsMap: Record<string, ImportantEvent[]>;
  isPremium: boolean;
  isOnTrial: boolean;
  onDelete: (contactId: string) => Promise<void>;
  onQuickInteraction: (params: { 
    contactId: string; 
    type: Interaction['type']; 
    contactName: string 
  }) => void;
  hasNextPage: boolean;
  loadMore: () => void;
}

type HeaderItem = {
  type: 'header';
  letter: string;
};

type ContactItem = {
  type: 'contact';
  contact: Contact;
};

type SectionData = HeaderItem | ContactItem;

interface RowData {
  items: SectionData[];
  contacts: Contact[];
  eventsMap: Record<string, ImportantEvent[]>;
  isPremium: boolean;
  isOnTrial: boolean;
  onDelete: (contactId: string) => Promise<void>;
  onQuickInteraction: VirtualizedContactListProps['onQuickInteraction'];
  hasNextPage: boolean;
  loadMore: () => void;
}

const Row = memo(({ index, style, data }: {
  index: number;
  style: React.CSSProperties;
  data: RowData;
}) => {
  const item = data.items[index];
  if (!item) return null;

  if (item.type === 'header') {
    return (
      <div style={style} className="sticky top-0 z-10 px-4 py-2 bg-gray-50/80 backdrop-blur-sm">
        <h3 className="text-sm font-medium text-gray-500">
          {item.letter === '#' ? 'Other' : item.letter}
        </h3>
      </div>
    );
  }

  // If we're at the last item and there's more to load, trigger loading more
  if (index === data.items.length - 1 && data.hasNextPage) {
    data.loadMore();
  }

  return (
    <div style={style}>
      <ContactCard
        contact={item.contact}
        eventsMap={data.eventsMap}
        isPremium={data.isPremium}
        isOnTrial={data.isOnTrial}
        onDelete={data.onDelete}
        onQuickInteraction={data.onQuickInteraction}
      />
    </div>
  );
});

Row.displayName = 'ContactRow';

export const VirtualizedContactList = ({
  contacts,
  eventsMap,
  isPremium,
  isOnTrial,
  onDelete,
  onQuickInteraction,
  hasNextPage,
  loadMore
}: VirtualizedContactListProps) => {
  const listRef = useRef<List>(null);
  const [activeSection, setActiveSection] = useState<string>('');

  // Group contacts by first letter
  const { items, sectionIndexMap } = useMemo(() => {
    const sections: SectionData[] = [];
    const indexMap = new Map<string, number>();
    
    // Sort contacts and group by first letter
    const grouped = contacts.reduce((acc, contact) => {
      const letter = contact.name.charAt(0).toUpperCase();
      const section = /[A-Z]/.test(letter) ? letter : '#';
      if (!acc[section]) acc[section] = [];
      acc[section].push(contact);
      return acc;
    }, {} as Record<string, Contact[]>);

    // Create sections with headers and contacts
    Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([letter, sectionContacts]) => {
        indexMap.set(letter, sections.length);
        sections.push({ type: 'header', letter });
        sectionContacts.forEach(contact => {
          sections.push({ type: 'contact', contact });
        });
      });

    return { items: sections, sectionIndexMap: indexMap };
  }, [contacts]);

  const getItemSize = useCallback((index: number) => {
    const item = items[index];
    return item?.type === 'header' ? 40 : 200;
  }, [items]);

  const handleLetterSelect = useCallback((letter: string) => {
    const index = sectionIndexMap.get(letter);
    if (index !== undefined && listRef.current) {
      listRef.current.scrollToItem(index, 'start');
      setActiveSection(letter);
    }
  }, [sectionIndexMap]);

  // Update active section based on scroll position
  const handleScroll = useCallback(({ scrollOffset }: { scrollOffset: number }) => {
    let currentIndex = 0;
    let currentOffset = 0;

    // Find the closest item to the current scroll position
    for (let i = 0; i < items.length; i++) {
      const size = getItemSize(i);
      if (currentOffset > scrollOffset) {
        break;
      }
      currentIndex = i;
      currentOffset += size;
    }

    // Find the previous header
    while (currentIndex >= 0) {
      const item = items[currentIndex];
      if (item?.type === 'header') {
        setActiveSection(item.letter);
        break;
      }
      currentIndex--;
    }
  }, [items, getItemSize]);

  return (
    <div className="relative h-full">
      <List
        ref={listRef}
        height={window.innerHeight - 200} // Adjust based on your layout
        itemCount={items.length}
        itemSize={getItemSize}
        width="100%"
        itemData={{
          items,
          contacts,
          eventsMap,
          isPremium,
          isOnTrial,
          onDelete,
          onQuickInteraction,
          hasNextPage,
          loadMore
        }}
        onScroll={handleScroll}
      >
        {Row}
      </List>
      <AlphabetScrollbar
        onLetterSelect={handleLetterSelect}
        activeSection={activeSection}
      />
    </div>
  );
};