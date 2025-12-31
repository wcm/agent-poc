import React, { useState, useEffect, useRef } from 'react';
import { ChevronsUpDown, Plus } from 'lucide-react';

interface BrandSelectorProps {
  activeBrand: string;
  onBrandChange: (brand: string) => void;
  isCollapsed: boolean;
}

const BrandSelector: React.FC<BrandSelectorProps> = ({ activeBrand, onBrandChange, isCollapsed }) => {
  const [isOpen, setIsOpen] = useState(false);
  const brands = ["Starbucks"];
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`brand-selector-container ${isCollapsed ? 'collapsed' : ''}`} ref={containerRef}>
      <div 
        className="brand-selector-header" 
        onClick={() => setIsOpen(!isOpen)}
        title={isCollapsed ? activeBrand : undefined}
      >
        <div className="brand-logo-placeholder"></div>
        {!isCollapsed && (
          <>
            <span className="brand-name">{activeBrand}</span>
            <ChevronsUpDown size={16} className="brand-chevron" />
          </>
        )}
      </div>
      
      {isOpen && (
        <div className="brand-dropdown-overlay">
          {brands.map((brand) => (
            <div 
              key={brand} 
              className={`brand-item ${brand === activeBrand ? 'active' : ''}`}
              onClick={() => {
                onBrandChange(brand);
                setIsOpen(false);
              }}
            >
              <div className="brand-logo-small"></div>
              <span>{brand}</span>
            </div>
          ))}
          <div className="brand-item new-brand">
            <Plus size={14} />
            <span>New brand</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrandSelector;
