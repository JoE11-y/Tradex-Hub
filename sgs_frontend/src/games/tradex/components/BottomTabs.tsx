import { useState, type ReactNode } from 'react';

interface Tab {
  label: string;
  content: ReactNode;
}

interface BottomTabsProps {
  tabs: Tab[];
  defaultTab?: number;
}

export function BottomTabs({ tabs, defaultTab = 0 }: BottomTabsProps) {
  const [activeIdx, setActiveIdx] = useState(defaultTab);

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-slate-700/50 shrink-0">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActiveIdx(i)}
            className={`px-4 py-2 text-xs font-medium transition-colors ${activeIdx === i
                ? 'text-white border-b-2 border-indigo-500'
                : 'text-slate-200 hover:text-slate-300'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {tabs[activeIdx]?.content}
      </div>
    </div>
  );
}
