import React, { useState } from 'react';
import { 
  Sparkles, 
  Compass, 
  BarChart2, 
  Folder, 
  Rocket, 
  PlusSquare, 
  User
} from 'lucide-react';
import BrandSelector from './BrandSelector';
import { Session } from '../../types';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  activeBrand: string;
  onBrandChange: (brand: string) => void;
  sessions: Session[];
  activeSessionId: string | null;
  onSessionSelect: (id: string) => void;
  onNewSession: () => void;
  isCollapsed: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  activeBrand,
  onBrandChange,
  sessions,
  activeSessionId,
  onSessionSelect,
  onNewSession,
  isCollapsed
}) => {
  
  const navItems = [
    { id: 'atria', icon: Sparkles, label: 'Atria' },
    { id: 'inspirations', icon: Compass, label: 'Inspirations' },
    { id: 'dashboards', icon: BarChart2, label: 'Dashboards' },
    { id: 'files', icon: Folder, label: 'Files' },
    { id: 'launch', icon: Rocket, label: 'Launch' },
  ];

  return (
    <div className={`sidebar-container ${isCollapsed ? 'collapsed' : ''}`}>
      
      {/* Brand Selector Area - Now top of sidebar stack */}
      <div className="sidebar-top-section">
          <BrandSelector 
              activeBrand={activeBrand} 
              onBrandChange={onBrandChange} 
              isCollapsed={isCollapsed}
          />
      </div>

      <div className="sidebar-body">
          {/* Level 1 Sidebar */}
          <div className="sidebar-l1">
            <div className="l1-nav-items">
                {navItems.map((item) => (
                <div 
                    key={item.id}
                    className={`l1-item ${activeTab === item.id ? 'active' : ''}`}
                    onClick={() => onTabChange(item.id)}
                    title={item.label}
                >
                    <item.icon size={22} />
                </div>
                ))}
            </div>
            
            <div className="l1-footer">
               <div className="l1-item user-profile">
                   <User size={22} />
               </div>
            </div>
          </div>

          {/* Level 2 Sidebar - Hidden if collapsed */}
          {!isCollapsed && (
            <div className="sidebar-l2">
                <div className="l2-header">
                   <span className="l2-title">{navItems.find(i => i.id === activeTab)?.label}</span>
                </div>

                <div className="l2-content">
                {activeTab === 'atria' && (
                    <>
                    <div className="new-task-btn" onClick={onNewSession}>
                        <PlusSquare size={16} />
                        <span>New Task</span>
                    </div>
                    
                    <div className="section-label">Tasks</div>
                    <div className="session-list">
                        {sessions.map(session => (
                            <div 
                                key={session.id} 
                                className={`session-item ${activeSessionId === session.id ? 'active' : ''}`}
                                onClick={() => onSessionSelect(session.id)}
                            >
                                {session.title}
                            </div>
                        ))}
                        {sessions.length === 0 && (
                            <div className="empty-sessions">No tasks yet</div>
                        )}
                    </div>
                    </>
                )}
                
                {activeTab !== 'atria' && (
                    <div className="coming-soon">
                        Nothing here yet.
                    </div>
                )}
                </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default Sidebar;
