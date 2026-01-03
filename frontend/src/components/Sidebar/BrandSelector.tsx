import React, { useState, useEffect, useRef } from 'react';
import { ChevronsUpDown, Plus } from 'lucide-react';

interface OwnBrand {
  id: string;
  name: string;
  logo: string;
}

interface BrandSelectorProps {
  activeBrand: string;
  onBrandChange: (brand: string) => void;
  isCollapsed: boolean;
}

const BrandSelector: React.FC<BrandSelectorProps> = ({ activeBrand, onBrandChange, isCollapsed }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [ownBrands, setOwnBrands] = useState<OwnBrand[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const baseUrl = window.location.hostname === "localhost" ? "http://localhost:3001" : "";

  useEffect(() => {
    const fetchOwnBrands = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/own-brands`);
        if (res.ok) {
          const data = await res.json();
          setOwnBrands(data);
        }
      } catch (err) {
        console.error('Failed to fetch own brands:', err);
      }
    };
    fetchOwnBrands();
  }, [baseUrl]);

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

  const activeBrandData = ownBrands.find(b => b.name === activeBrand);

  return (
    <div className={`brand-selector-container ${isCollapsed ? 'collapsed' : ''}`} ref={containerRef}>
      <div 
        className="brand-selector-header" 
        onClick={() => setIsOpen(!isOpen)}
        title={isCollapsed ? activeBrand : undefined}
      >
        {activeBrandData?.logo ? (
          <img src={activeBrandData.logo} alt={activeBrand} className="brand-logo-img" />
        ) : (
          <div className="brand-logo-placeholder"></div>
        )}
        {!isCollapsed && (
          <>
            <span className="brand-name">{activeBrand}</span>
            <ChevronsUpDown size={16} className="brand-chevron" />
          </>
        )}
      </div>
      
      {isOpen && (
        <div className="brand-dropdown-overlay">
          {ownBrands.map((brand) => (
            <div 
              key={brand.id} 
              className={`brand-item ${brand.name === activeBrand ? 'active' : ''}`}
              onClick={() => {
                onBrandChange(brand.name);
                setIsOpen(false);
              }}
            >
              {brand.logo ? (
                <img src={brand.logo} alt={brand.name} className="brand-logo-small-img" />
              ) : (
                <div className="brand-logo-small"></div>
              )}
              <span>{brand.name}</span>
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
