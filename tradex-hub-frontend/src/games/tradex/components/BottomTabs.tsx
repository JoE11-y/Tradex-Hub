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
      <div className="flex gap-2 px-2 pt-2 border-b border-slate-700/50 shrink-0">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActiveIdx(i)}
            className={`px-4 py-1.5 text-xs font-medium rounded transition-colors ${activeIdx === i
                ? 'text-white bg-slate-800 border border-indigo-500/50'
                : 'text-slate-200 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
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
