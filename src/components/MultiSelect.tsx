import React, { useState, useMemo } from "react";
import { Search, X, Check, CheckSquare, Square } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  id?: string;
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

export default function MultiSelect({
  id = "multi-select",
  options,
  selected,
  onChange,
  placeholder = "Search and select options...",
}: MultiSelectProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  const handleToggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((item) => item !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const handleSelectAll = () => {
    // Select all currently visible filtered options
    const filteredVals = filteredOptions.map((o) => o.value);
    const newSelected = Array.from(new Set([...selected, ...filteredVals]));
    onChange(newSelected);
  };

  const handleClearAll = () => {
    // Clear all selected options
    onChange([]);
  };

  return (
    <div id={id} className="relative w-full space-y-2 text-zinc-200 text-xs font-sans">
      {/* Selected tags list */}
      <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950/60 border border-zinc-850 rounded-xl min-h-11">
        {selected.length === 0 ? (
          <span className="text-zinc-500 italic py-1 px-2">No selections yet. Click dropdown to select.</span>
        ) : (
          selected.map((val) => {
            const opt = options.find((o) => o.value === val);
            return (
              <span
                key={val}
                className="flex items-center space-x-1.5 px-2.5 py-1 bg-red-500/15 border border-red-500/25 text-red-400 rounded-lg text-[11px] font-semibold"
              >
                <span>{opt ? opt.label : val}</span>
                <button
                  type="button"
                  onClick={() => onChange(selected.filter((x) => x !== val))}
                  className="hover:text-red-300 text-red-500 focus:outline-hidden cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })
        )}
      </div>

      {/* Trigger & Search Input panel */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
            <Search className="w-3.5 h-3.5" />
          </span>
          <input
            type="text"
            placeholder={placeholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="w-full bg-slate-950/80 border border-zinc-850 rounded-xl py-2 pl-9 pr-4 text-xs text-zinc-200 focus:outline-hidden focus:border-red-500/50"
          />
        </div>

        {/* Action controls */}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleSelectAll}
            className="px-2.5 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 font-bold uppercase text-[9px] rounded-lg cursor-pointer transition-all active:scale-95 whitespace-nowrap"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="px-2.5 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 font-bold uppercase text-[9px] rounded-lg cursor-pointer transition-all active:scale-95 whitespace-nowrap"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Dropdown Options list */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-zinc-950 border border-zinc-850 rounded-xl max-h-48 overflow-y-auto shadow-2xl p-1 divide-y divide-zinc-900">
          <div className="flex justify-between items-center px-2 py-1 text-[10px] text-zinc-500 font-mono">
            <span>Filtered ({filteredOptions.length})</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="hover:text-zinc-300 font-bold"
            >
              Close ✕
            </button>
          </div>
          {filteredOptions.length === 0 ? (
            <p className="p-3 text-center text-zinc-500 italic">No matching results found</p>
          ) : (
            filteredOptions.map((opt) => {
              const isSelected = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleToggle(opt.value)}
                  className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-zinc-900 transition-colors cursor-pointer"
                >
                  <span className={`font-medium ${isSelected ? "text-red-400 font-bold" : "text-zinc-300"}`}>
                    {opt.label}
                  </span>
                  {isSelected ? (
                    <Check className="w-4 h-4 text-red-400" />
                  ) : (
                    <div className="w-4 h-4 rounded-sm border border-zinc-800 bg-slate-950" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
