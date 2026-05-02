"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  id?: string;
  value: string;
  options: SearchableSelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  onChange: (value: string) => void;
};

export function SearchableSelect({
  id,
  value,
  options,
  placeholder,
  required = false,
  disabled = false,
  className,
  onChange
}: SearchableSelectProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(() => options.find((option) => option.value === value) ?? null, [options, value]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  useEffect(() => {
    if (selectedOption) {
      setQuery(selectedOption.label);
      return;
    }

    if (!value) {
      setQuery("");
    }
  }, [selectedOption, value]);

  useEffect(() => {
    if (!isOpen) return;
    setHighlightedIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current || containerRef.current.contains(event.target as Node)) return;
      setIsOpen(false);
      if (selectedOption) {
        setQuery(selectedOption.label);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedOption]);

  const handleInputChange = (nextValue: string) => {
    setQuery(nextValue);
    setIsOpen(true);

    if (selectedOption && nextValue !== selectedOption.label) {
      onChange("");
    }
  };

  const handleSelect = (option: SearchableSelectOption) => {
    onChange(option.value);
    setQuery(option.label);
    setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setIsOpen(true);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % Math.max(filteredOptions.length, 1));
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + Math.max(filteredOptions.length, 1)) % Math.max(filteredOptions.length, 1));
    }

    if (event.key === "Enter") {
      if (!isOpen) return;
      event.preventDefault();
      const option = filteredOptions[highlightedIndex];
      if (option) {
        handleSelect(option);
      }
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      if (selectedOption) {
        setQuery(selectedOption.label);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        value={query}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(className)}
        onChange={(event) => handleInputChange(event.target.value)}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {isOpen && !disabled ? (
        <div className="absolute z-20 mt-2 w-full rounded-md border border-border bg-white shadow-lg">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No matches found.</div>
          ) : (
            <div className="max-h-56 overflow-auto py-1">
              {filteredOptions.map((option, index) => (
                <div
                  key={option.value}
                  className={`cursor-pointer px-3 py-2 text-sm transition ${index === highlightedIndex ? "bg-muted" : ""}`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(option)}
                >
                  {option.label}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
